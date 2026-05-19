'use client';

// 라운드별 진행 상태 컨트롤 — 시트의 "예선/본선/결승 · Live" 드롭다운 대체.
// 운영자가 즉시 변경하면 PATCH /api/admin/contests/[id] 호출, save 버튼 없이 autosave.
// 표출 화면 step 과 동일 어휘(prep|pairing|open|live|calculate|close|result) 사용.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { RoundStatus } from '@/lib/db/types';

const ROUND_STATUS_OPTIONS: { value: RoundStatus; label: string }[] = [
  { value: 'prep',      label: 'Prep' },
  { value: 'pairing',   label: 'Pairing' },
  { value: 'open',      label: 'Open' },
  { value: 'live',      label: 'Live' },
  { value: 'calculate', label: 'Calculate' },
  { value: 'close',     label: 'Close' },
  { value: 'result',    label: 'Result' },
];

// 상태별 색 — Live 가 가장 두드러지게.
const STATUS_TONE: Record<RoundStatus, string> = {
  prep:      'border-border bg-bg2 text-ink2',
  pairing:   'border-info/40 bg-info/10 text-info',
  open:      'border-info/40 bg-info/10 text-info',
  live:      'border-ok/40 bg-ok/15 text-ok',
  calculate: 'border-accent/40 bg-accent/10 text-accent',
  close:     'border-accent/40 bg-accent/10 text-accent',
  result:    'border-accent/40 bg-accent/15 text-accent',
};

interface InitialState {
  prelim_status: RoundStatus;
  semi_status: RoundStatus;
  final_status: RoundStatus;
}

export function RoundStatusBar({
  contestId,
  initial,
}: {
  contestId: string;
  initial: InitialState;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<InitialState>(initial);
  const [error, setError] = useState<string | null>(null);

  function patch(field: keyof InitialState, value: RoundStatus) {
    setState((s) => ({ ...s, [field]: value }));
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/contests/${encodeURIComponent(contestId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Save failed (${res.status})`);
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded border border-border bg-panel p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-widest text-ink2">Round Control</span>
        {pending && <span className="text-xs text-ink2">saving…</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <RoundCell label="Prelim" value={state.prelim_status} onChange={(v) => patch('prelim_status', v)} disabled={pending} />
        <RoundCell label="Semi"   value={state.semi_status}   onChange={(v) => patch('semi_status', v)}   disabled={pending} />
        <RoundCell label="Final"  value={state.final_status}  onChange={(v) => patch('final_status', v)}  disabled={pending} />
      </div>
      {error && <p className="text-xs text-danger mt-2" role="alert">{error}</p>}
    </div>
  );
}

function RoundCell({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: RoundStatus;
  onChange: (v: RoundStatus) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-widest text-ink2 w-14 shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RoundStatus)}
        disabled={disabled}
        className={`flex-1 rounded border px-2 py-1.5 text-sm font-semibold tracking-wide focus:outline-none focus:border-accent transition ${STATUS_TONE[value]}`}
      >
        {ROUND_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} className="bg-bg2 text-ink">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
