// 참가자 이름 처리 — first_name / last_name 분리 규칙의 단일 출처(SOT).
//
// 정책:
//   - 표출(DASH/결과/페어링)·스냅샷에 쓰이는 "표시명"은 last_name 한 가지만 쓴다.
//   - participants.team_name 컬럼은 "표시명(=last_name)" 으로 의미를 재정의하여 유지한다.
//     (qualifiers/pairings/final_results 가 team_name 을 스냅샷 복사하므로, team_name=last_name
//      으로 두면 표출/심사 코드를 고치지 않아도 last name 만 노출된다.)
//
// 분류 규칙:
//   - "Heidi Wong" → { first:'Heidi', last:'Wong' }
//   - "Mary Jane Watson" → { first:'Mary', last:'Jane Watson' }
//   - 공백 없는 한 단어 "XY" → { first:'XY', last:'XY' }  (first/last 둘 다 같은 값 —
//     표시명이 last 이므로 한 단어 이름이 빈 값이 되지 않도록 둘 다 채운다.)

/**
 * 전체 이름 문자열을 first/last 로 분해.
 *   - 양끝 공백 제거 + 연속 공백 1칸으로 정규화.
 *   - 첫 공백 앞 = first, 나머지 = last.
 *   - 공백이 없으면 first/last 둘 다 같은 단어. (예: "XY" → first='XY', last='XY')
 */
export function splitFullName(full: string): { first: string; last: string } {
  const t = (full ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return { first: '', last: '' };
  const i = t.indexOf(' ');
  if (i === -1) return { first: t, last: t };
  return { first: t.slice(0, i), last: t.slice(i + 1).trim() };
}

/** 전체 이름 문자열에서 표시명(=last name) 만 뽑아낸다. 한 단어면 그대로. */
export function displayLastName(full: string): string {
  return splitFullName(full).last;
}

/** 관리자 명단 등에서 쓰는 전체 이름 ("First Last"). 한 단어 미러("XY"/"XY")는 한 번만. */
export function fullName(first: string, last: string): string {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (f && l && f === l) return f; // 한 단어 이름(first=last) 은 중복 표기 방지
  return [f, l].filter(Boolean).join(' ');
}

/**
 * 저장 직전 이름 필드 정규화.
 *   - first_name 이 있으면 그대로(트림) 사용.
 *   - first_name 이 비어있고 legacy team_name 만 있으면 team_name 을 분해해 채운다.
 *   - team_name(표시명) 은 항상 last_name 과 동일하게 맞춘다.
 */
export function normalizeNameFields(input: {
  first_name?: string;
  last_name?: string;
  team_name?: string;
}): { first_name: string; last_name: string; team_name: string } {
  let first = (input.first_name ?? '').trim();
  let last = (input.last_name ?? '').trim();
  const legacy = (input.team_name ?? '').trim();
  if (!first && legacy) {
    const s = splitFullName(legacy);
    first = s.first;
    if (!last) last = s.last;
  }
  return { first_name: first, last_name: last, team_name: last };
}
