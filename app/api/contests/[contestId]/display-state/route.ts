// GET /api/contests/[contestId]/display-state  (공개)
//   프로젝터(대시보드)가 MC 표출 포인터를 폴링. anon SELECT 로 contests 읽기 허용됨.
//   반환: { round, step, updatedAt } — 미설정 시 각 null.
import { getSupabaseAnon } from '@/lib/db/client';
import { ok, mapError } from '@/lib/api/envelope';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    const { contestId } = await ctx.params;
    const sb = getSupabaseAnon();
    const { data, error } = await sb
      .from('contests')
      .select('display_round, display_step, display_updated_at')
      .eq('id', contestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return ok({
      round: data?.display_round ?? null,
      step: data?.display_step ?? null,
      updatedAt: data?.display_updated_at ?? null,
    });
  } catch (e) {
    return mapError(e);
  }
}
