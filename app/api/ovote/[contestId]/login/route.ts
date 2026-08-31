// POST /api/ovote/[contestId]/login
//   관객 심사위원 로그인 — 심사위원 번호(또는 이메일) + 4자리 PIN 검증.
//   성공 시 { judgeId, name, displayOrder, judgeNo } 반환(클라이언트가 세션 보관).
// 공개 엔드포인트(미들웨어 대상 아님). VOTE 앱처럼 별도 세션 쿠키 없이 클라 저장.
//
// 0037 이후: 계정(audience_judges)이 먼저다.
//   · 전역 번호/이메일 + PIN 이 맞으면 이 대회 참여 행을 찾아주고, 없으면 그 자리에서 만든다
//     → 등록하지 않은 대회에 와도 다시 등록할 필요가 없다.
//   · 계정이 없던 옛 등록(이메일 없이 등록된 행)은 대회별 등록 번호로 폴백 조회한다.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { getContest } from '@/lib/db/queries';
import { fullName } from '@/lib/participants/name';
import { escapeLike, ensureEnrollment, findAccountByIdentifier } from '@/lib/audience/account';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  identifier: z.string().min(1).max(320), // 심사위원 번호(전역 또는 대회별) 또는 이메일
  pin: z.string().regex(/^\d{4}$/),
});

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === 'pin')) {
      return NextResponse.json({ error: 'PIN_INVALID' }, { status: 400 });
    }
    return NextResponse.json({ error: 'VALIDATION' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const id = parsed.data.identifier.trim();
  const pin = parsed.data.pin;

  // 1) 통합 계정 경로 — 전역 번호 또는 이메일.
  try {
    const account = await findAccountByIdentifier(sb, id);
    if (account && account.pin === pin) {
      const contest = await getContest(contestId);
      if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });
      if (contest.status === 'archived' || contest.status === 'done') {
        return NextResponse.json({ error: 'CONTEST_CLOSED' }, { status: 403 });
      }
      const row = await ensureEnrollment(sb, contestId, account);
      if (!row) return NextResponse.json({ error: 'ENROLL_FAILED' }, { status: 500 });
      const name =
        fullName(row.first_name, row.last_name) || row.name || row.email || `#${row.display_order}`;
      return NextResponse.json({
        data: { judgeId: row.id, name, displayOrder: row.display_order, judgeNo: account.judge_no },
      });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'DB_ERR' }, { status: 500 });
  }

  // 2) 폴백 — 계정 없이 남은 옛 행(대회별 등록 번호 또는 이메일).
  const asNumber = /^\d+$/.test(id) ? Number(id) : null;
  let query = sb
    .from('online_judges')
    .select('id, display_order, first_name, last_name, name, email, pin')
    .eq('contest_id', contestId)
    .is('audience_judge_id', null);
  query =
    asNumber != null
      ? query.eq('display_order', asNumber)
      : query.ilike('email', escapeLike(id));

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // 존재하지 않거나 PIN 불일치 — 동일 메시지(계정 존재 여부 노출 방지).
  if (!data || data.pin !== pin) {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  }

  const name = fullName(data.first_name, data.last_name) || data.name || data.email || `#${data.display_order}`;
  return NextResponse.json({
    data: { judgeId: data.id, name, displayOrder: data.display_order, judgeNo: null },
  });
}
