// MC 화면전환 — 라운드/스텝을 탭하면 공유 표출 포인터를 기록하고 프로젝터가 따라감. (요구 0·1)
'use client';

import { useCallback, useState } from 'react';
import { ROUND_KEYS, STEPS_BY_ROUND, type RoundKey, type StepKey } from '@/lib/sheets/types';
import { ROUND_LABEL, stepLabel } from './labels';
import { Card, StatusLine, adminFetch } from './ui';

export function ScreenControl({
  contestId,
  initialRound,
  initialStep,
}: {
  contestId: string;
  initialRound: RoundKey | null;
  initialStep: StepKey | null;
}) {
  const [round, setRound] = useState<RoundKey>(initialRound ?? 'prelim');
  const [step, setStep] = useState<StepKey>(initialStep ?? 'prep');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = STEPS_BY_ROUND[round];

  const push = useCallback(
    async (nextRound: RoundKey, nextStep: StepKey) => {
      setRound(nextRound);
      setStep(nextStep);
      setPending(true);
      setError(null);
      try {
        await adminFetch(`/api/admin/contests/${encodeURIComponent(contestId)}/display-state`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ round: nextRound, step: nextStep }),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setPending(false);
      }
    },
    [contestId]
  );

  const onRound = (r: RoundKey) => push(r, STEPS_BY_ROUND[r][0]);

  const idx = steps.indexOf(step);
  const goPrev = () => idx > 0 && push(round, steps[idx - 1]);
  const goNext = () => idx >= 0 && idx < steps.length - 1 && push(round, steps[idx + 1]);

  return (
    <>
      <Card title="현재 표출" right={pending ? <span className="text-[10px] text-ink2">전송중…</span> : null}>
        <div className="text-center py-1">
          <div className="text-accent text-lg font-semibold">
            {ROUND_LABEL[round].ko} · {stepLabel(step, steps)}
          </div>
          <div className="text-[10px] font-mono text-ink2 tracking-widest mt-0.5">
            {ROUND_LABEL[round].en}
          </div>
        </div>
        {error ? <StatusLine tone="danger">{error}</StatusLine> : null}
      </Card>

      {/* 라운드 선택 */}
      <Card title="라운드 / Round">
        <div className="grid grid-cols-3 gap-2">
          {ROUND_KEYS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRound(r)}
              className={`min-h-[56px] rounded-xl border text-sm font-semibold transition ${
                r === round
                  ? 'bg-accent text-[#1A1612] border-accent'
                  : 'bg-panel text-ink2 border-border active:bg-bg2'
              }`}
            >
              {ROUND_LABEL[r].ko}
            </button>
          ))}
        </div>
      </Card>

      {/* 스텝 이동 */}
      <Card title="스텝 / Step">
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={idx <= 0}
            className="flex-1 min-h-[52px] rounded-xl border border-border bg-panel text-ink font-semibold active:bg-bg2 disabled:opacity-30"
          >
            ◀ 이전
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={idx < 0 || idx >= steps.length - 1}
            className="flex-1 min-h-[52px] rounded-xl border border-border bg-panel text-ink font-semibold active:bg-bg2 disabled:opacity-30"
          >
            다음 ▶
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {steps.map((s) => {
            const active = s === step;
            const isLive = s === 'live';
            return (
              <button
                key={s}
                type="button"
                onClick={() => push(round, s)}
                className={`min-h-[46px] rounded-lg border px-2 text-[11px] font-semibold tracking-wide transition ${
                  active
                    ? isLive
                      ? 'bg-danger text-white border-danger'
                      : 'bg-accent text-[#1A1612] border-accent'
                    : 'bg-bg2 text-ink2 border-border active:text-ink'
                }`}
              >
                {stepLabel(s, steps)}
              </button>
            );
          })}
        </div>
      </Card>
    </>
  );
}
