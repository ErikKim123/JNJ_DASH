// Design Ref: §4.3 — GET /api/contests/[contestId]/round/[round]/step/[step]
import { getStepData } from '@/lib/sheets/adapter';
import { ok, fail, mapError } from '@/lib/api/envelope';
import { ROUND_KEYS, STEP_KEYS, type RoundKey, type StepKey } from '@/lib/sheets/types';
import { getServerEnv } from '@/config/env';

export const dynamic = 'force-dynamic';

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

    // ?refresh=1 → 페어링 스냅샷을 폐기하고 시트에서 재로드
    const refresh = new URL(req.url).searchParams.get('refresh') === '1';

    const payload = await getStepData({ contestId, round, step, refresh });
    const env = getServerEnv();
    return ok(payload, {
      cachedAt: new Date().toISOString(),
      ttlSeconds: env.SHEETS_CACHE_TTL_SECONDS,
    });
  } catch (e) {
    return mapError(e);
  }
}
