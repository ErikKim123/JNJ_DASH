// MC 상단 실시간 통과/동점 배너 — 어느 탭에 있어도 "지금 몇 명이 통과권인지 · 동점이 났는지" 를 항상 보여준다.
//   관리자 화면 우하단 라이브 카운터(JudgingMatrix)와 같은 정보를 모바일 헤더 아래에 고정.
'use client';

import { ROUND_LABEL } from './labels';
import { useStandings } from './standingsContext';

function hhmmss(ts: number): string {
  return new Date(ts).toLocaleTimeString('ko-KR', { hour12: false });
}

export function TieBanner() {
  const { round, data, loading, error, updatedAt, auto, setAuto, reload, ties, tieCount, counts, overQuota, openTie } =
    useStandings();

  if (error && !data) {
    return (
      <div className="border-b border-danger/40 bg-danger/10 px-4 py-2 text-[11px] text-danger">
        순위 조회 실패 — {error}{' '}
        <button type="button" onClick={() => void reload()} className="underline ml-1">
          다시 시도
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="border-b border-border bg-panel/80 px-4 py-2 text-[11px] text-ink2">순위 조회 중…</div>
    );
  }
  if (data.leader.entries.length + data.follower.entries.length === 0) return null;

  const committed = data.committed;
  const show = (c: { live: number; confirmed: number }) => (committed ? c.confirmed : c.live);
  const label = committed ? '통과 확정' : round === 'final' ? '시상 · 실시간' : '현재 통과 · 실시간';
  // 확정 전 동점 = 즉시 처리해야 할 경고. 확정 후에도 원표 동점은 남으므로 톤만 낮춰 계속 알린다.
  const needsResolve = ties.length > 0 && !committed;
  const alert = needsResolve || overQuota;

  return (
    <div
      className={`border-b px-4 py-2 ${
        alert ? 'border-danger/50 bg-danger/10' : 'border-border bg-panel/80'
      }`}
      aria-live="polite"
    >
      <div className="max-w-md mx-auto">
        {/* 라이브 카운터 */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-ink2 shrink-0">
            {label} · {ROUND_LABEL[round].ko}
          </span>
          <span className="flex-1" />
          <span className="font-mono text-sm flex items-baseline gap-1">
            <span className={show(counts.leader) > data.maxPerRole && !committed ? 'text-danger font-bold' : 'text-ok font-bold'}>
              {show(counts.leader)}
            </span>
            <span className="text-ink2 text-[11px]">/ {data.maxPerRole} 리</span>
            <span className="text-ink2/40 px-1">·</span>
            <span className={show(counts.follower) > data.maxPerRole && !committed ? 'text-danger font-bold' : 'text-ok font-bold'}>
              {show(counts.follower)}
            </span>
            <span className="text-ink2 text-[11px]">/ {data.maxPerRole} 팔</span>
          </span>
        </div>

        {/* 동점 경고 + 추려내기 진입 */}
        {ties.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`text-[11px] font-semibold leading-tight flex-1 ${
                needsResolve ? 'text-danger' : 'text-ink2'
              }`}
            >
              {needsResolve ? '⚠ ' : '✓ '}
              {overQuota ? '동점으로 정원 초과' : committed ? '동점 추려내기 확정됨' : '경계 동점'} — {tieCount}명 동점
              {ties.map((r) => ` · ${r.role === 'leader' ? '리더' : '팔로워'} ${r.tie!.slots}자리`).join('')}
            </span>
            <button
              type="button"
              onClick={openTie}
              className={`shrink-0 min-h-[38px] rounded-lg border px-3 text-[11px] font-semibold ${
                needsResolve
                  ? 'border-accent bg-accent text-[#1A1612] active:bg-accent2'
                  : 'border-border bg-panel text-ink2 active:bg-bg2'
              }`}
            >
              ⚖ {needsResolve ? '동점 추려내기' : '다시 추려내기'}
            </button>
          </div>
        )}

        {/* 조회 상태 — 자동 5초 + 수동 ↻ */}
        <div className="mt-1 flex items-center gap-2 text-[10px] text-ink2">
          <button
            type="button"
            onClick={() => setAuto(!auto)}
            aria-pressed={auto}
            className={`rounded border px-1.5 py-0.5 font-mono ${
              auto ? 'border-ok/50 bg-ok/10 text-ok' : 'border-border text-ink2'
            }`}
          >
            {auto ? '● 자동 5초' : '○ 자동 꺼짐'}
          </button>
          <span>{updatedAt ? `조회 ${hhmmss(updatedAt)}` : '—'}</span>
          {loading && <span className="text-accent">갱신중…</span>}
          {error && <span className="text-danger truncate">{error}</span>}
          <span className="flex-1" />
          <button type="button" onClick={() => void reload()} className="text-accent font-mono active:opacity-60">
            ↻ 조회
          </button>
        </div>
      </div>
    </div>
  );
}
