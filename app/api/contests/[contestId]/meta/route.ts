// Design Ref: §4.2 — GET /api/contests/[contestId]/meta
import { getContestMeta } from '@/lib/sheets/adapter';
import { ok, fail, mapError } from '@/lib/api/envelope';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ contestId: string }> }) {
  try {
    const { contestId } = await ctx.params;
    if (!contestId) return fail(400, 'contestId required');
    const meta = await getContestMeta(contestId);
    if (!meta) return fail(404, 'contest not found');
    return ok(meta);
  } catch (e) {
    return mapError(e);
  }
}
