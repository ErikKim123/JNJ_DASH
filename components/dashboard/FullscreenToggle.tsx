// Design Ref: §11.2 — 표출 모니터에서 ChromeUI 숨기고 SVG만 풀화면. ESC로 해제.
'use client';

import { useEffect } from 'react';

export function FullscreenToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onToggle]);

  return (
    <button
      type="button"
      onClick={onToggle}
      className="px-3 py-1.5 rounded border border-border bg-panel text-xs font-mono tracking-widest text-ink2 hover:text-ink hover:border-accent2 transition-colors"
      title={active ? '풀스크린 해제 (ESC)' : '표출용 풀스크린'}
    >
      {active ? '⤢ EXIT' : '⤢ DISPLAY'}
    </button>
  );
}
