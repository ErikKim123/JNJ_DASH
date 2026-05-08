// Design Ref: §2.3 — `{{key}}` placeholder 치환. 원본 HTML의 renderTemplate + xmlEscape를 그대로 포팅.
import type {
  StepDataPayload,
  PairingData,
  ResultData,
  Pair,
  ResultEntry,
} from '@/lib/sheets/types';

export function xmlEscape(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function applyPlaceholders(svg: string, data: Record<string, unknown>): string {
  return svg.replace(/\{\{(\w+)\}\}/g, (_, k: string) => xmlEscape(data[k] ?? ''));
}

// ─── flatten helpers ────────────────────────────────────────────────────────

function fillPairs(out: Record<string, string>, pairs: readonly Pair[], maxIdx: number): void {
  for (let i = 1; i <= maxIdx; i++) {
    const p = pairs.find((x) => x.idx === i);
    out[`leader_${i}`] = p?.leader ?? '';
    out[`leader_num_${i}`] = p?.leaderNum ?? '';
    out[`follower_${i}`] = p?.follower ?? '';
    out[`follower_num_${i}`] = p?.followerNum ?? '';
  }
}

function fillResultEntries(
  out: Record<string, string>,
  prefix: 'result' | 'champ',
  leaders: readonly ResultEntry[],
  followers: readonly ResultEntry[],
  maxIdx: number
): void {
  for (let i = 1; i <= maxIdx; i++) {
    const lead = leaders.find((x) => x.idx === i);
    const foll = followers.find((x) => x.idx === i);
    out[`${prefix}_leader_${i}`] = lead?.name ?? '';
    out[`${prefix}_leader_num_${i}`] = lead?.num ?? '';
    out[`${prefix}_follower_${i}`] = foll?.name ?? '';
    out[`${prefix}_follower_num_${i}`] = foll?.num ?? '';
  }
}

/**
 * StepDataPayload를 SVG placeholder 키-값 맵으로 평탄화.
 * 정렬되지 않은 pairs/leaders/followers도 idx 기반으로 매핑.
 */
export function flattenStepData(payload: StepDataPayload): Record<string, string> {
  const out: Record<string, string> = {};
  const d = payload.data as unknown as Record<string, unknown>;

  // 모든 스칼라 키를 그대로 평탄화 (배열은 별도 처리)
  for (const [k, v] of Object.entries(d)) {
    if (Array.isArray(v)) continue;
    out[k] = String(v ?? '');
  }

  switch (payload.kind) {
    case 'pairing': {
      const pairing = payload.data as PairingData;
      const pairs = pairing.pairs ?? [];
      // pairs 길이에 따라 SVG가 20/10/5중 선택되므로 pair 수와 동일하게 채움
      const max = pairs.length;
      fillPairs(out, pairs, max);
      break;
    }
    case 'result': {
      const result = payload.data as ResultData;
      const leaders = result.leaders ?? [];
      const followers = result.followers ?? [];
      const max = Math.max(leaders.length, followers.length);
      // 결승은 champ_leader_*, 다른 라운드는 result_leader_* 라는 차이는 caller(레지스트리)가
      // 어떤 SVG를 쓰는지에 따라 다르므로, 양쪽 prefix를 모두 채워둔다 (사용 안 되는 키는 단순 무시됨)
      fillResultEntries(out, 'result', leaders, followers, max);
      // 결승 result는 항상 top 3
      fillResultEntries(out, 'champ', leaders, followers, 3);
      break;
    }
    default:
      // 그 외 스텝(prep/open/live/wrapup/close): 스칼라만 사용 — 위 평탄화로 충분
      break;
  }

  return out;
}
