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
      const emailResult2 = await dispatchConfirmation(contest, data2, cleanMeta);
      return NextResponse.json({ data: data2, email: emailResult2 }, { status: 201 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const emailResult = await dispatchConfirmation(contest, data, cleanMeta);
  return NextResponse.json({ data, email: emailResult }, { status: 201 });
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
    displayName: row.representative || row.team_name || '참가자',
    num: row.num,
    contestName: contest.name,
    contestId: contest.id,
    period,
  });
}
