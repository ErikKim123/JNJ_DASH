// POST /api/admin/contests/[id]/participants/[participantId]/resend-email
//
// 이미 등록된 참가자에게 확인 메일을 재발송. admin 미들웨어로 보호됨.
// 본인 등록 시 RESEND_API_KEY 가 없어서 발송 못 했거나, 사용자가 메일 분실한 경우에 사용.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/client';
import { getContest } from '@/lib/db/queries';
import { sendConfirmationEmail } from '@/lib/email/sendConfirmation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteCtx {
  params: Promise<{ contestId: string; participantId: string }>;
}

export async function POST(_req: Request, ctx: RouteCtx) {
  const { contestId, participantId } = await ctx.params;

  const contest = await getContest(contestId).catch(() => null);
  if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });

  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb
    .from('participants')
    .select('*')
    .eq('id', participantId)
    .eq('contest_id', contestId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'PARTICIPANT_NOT_FOUND' }, { status: 404 });

  const meta = (row.meta ?? {}) as Record<string, unknown>;
  const to = typeof meta['이메일'] === 'string' ? (meta['이메일'] as string) : '';
  if (!to) return NextResponse.json({ error: 'NO_EMAIL', reason: 'PROFILE.이메일 필드 비어 있음' }, { status: 400 });

  const period = [contest.period_start, contest.period_end].filter(Boolean).join(' ~ ');
  const result = await sendConfirmationEmail(to, {
    displayName: row.representative || row.team_name || '참가자',
    num: row.num,
    contestName: contest.name,
    contestId: contest.id,
    period,
  });
  if (!result.sent) {
    return NextResponse.json({ ...result, to }, { status: 502 });
  }
  return NextResponse.json({ sent: true, id: result.id, to });
}
