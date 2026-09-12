// 참가자 도착 안내 시간 — '대회 시작 N분 전까지 도착해 주세요'.
//
// 값은 대회 설정(contests.arrival_lead_minutes)에 분 단위로 저장하고, 보여줄 때만 읽기 좋게 푼다.
// 확인 메일(서버)과 신청 완료 화면(클라이언트)이 같은 함수를 쓴다 — 두 곳에 각자 쓰면
// 한쪽만 고쳐진 채로 서로 다른 시간을 안내하게 된다.

/** 어드민 드롭다운에 올리는 값. 이 밖의 시간은 '기타'로 직접 넣는다. */
export const ARRIVAL_PRESETS = [10, 30, 45, 60, 120] as const;

export const ARRIVAL_MIN = 1;
export const ARRIVAL_MAX = 1440; // 24시간 — 오타로 '10080분 전' 같은 안내가 나가는 걸 막는다.

/**
 * 대회 설정값 정리.
 *   · 비어 있으면(미입력) 기본 60분 — 직접 입력 칸을 지운 걸 '1분 전'으로 읽으면 안 된다.
 *   · 숫자면 범위 안으로 자른다.
 */
export function normalizeArrivalLead(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 60;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 60;
  return Math.min(ARRIVAL_MAX, Math.max(ARRIVAL_MIN, n));
}

/**
 * 분을 사람이 읽는 길이로. '전/before' 는 붙이지 않는다 — 문장마다 자리가 달라서
 * 부르는 쪽이 붙인다(한국어는 '1시간 전', 영어는 'before ... starts').
 *   90 → '1시간 30분' / '1 hour 30 minutes'
 */
export function formatArrivalLead(minutes: number, lang: 'ko' | 'en'): string {
  const m = normalizeArrivalLead(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;

  if (lang === 'ko') {
    if (h === 0) return `${r}분`;
    return r === 0 ? `${h}시간` : `${h}시간 ${r}분`;
  }

  const hours = h === 1 ? '1 hour' : `${h} hours`;
  const mins = r === 1 ? '1 minute' : `${r} minutes`;
  if (h === 0) return mins;
  return r === 0 ? hours : `${hours} ${mins}`;
}
