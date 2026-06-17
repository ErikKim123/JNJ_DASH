// POST /api/join/[contestId]/submit
//
// 공개 참가자 셀프 등록 엔드포인트. /admin 미들웨어 적용 대상이 아니므로 누구나 호출 가능.
//
// 안전 정책:
//   - 입력은 Zod 로 strict validate, photo_url 외 모든 본문 필드 max length 제한.
//   - num 은 서버가 계산 — 클라이언트가 보낸 값은 신뢰하지 않음 (오용 방지 + 동시성 충돌 방지).
//   - meta 키는 화이트리스트(PROFILE_KEYS) 만 통과.
//   - 단순 IP-기반 throttling 없이도 RLS + service_role 만 쓰기 가능한 구조에서 안전.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { listParticipants, getContest } from '@/lib/db/queries';
import { nextParticipantNum } from '@/lib/participants/next-num';
import { sendConfirmationEmail } from '@/lib/email/sendConfirmation';
import type { ContestRow } from '@/lib/db/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 확인 메일 발송 ON/OFF. Brevo 무료 플랜(일 300통) 기준으로 운영.
// 끄려면 false 로 변경 (sendConfirmation 로직은 그대로 보존).
const CONFIRMATION_EMAIL_ENABLED = true;

const RoleEnum = z.enum(['leader', 'follower', 'helper_leader', 'helper_follower']);

// PROFILE 화이트리스트 — admin ParticipantsTable.PROFILE_FIELDS 와 동일 키.
const PROFILE_KEYS = new Set([
  '부문', '장르', '연락처', '이메일', 'Nationality', '접수일', '사진원본', 'X',
]);

const SubmitSchema = z.object({
  team_name: z.string().min(1).max(200),
  representative: z.string().min(1).max(200),
  role: RoleEnum,
  photo_url: z.string().max(2048).default(''),
  // meta 객체는 키-값 모두 string 으로 받음. 빈 값/모르는 키는 서버에서 제거.
  meta: z.record(z.string(), z.string().max(2048)).optional().default({}),
});

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;

  // 대회 존재 + 접수 가능 상태 검증.
  let contest;
  try {
    contest = await getContest(contestId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'DB_ERR' }, { status: 500 });
  }
  if (!contest) {
    return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });
  }
  // ready 상태에서만 신청 가능 — live/done/archived 모두 차단.
  if (contest.status !== 'ready') {
    return NextResponse.json({ error: 'CONTEST_CLOSED', status: contest.status }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }

  // meta sanitize — 화이트리스트 키만, 빈 문자열 제외.
  const cleanMeta: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.data.meta)) {
    if (!PROFILE_KEYS.has(k)) continue;
    const t = v.trim();
    if (t) cleanMeta[k] = t;
  }

  // 이메일 필수 — 확인 메일 발송 대상이자 본인 식별 수단. 미입력/형식오류 시 저장 거부.
  const email = cleanMeta['이메일'];
  if (!email) {
    return NextResponse.json({ error: 'EMAIL_REQUIRED' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'EMAIL_INVALID' }, { status: 400 });
  }

  // 다음 번호 — listParticipants → max+1 (3자리 zero-pad 유지).
  const existing = await listParticipants(contestId);
  const num = nextParticipantNum(existing);

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('participants')
    .insert({
      contest_id: contestId,
      num,
      team_name: parsed.data.team_name,
      representative: parsed.data.representative,
      role: parsed.data.role,
      photo_url: parsed.data.photo_url,
      meta: cleanMeta,
    })
    .select('*')
    .single();
  if (error) {
    // 23505 = unique_violation (num 중복 — 동시 신청 충돌 시)
    if (error.code === '23505') {
      // 한 번 재시도: 새 max 다시 계산
      const retry = await listParticipants(contestId);
      const retryNum = nextParticipantNum(retry);
      const { data: data2, error: err2 } = await sb
        .from('participants')
        .insert({
          contest_id: contestId,
          num: retryNum,
          team_name: parsed.data.team_name,
          representative: parsed.data.representative,
          role: parsed.data.role,
          photo_url: parsed.data.photo_url,
          meta: cleanMeta,
        })
        .select('*')
        .single();
      if (err2) return NextResponse.json({ error: err2.message }, { status: 500 });
      const emailResult2 = CONFIRMATION_EMAIL_ENABLED
        ? await dispatchConfirmation(contest, data2, cleanMeta)
        : undefined;
      return NextResponse.json(emailResult2 ? { data: data2, email: emailResult2 } : { data: data2 }, { status: 201 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const emailResult = CONFIRMATION_EMAIL_ENABLED
    ? await dispatchConfirmation(contest, data, cleanMeta)
    : undefined;
  return NextResponse.json(emailResult ? { data, email: emailResult } : { data }, { status: 201 });
}

// 등록 성공 후 확인 메일 발송. PROFILE.이메일 우선, 미입력이면 skip.
// 발송 실패는 전체 응답을 깨뜨리지 않고 결과만 응답에 포함시켜 운영자가 확인 가능.
async function dispatchConfirmation(
  contest: ContestRow,
  row: { num: string; representative: string; team_name: string },
  meta: Record<string, string>
) {
  const to = meta['이메일'];
  if (!to) return { sent: false, reason: 'NO_EMAIL' as const };
  const period = [contest.period_start, contest.period_end].filter(Boolean).join(' ~ ');
  return sendConfirmationEmail(to, {
    // team_name = 폼의 '이름(Name)' 필드, representative = '국가(Country)'.
    // 인사에는 사람 이름을 써야 하므로 team_name 을 우선한다.
    displayName: row.team_name || row.representative || '참가자',
    num: row.num,
    contestName: contest.name,
    contestId: contest.id,
    period,
    // SNS 방이 활성일 때만 링크 전달 (done 화면 노출 조건과 동일).
    snsUrl: contest.sns_enabled ? contest.sns_url : '',
    paymentUrl: contest.payment_enabled ? contest.payment_url : '',
  });
}
