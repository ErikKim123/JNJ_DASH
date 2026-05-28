// Design Ref: §2.3 — `{{key}}` placeholder 치환. 원본 HTML의 renderTemplate + xmlEscape를 그대로 포팅.
import type {
  StepDataPayload,
  PairingData,
  ResultData,
  CeremonyData,
  JudgesIntroData,
  JudgesIntroEntry,
  Pair,
  ResultEntry,
} from '@/lib/sheets/types';

/** judgesIntro 의 SVG 최대 슬롯 — 운영 UI 가 20명 cap. */
const JUDGES_MAX_SLOTS = 20;

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

function fillJudges(
  out: Record<string, string>,
  judges: readonly JudgesIntroEntry[]
): void {
  // 인원수도 SVG layout 분기에 쓰일 수 있도록 평탄화 (현재는 직접 사용 안 함)
  out['judges_count'] = String(judges.length);
  for (let i = 1; i <= JUDGES_MAX_SLOTS; i++) {
    const j = judges.find((x) => x.idx === i);
    out[`judge_name_${i}`] = j?.name ?? '';
    out[`judge_alias_${i}`] = j?.alias ?? '';
    out[`judge_specialty_${i}`] = j?.specialty ?? '';
    out[`judge_photo_${i}`] = j?.photo ?? '';
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
    out[`${prefix}_leader_photo_${i}`] = lead?.photo ?? '';
    out[`${prefix}_follower_${i}`] = foll?.name ?? '';
    out[`${prefix}_follower_num_${i}`] = foll?.num ?? '';
    out[`${prefix}_follower_photo_${i}`] = foll?.photo ?? '';
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
    case 'ceremony': {
      const ceremony = payload.data as CeremonyData;
      const leaders = ceremony.leaders ?? [];
      const followers = ceremony.followers ?? [];
      // Ceremony는 항상 top 3 (1·2·3등)
      fillResultEntries(out, 'champ', leaders, followers, 3);
      // 결승 result 화면과 placeholder 키 공유 가능하도록 result_ prefix도 채움
      fillResultEntries(out, 'result', leaders, followers, 3);
      break;
    }
    case 'judgesIntro': {
      const ji = payload.data as JudgesIntroData;
      fillJudges(out, ji.judges ?? []);
      break;
    }
    case 'prep':
    case 'open':
    case 'live':
    case 'wrapup':
    case 'close':
    case 'ceremony': {
      // sponsor_logos / sponsor_logo_opacities 를 1-indexed placeholder 로 평탄화
      // PREP 외 OPEN/LIVE/CALC(wrapup)/CLOSE/CEREMONY 도 하단 광고 6슬롯 표출.
      flattenSponsors(out, d);
      break;
    }
    default:
      // judgesIntro 등 자체 footer 가 별도인 스텝은 적용 안 함.
      break;
  }

  return out;
}

function flattenSponsors(out: Record<string, string>, d: Record<string, unknown>): void {
  const logos = Array.isArray(d.sponsor_logos) ? (d.sponsor_logos as unknown[]) : [];
  const opacities = Array.isArray(d.sponsor_logo_opacities)
    ? (d.sponsor_logo_opacities as unknown[])
    : [];
  for (let i = 0; i < 6; i++) {
    const v = logos[i];
    out[`sponsor_logo_${i + 1}`] = typeof v === 'string' ? v : '';
    const op = opacities[i];
    const num = typeof op === 'number' && !Number.isNaN(op) ? op : 100;
    const clamped = Math.max(0, Math.min(100, num));
    out[`sponsor_opacity_${i + 1}`] = (clamped / 100).toString();
  }
}
