// MC 모바일 콘솔 셸 — 하단 탭(화면전환 / 예선 / 본선 / 결승) + 상단 대회 헤더 + 실시간 통과/동점 배너.
'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { RoundKey, StepKey } from '@/lib/sheets/types';
import type { ExtraVideos } from '@/lib/contest/extraVideos';
import { ScreenControl } from './ScreenControl';
import { RoundControl } from './RoundControl';
import { FinalControl } from './FinalControl';
import { FollowToggle } from './FollowToggle';
import { StandingsProvider } from './standings';
import { TieBanner } from './TieBanner';

type Tab = 'screen' | 'prelim' | 'semi' | 'final';

const TABS: { key: Tab; label: string }[] = [
  { key: 'screen', label: '화면전환' },
  { key: 'prelim', label: '예선' },
  { key: 'semi', label: '본선' },
  { key: 'final', label: '결승' },
];

export function MCConsole({
  contestId,
  contestName,
  initialRound,
  initialStep,
  initialFollow,
  extraVideos,
}: {
  contestId: string;
  contestName: string;
  initialRound: RoundKey | null;
  initialStep: StepKey | null;
  initialFollow: boolean;
  /** 라운드별 추가 영상 3칸 — 표출 오버레이를 MC 가 원격으로 띄우는 데 사용. */
  extraVideos: ExtraVideos;
}) {
  const [tab, setTab] = useState<Tab>('screen');
  // 표출 포인터 — ScreenControl 이 바꾸고, 동점 배너가 "지금 어느 라운드를 볼지" 정하는 데도 쓴다.
  const [round, setRound] = useState<RoundKey>(initialRound ?? 'prelim');
  const [step, setStep] = useState<StepKey>(initialStep ?? 'prep');

  // 감시 라운드 — 심사 탭에 있으면 그 라운드, 화면전환 탭이면 지금 표출 중인 라운드.
  const watchRound: RoundKey = tab === 'screen' ? round : tab;

  return (
    <StandingsProvider contestId={contestId} round={watchRound}>
      <div className="min-h-screen bg-bg text-ink">
        {/* 상단 헤더 */}
        <header className="sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-border">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Link href="/mc" className="text-[10px] text-ink2">← 대회목록</Link>
              <h1 className="text-sm font-semibold truncate">{contestName}</h1>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <FollowToggle contestId={contestId} initialFollow={initialFollow} />
              <a
                href={`/dashboard/${encodeURIComponent(contestId)}?follow=1`}
                target="_blank"
                rel="noopener"
                className="shrink-0 rounded-lg border border-accent2 bg-panel px-3 py-2 text-[11px] font-mono tracking-widest text-accent active:bg-accent2 active:text-bg"
              >
                표출 ↗
              </a>
            </div>
          </div>
          {/* 실시간 통과 인원 · 동점 경고 — 탭과 무관하게 항상 노출 */}
          <TieBanner />
        </header>

        {/* 본문 — 하단 탭바 높이만큼 패딩 */}
        <main className="px-4 py-4 pb-28 space-y-4 max-w-md mx-auto">
          {tab === 'screen' && (
            <ScreenControl
              contestId={contestId}
              round={round}
              step={step}
              setRound={setRound}
              setStep={setStep}
              extraVideos={extraVideos}
            />
          )}
          {tab === 'prelim' && <RoundControl contestId={contestId} round="prelim" />}
          {tab === 'semi' && <RoundControl contestId={contestId} round="semi" />}
          {tab === 'final' && <FinalControl contestId={contestId} />}
        </main>

        {/* 하단 탭바 */}
        <nav className="fixed bottom-0 inset-x-0 z-20 bg-panel/95 backdrop-blur border-t border-border grid grid-cols-4 max-w-md mx-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`py-3.5 text-xs font-semibold tracking-wide transition ${
                tab === t.key ? 'text-accent' : 'text-ink2 active:text-ink'
              }`}
            >
              {t.label}
              <span
                className={`block mx-auto mt-1 h-0.5 w-8 rounded-full transition ${
                  tab === t.key ? 'bg-accent' : 'bg-transparent'
                }`}
              />
            </button>
          ))}
        </nav>
      </div>
    </StandingsProvider>
  );
}
