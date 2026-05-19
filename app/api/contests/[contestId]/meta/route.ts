// Design Ref: §4.2 — GET /api/contests/[contestId]/meta (Phase 3: DB 기반)
// ?refresh=1 는 호환을 위해 허용 — DB 에 캐시가 없어 no-op.
import { getContestMeta } from '@/lib/db/adapter';
import { ok, fail, mapError } from '@/lib/api/envelope';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
