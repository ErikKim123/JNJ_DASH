// MC 화면전환 — 라운드/스텝을 탭하면 공유 표출 포인터를 기록하고 프로젝터가 따라감. (요구 0·1)
'use client';

import { useCallback, useEffect, useState } from 'react';
import { ROUND_KEYS, STEPS_BY_ROUND, type RoundKey, type StepKey } from '@/lib/sheets/types';
import type { ExtraVideos } from '@/lib/contest/extraVideos';
import { FINAL_REVEAL_ORDER, REVEAL_LABEL } from '@/lib/display/reveal';
import { ROUND_LABEL, stepLabel } from './labels';
import { Card, StatusLine, adminFetch, sendDisplayCmd } from './ui';

export function ScreenControl({
  contestId,
  round,
  step,
  setRound,
  setStep,
  extraVideos,
}: {
  contestId: string;
  /** 표출 포인터 — MCConsole 이 소유(동점 배너가 같은 라운드를 감시해야 하므로). */
  round: RoundKey;
  step: StepKey;
  setRound: (r: RoundKey) => void;
  setStep: (s: StepKey) => void;
  extraVideos: ExtraVideos;
}) {
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
    [contestId, setRound, setStep]
  );

  const onRound = (r: RoundKey) => push(r, STEPS_BY_ROUND[r][0]);

  const onVideoStep = round === 'prelim' && step === 'judgesVideo';

  // 영상 재생/일시정지/처음부터 — 표출이 VIDEO 스텝이 아니면 스텝 이동을 같은 요청에 실어 보낸다.
  // 표출은 한 번의 폴링에서 포인터를 먼저 적용하고 명령을 실행하므로 한 탭으로 "띄우고 재생".
  const video = async (action: 'play' | 'pause' | 'restart') => {
    const jump = action !== 'pause' && !onVideoStep;
    if (jump) {
      setRound('prelim');
      setStep('judgesVideo');
    }
    setPending(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/contests/${encodeURIComponent(contestId)}/display-state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cmd: `video:${action}`,
          ...(jump ? { round: 'prelim', step: 'judgesVideo' } : {}),
        }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };

  // 현재 라운드의 추가 영상(표출 오른쪽 위 VIDEO 1·2·3 오버레이) — 채워진 칸만 노출.
  const overlaySlots = (extraVideos[round] ?? [])
    .map((url, i) => ({ n: i + 1, filled: Boolean(url.trim()) }))
    .filter((v) => v.filled);

  const overlay = async (cmd: 'overlay:1' | 'overlay:2' | 'overlay:3' | 'overlay:close') => {
    setPending(true);
    setError(null);
    try {
      await sendDisplayCmd(contestId, cmd);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };

  // 결승 RESULT — 표출은 클릭할 때마다 한 자리씩 발표한다. MC 가 그 클릭을 원격으로 대신한다.
  // 발표 수는 MC 쪽 로컬 카운터(표출 상태를 되읽지 않음) — 스텝을 벗어나면 0 으로 초기화.
  const onFinalResult = round === 'final' && step === 'result';
  const [revealCount, setRevealCount] = useState(0);
  useEffect(() => {
    if (!onFinalResult) setRevealCount(0);
  }, [onFinalResult]);

  const reveal = async (action: 'next' | 'reset') => {
    if (action === 'next' && revealCount >= FINAL_REVEAL_ORDER.length) return;
    setRevealCount((c) => (action === 'next' ? c + 1 : 0));
    setPending(true);
    setError(null);
    try {
      await sendDisplayCmd(contestId, action === 'next' ? 'reveal:next' : 'reveal:reset');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // 실패했으면 카운터를 되돌린다.
      setRevealCount((c) => (action === 'next' ? Math.max(0, c - 1) : c));
    } finally {
      setPending(false);
    }
  };

  // PAIRING 표출 레이아웃 — 표출의 "목록/원형 배치" 버튼을 원격으로 대신 누른다.
  // 표출 상태를 되읽지 않으므로 MC 쪽 로컬 표시값만 갱신(마지막으로 보낸 명령 기준).
  const onPairingStep = step === 'pairing' || step === 'pairingB' || step === 'pairingC';
  const [pairCircle, setPairCircle] = useState(false);

  const pairLayout = async (circle: boolean) => {
    setPairCircle(circle);
    setPending(true);
    setError(null);
    try {
      await sendDisplayCmd(contestId, circle ? 'pair:circle' : 'pair:list');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPairCircle(!circle);
    } finally {
      setPending(false);
    }
  };

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
            const stepBtn = (
              <button
                type="button"
                onClick={() => push(round, s)}
                className={`min-h-[46px] rounded-lg border px-2 text-[11px] font-semibold tracking-wide transition ${
                  active
                    ? isLive
                      ? 'bg-danger text-white border-danger'
                      : 'bg-accent text-[#1A1612] border-accent'
                    : 'bg-bg2 text-ink2 border-border active:text-ink'
                } ${s === 'judgesVideo' ? 'flex-1 min-w-0' : 'w-full'}`}
              >
                {stepLabel(s, steps)}
              </button>
            );
            // VIDEO 스텝은 옆에 ▶ 재생 버튼 — 표출의 영상 플레이어를 원격으로 시작한다.
            if (s === 'judgesVideo') {
              return (
                <div key={s} className="flex gap-1">
                  {stepBtn}
                  <button
                    type="button"
                    onClick={() => video('play')}
                    disabled={pending}
                    aria-label="표출 영상 재생"
                    title="표출 영상 재생"
                    className="min-h-[46px] w-11 shrink-0 rounded-lg border border-ok/50 bg-ok/15 text-ok text-sm active:bg-ok/30 disabled:opacity-40"
                  >
                    ▶
                  </button>
                </div>
              );
            }
            return <div key={s} className="flex">{stepBtn}</div>;
          })}
        </div>

        {/* VIDEO 스텝 표출 중 — 재생/일시정지 원격 제어 */}
        {onVideoStep && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-[10px] text-ink2 mb-2">표출 영상 / VIDEO</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => video('restart')}
                disabled={pending}
                aria-label="처음부터 재생"
                title="처음부터 재생"
                className="min-h-[48px] w-12 shrink-0 rounded-xl border border-border bg-panel text-ink text-sm font-semibold active:bg-bg2 disabled:opacity-40"
              >
                ⏮
              </button>
              <button
                type="button"
                onClick={() => video('play')}
                disabled={pending}
                className="flex-1 min-h-[48px] rounded-xl border border-ok/50 bg-ok/15 text-ok text-sm font-semibold active:bg-ok/30 disabled:opacity-40"
              >
                ▶ 재생
              </button>
              <button
                type="button"
                onClick={() => video('pause')}
                disabled={pending}
                className="flex-1 min-h-[48px] rounded-xl border border-border bg-panel text-ink text-sm font-semibold active:bg-bg2 disabled:opacity-40"
              >
                ⏸ 일시정지
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* PAIRING 배치 — 표출의 목록/원형 배치 토글을 원격으로 전환한다. */}
      {onPairingStep && (
        <Card title={`페어링 배치 / Layout · ${stepLabel(step, steps)}`}>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => pairLayout(false)}
              disabled={pending}
              className={`min-h-[56px] rounded-xl border text-sm font-semibold tracking-wide transition disabled:opacity-40 ${
                !pairCircle
                  ? 'bg-accent text-[#1A1612] border-accent'
                  : 'bg-bg2 text-ink2 border-border active:text-ink'
              }`}
            >
              ▤ 목록 배치
            </button>
            <button
              type="button"
              onClick={() => pairLayout(true)}
              disabled={pending}
              className={`min-h-[56px] rounded-xl border text-sm font-semibold tracking-wide transition disabled:opacity-40 ${
                pairCircle
                  ? 'bg-accent text-[#1A1612] border-accent'
                  : 'bg-bg2 text-ink2 border-border active:text-ink'
              }`}
            >
              ◯ 원형 배치
            </button>
          </div>
          <p className="text-[10px] text-ink2 mt-2">
            표출 화면의 배치를 바꿉니다 · 표출에서 직접 눌러도 동일하게 전환됩니다
          </p>
        </Card>
      )}

      {/* 결승 RESULT 발표 — 표출 화면 클릭을 원격으로 대신한다. */}
      {onFinalResult && (
        <Card
          title="결승 발표 / Reveal"
          right={
            <span className="text-[10px] font-mono text-ink2">
              {revealCount} / {FINAL_REVEAL_ORDER.length}
            </span>
          }
        >
          <p className="text-center text-sm mb-3">
            {revealCount < FINAL_REVEAL_ORDER.length ? (
              <>
                <span className="text-ink2 text-xs">다음 발표 · </span>
                <span className="text-accent font-semibold">
                  {REVEAL_LABEL[FINAL_REVEAL_ORDER[revealCount]]}
                </span>
              </>
            ) : (
              <span className="text-ok font-semibold">발표 완료</span>
            )}
          </p>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => reveal('next')}
              disabled={pending || revealCount >= FINAL_REVEAL_ORDER.length}
              className="min-h-[56px] rounded-xl border border-accent bg-accent text-[#1A1612] text-sm font-semibold tracking-wide active:bg-accent2 disabled:opacity-40"
            >
              ▶ 다음 발표
            </button>
            <button
              type="button"
              onClick={() => reveal('reset')}
              disabled={pending || revealCount === 0}
              className="min-h-[48px] rounded-xl border border-danger/50 bg-danger/15 text-danger text-sm font-semibold active:bg-danger/25 disabled:opacity-40"
            >
              ↻ 처음부터 (발표 초기화)
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {FINAL_REVEAL_ORDER.map((id, i) => (
              <span
                key={id}
                className={`rounded px-2 py-1 text-[10px] font-semibold border ${
                  i < revealCount
                    ? 'bg-ok/15 text-ok border-ok/40'
                    : 'bg-bg2 text-ink2 border-border'
                }`}
              >
                {REVEAL_LABEL[id]}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-ink2 mt-2">
            잘못 눌렀으면 초기화 후 다시 진행하세요 · 표출에서 직접 클릭해도 동일하게 발표됩니다
          </p>
        </Card>
      )}

      {/* 라운드별 추가 영상 — 표출 오른쪽 위 VIDEO 1·2·3 오버레이를 원격으로 띄우고 닫는다. */}
      {overlaySlots.length > 0 && (
        <Card
          title={`추가 영상 / Video · ${ROUND_LABEL[round].ko}`}
          right={<span className="text-[10px] text-ink2">{overlaySlots.length}개</span>}
        >
          <div className="grid grid-cols-3 gap-2">
            {overlaySlots.map((v) => (
              <button
                key={v.n}
                type="button"
                onClick={() => overlay(`overlay:${v.n}` as 'overlay:1' | 'overlay:2' | 'overlay:3')}
                disabled={pending}
                className="min-h-[52px] rounded-xl border border-accent2/60 bg-bg2 text-xs font-mono font-semibold tracking-widest text-accent active:bg-accent2 active:text-bg disabled:opacity-40"
              >
                ▶ VIDEO {v.n}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => overlay('overlay:close')}
            disabled={pending}
            className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-panel text-ink2 text-xs font-semibold active:bg-bg2 active:text-ink disabled:opacity-40"
          >
            ✕ 영상 닫기
          </button>
          <p className="text-[10px] text-ink2 mt-2">전체화면 오버레이로 재생됩니다 · 표출에서 Esc 로도 닫힘</p>
        </Card>
      )}
    </>
  );
}
