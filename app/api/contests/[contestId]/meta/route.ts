// Design Ref: §4.2 — GET /api/contests/[contestId]/meta
//   ?refresh=1 → 해당 대회 시트의 LRU 캐시를 모두 무효화하고 새로 읽음.
//   조회 버튼이 참가자수/등수/점수 등 메타 정보를 강제 갱신할 때 사용.
import { getContestMeta, getContestSummary } from '@/lib/sheets/adapter';
import { invalidateSheetCache } from '@/lib/sheets/client';
import { ok, fail, mapError } from '@/lib/api/envelope';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ contestId: string }> }) {
  try {
    const { contestId } = await ctx.params;
    if (!contestId) return fail(400, 'contestId required');

    const refresh = new URL(req.url).searchParams.get('refresh') === '1';
    if (refresh) {
      // 캐시 무효화는 해당 대회의 spreadsheetId 한정 — 다른 대회 캐시를 건드리지 않음.
      const summary = await getContestSummary(contestId);
      if (summary?.spreadsheetId) invalidateSheetCache(summary.spreadsheetId);
    }

    const meta = await getContestMeta(contestId);
    if (!meta) return fail(404, 'contest not found');
    return ok(meta);
  } catch (e) {
    return mapError(e);
  }
}
