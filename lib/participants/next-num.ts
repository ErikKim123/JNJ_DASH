// 참가자 신규 번호 계산 — 정수형 숫자 키만 추리고 max + 1.
// 운영 시트 관례상 num 은 보통 "001", "120" 처럼 zero-padded 3자리.
// 빈 리스트면 "001" 부터 시작.
export function nextParticipantNum(existing: { num: string }[]): string {
  let max = 0;
  let pad = 3;
  for (const p of existing) {
    const m = p.num.match(/^(\d+)$/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
    if (p.num.length > pad) pad = p.num.length;
  }
  const next = max + 1;
  return String(next).padStart(pad, '0');
}
