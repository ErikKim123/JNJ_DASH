// Design Ref: §5, §7 — 클라이언트 컴포넌트. URL search params(round/step) ↔ 상태 동기화 + 폴링.
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ContestMeta, RoundKey, StepKey } from '@/lib/sheets/types';
import { ROUND_KEYS, STEP_KEYS } from '@/lib/sheets/types';
import { useSheetPoll } from '@/hooks/useSheetPoll';
import { TemplateRenderer } from '@/components/templates/TemplateRenderer';
import { RoundNav } from './RoundNav';
import { StepNav } from './StepNav';
import { MiniNav } from './MiniNav';
import { LiveIndicator } from './LiveIndicator';
import { EmptyState } from './EmptyState';
import { FullscreenToggle } from './FullscreenToggle';

function parseRound(v: string | null): RoundKey {
  if (v && (ROUND_KEYS as readonly string[]).includes(v)) return v as RoundKey;
  return 'prelim';
}
function parseStep(v: string | null): StepKey {
  if (v && (STEP_KEYS as readonly string[]).includes(v)) return v as StepKey;
  return 'prep';
}

export function DashboardShell({ meta, templateId }: { meta: ContestMeta; templateId: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullscreen, setFullscreen] = useState(false);

  const round = parseRound(searchParams.get('round'));
  const requestedStep = parseStep(searchParams.get('step'));

  // 결승은 일부 스텝만 존재 → 현재 round에서 허용되지 않으면 첫 스텝으로 폴백
  const allowedSteps = meta.rounds[round].steps;
  const step: StepKey = allowedSteps.includes(requestedStep) ? requestedStep : allowedSteps[0];
  const isStepInvalidForRound = !allowedSteps.includes(requestedStep);

  const updateParams = useCallback(
    (next: { round?: RoundKey; step?: StepKey }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.round) params.set('round', next.round);
      if (next.step) params.set('step', next.step);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const onRoundSelect = useCallback(
    (next: RoundKey) => {
      // Design §7.2 — 라운드 변경 시 해당 라운드의 첫 스텝으로 자동 이동
      updateParams({ round: next, step: meta.rounds[next].steps[0] });
    },
    [meta, updateParams]
  );

  const onStepSelect = useCallback(
    (next: StepKey) => {
      updateParams({ step: next });
    },
    [updateParams]
  );

  const { result, loading, error, lastUpdated, refresh } = useSheetPoll({
    contestId: meta.contestId,
    round,
    step,
  });

  const stepLabel = useMemo(() => `${meta.rounds[round].label} · ${step.toUpperCase()}`, [meta, round, step]);

  // 키보드 단축키: 1/2/3 = 라운드, ←/→ = 스텝, F = 풀스크린 토글, Esc는 FullscreenToggle에서 처리
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // input/textarea/contenteditable 안에서는 무시
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '1') {
        e.preventDefault();
        onRoundSelect('prelim');
      } else if (e.key === '2') {
        e.preventDefault();
        onRoundSelect('semi');
      } else if (e.key === '3') {
        e.preventDefault();
        onRoundSelect('final');
      } else if (e.key === 'ArrowLeft') {
        const idx = allowedSteps.indexOf(step);
        if (idx > 0) {
          e.preventDefault();
          onStepSelect(allowedSteps[idx - 1]);
        }
      } else if (e.key === 'ArrowRight') {
        const idx = allowedSteps.indexOf(step);
        if (idx >= 0 && idx < allowedSteps.length - 1) {
          e.preventDefault();
          onStepSelect(allowedSteps[idx + 1]);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setFullscreen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allowedSteps, step, onRoundSelect, onStepSelect]);

  // Design §11.2 — 풀스크린: 표출 모니터에서 SVG가 화면 전체에 fit.
  // 메뉴는 작고 흐릿하게 보이고, 마우스 hover/포커스 시 선명해짐.
  if (fullscreen) {
    return (
      <main className="fixed inset-0 bg-bg flex items-center justify-center">
        {!isStepInvalidForRound && result ? (
          <TemplateRenderer templateId={templateId} round={round} step={step} data={result.payload} fit="viewport" />
        ) : (
          <div className="text-center text-sm text-ink2">로딩 중…</div>
        )}
        {/* 상단 중앙: 작은 미니 네비 (라운드 + 스텝) */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
          <MiniNav
            meta={meta}
            round={round}
            step={step}
            onRoundSelect={onRoundSelect}
            onStepSelect={onStepSelect}
          />
        </div>
        {/* 우상단: 풀스크린 해제 */}
        <div className="absolute top-2 right-2 opacity-25 hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
          <FullscreenToggle active={fullscreen} onToggle={() => setFullscreen(false)} />
        </div>
        {/* 좌상단: Live 인디케이터 (Live 단계에만) */}
        {step === 'live' ? (
          <div className="absolute top-2 left-2 opacity-40 hover:opacity-100 transition-opacity z-10">
            <LiveIndicator loading={loading} lastUpdated={lastUpdated} />
          </div>
        ) : null}
        {/* 하단 중앙: 키보드 힌트 */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-mono text-ink2 opacity-20 hover:opacity-80 transition-opacity z-10 select-none">
          1/2/3 · ← → · F · Esc
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-[1480px] mx-auto">
      <header className="flex items-end justify-between gap-4 flex-wrap pb-4 border-b border-border mb-5">
        <div>
          <Link href="/" className="text-xs text-ink2 hover:text-ink">
            ← 대회 목록
          </Link>
          <h1 className="text-xl font-semibold tracking-tight mt-1">
            {meta.name}
          </h1>
          <p className="text-xs text-ink2 font-mono uppercase tracking-widest mt-0.5">
            {meta.contestId} · TEMPLATE {templateId} · {stepLabel}
          </p>
          <p className="text-[10px] font-mono text-ink2 opacity-60 mt-1" title="키보드 단축키">
            ⌨ 1/2/3 라운드 · ← → 스텝 · F 풀스크린
          </p>
        </div>
        <div className="flex items-center gap-3">
          {step === 'pairing' && round !== 'final' ? (
            <button
              type="button"
              onClick={() => refresh()}
              disabled={loading}
              title="시트에서 페어링 데이터를 다시 가져와 표시. 시트를 박제한 직후 또는 새 페어링이 확정되었을 때 클릭"
              className="px-3 py-1.5 rounded border border-accent2 bg-panel text-xs font-mono tracking-widest text-accent hover:bg-accent2 hover:text-bg transition-colors disabled:opacity-40"
            >
              {loading ? 'LOADING…' : '↻ 조회'}
            </button>
          ) : null}
          {step === 'live' ? <LiveIndicator loading={loading} lastUpdated={lastUpdated} /> : null}
          <FullscreenToggle active={fullscreen} onToggle={() => setFullscreen(true)} />
        </div>
      </header>

      <div className="space-y-3 mb-5">
        <RoundNav meta={meta} current={round} onSelect={onRoundSelect} />
        <StepNav meta={meta} round={round} currentStep={step} onSelect={onStepSelect} />
      </div>

      <section
        className="rounded-xl border border-border bg-panel overflow-hidden"
        aria-live={step === 'live' ? 'polite' : 'off'}
      >
        {/* Design §11.2 — 결승 Pairing처럼 미존재 스텝 진입 시 EmptyState */}
        {isStepInvalidForRound ? (
          <div className="p-6">
            <EmptyState
              title={`${meta.rounds[round].label}에는 ${requestedStep.toUpperCase()} 단계가 없습니다`}
              description={
                requestedStep === 'pairing' && round === 'final'
                  ? '결승 페어링은 운영자가 현장에서 직접 매칭합니다. 다른 스텝을 선택하세요.'
                  : '다른 스텝을 선택하세요.'
              }
            />
          </div>
        ) : error ? (
          <div className="p-6">
            <EmptyState
              variant="error"
              title="데이터를 불러오지 못했습니다"
              description={error}
            />
          </div>
        ) : !result ? (
          <div className="p-12 text-center text-sm text-ink2">로딩 중…</div>
        ) : (
          <TemplateRenderer
            templateId={templateId}
            round={round}
            step={step}
            data={result.payload}
          />
        )}
      </section>
    </main>
  );
}
