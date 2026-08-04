// MC 콘솔 공용 라벨 — 대시보드 StepNav / RoundNav 와 동일 어휘 유지.
import type { RoundKey, StepKey } from '@/lib/sheets/types';

export const ROUND_LABEL: Record<RoundKey, { ko: string; en: string }> = {
  prelim: { ko: '예선', en: 'PRELIMINARY' },
  semi: { ko: '본선', en: 'SEMI-FINAL' },
  final: { ko: '결승', en: 'GRAND FINAL' },
};

export const STEP_LABEL: Record<StepKey, string> = {
  prep: 'PREP',
  judgesIntro: 'JUDGES',
  judgesVideo: 'VIDEO',
  pairing: 'PAIRING',
  pairingB: 'PAIRING B',
  pairingC: 'PAIRING C',
  open: 'OPEN',
  live: 'LIVE',
  wrapup: 'CALC TOTAL',
  close: 'CLOSE',
  result: 'RESULT',
  ceremony: 'CEREMONY',
  report: 'REPORT',
  reportOnline: 'ONLINE REPORT',
};

// pairingB/C가 같은 라운드에 있으면 첫 pairing을 'PAIRING A'로 표기 (StepNav 와 동일).
export function stepLabel(step: StepKey, steps: ReadonlyArray<StepKey>): string {
  if (step === 'pairing' && (steps.includes('pairingB') || steps.includes('pairingC'))) {
    return 'PAIRING A';
  }
  return STEP_LABEL[step];
}
