// MC 콘솔 공용 UI 프리미티브 — 모바일 터치 타깃 크게, 다크 테마 토큰 사용.
'use client';

import { useCallback, useState } from 'react';
import type { DisplayCommand } from '@/lib/display/commands';

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'ok';

const BTN_TONE: Record<BtnVariant, string> = {
  primary: 'bg-accent text-[#1A1612] active:bg-accent2 border-accent',
  ok: 'bg-ok/20 text-ok border-ok/50 active:bg-ok/30',
  danger: 'bg-danger/15 text-danger border-danger/50 active:bg-danger/25',
  ghost: 'bg-panel text-ink border-border active:bg-bg2',
};

export function Btn({
  children,
  onClick,
  variant = 'ghost',
  disabled,
  className = '',
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[48px] rounded-xl border px-4 text-sm font-semibold tracking-wide transition disabled:opacity-40 ${BTN_TONE[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  title,
  children,
  right,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-panel p-4">
      {title ? (
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-mono uppercase tracking-widest text-ink2">{title}</h2>
          {right}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatusLine({ tone = 'ink2', children }: { tone?: 'ink2' | 'ok' | 'danger'; children: React.ReactNode }) {
  const c = tone === 'ok' ? 'text-ok' : tone === 'danger' ? 'text-danger' : 'text-ink2';
  return <p className={`text-xs mt-2 ${c}`} role="status">{children}</p>;
}

/** 비동기 액션 실행 훅 — pending/error/message 상태 관리. */
export function useMcAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(async (fn: () => Promise<string | void>) => {
    setPending(true);
    setError(null);
    try {
      const msg = await fn();
      if (typeof msg === 'string') setMessage(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }, []);

  return { pending, error, message, setMessage, run };
}

/** 표출(프로젝터)에 1회성 원격 명령 발행 — 조회 / 영상 재생·일시정지. */
export async function sendDisplayCmd(contestId: string, cmd: DisplayCommand): Promise<void> {
  await adminFetch(`/api/admin/contests/${encodeURIComponent(contestId)}/display-state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd }),
  });
}

/** 관리자 API 호출 — 봉투({data}|{error}) 해제. 실패 시 throw. */
export async function adminFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  let json: { data?: T; error?: string | null } | null = null;
  try { json = await res.json(); } catch { /* 본문 없음 */ }
  if (!res.ok || (json && json.error)) {
    throw new Error((json && json.error) || `요청 실패 (${res.status})`);
  }
  return (json?.data as T) ?? (json as unknown as T);
}
