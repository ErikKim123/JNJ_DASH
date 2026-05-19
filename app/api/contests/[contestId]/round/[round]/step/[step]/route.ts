// Design Ref: §4.3 — GET /api/contests/[contestId]/round/[round]/step/[step] (Phase 3: DB 기반)
import { getStepData } from '@/lib/db/adapter';
import { ok, fail, mapError } from '@/lib/api/envelope';
import { ROUND_KEYS, STEP_KEYS, type RoundKey, type StepKey } from '@/lib/sheets/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isRound(v: string): v is RoundKey {
  return (ROUND_KEYS as readonly string[]).includes(v);
}
function isStep(v: string): v is StepKey {
  return (STEP_KEYS as readonly string[]).includes(v);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ contestId: string; round: string; step: string }> }
) {
  try {
    const { contestId, round, step } = await ctx.params;
    if (!isRound(round)) return fail(400, `invalid round: ${round}`);
    if (!isStep(step)) return fail(400, `invalid step: ${step}`);

    // ?refresh=1 — sheets 시절 페어링 스냅샷 폐기용. DB 는 진실 원천이라 호환 인자만 받고 무시.
    const refresh = new URL(req.url).searchParams.get('refresh') === '1';
    const payload = await getStepData({ contestId, round, step, refresh });
    // ttlSeconds 는 클라이언트 폴링 hint 로만 사용. DB 캐시 없음 → 5초 고정.
    return ok(payload, { cachedAt: new Date().toISOString(), ttlSeconds: 5 });
  } catch (e) {
    return mapError(e);
  }
}
