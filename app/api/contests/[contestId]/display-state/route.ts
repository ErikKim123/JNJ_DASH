// GET /api/contests/[contestId]/display-state  (공개)
//   프로젝터(대시보드)가 MC 표출 포인터 + 따라가기 스위치를 폴링. contests 는 anon SELECT 허용.
//   반환: { round, step, updatedAt, follow, followAt } — 미설정 시 각 null(follow 는 false).
import { getSupabasePublicRead } from '@/lib/db/client';
import { ok, mapError } from '@/lib/api/envelope';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    const { contestId } = await ctx.params;
    const sb = getSupabasePublicRead();
    const { data, error } = await sb
      .from('contests')
      .select('display_round, display_step, display_updated_at, display_follow, display_follow_at')
      .eq('id', contestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return ok({
      round: data?.display_round ?? null,
      step: data?.display_step ?? null,
      updatedAt: data?.display_updated_at ?? null,
      follow: data?.display_follow ?? false,
      followAt: data?.display_follow_at ?? null,
    });
  } catch (e) {
    return mapError(e);
  }
}
