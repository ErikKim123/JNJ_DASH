// Design Ref: §11.2 — 결승 Pairing 우회 진입, 빈 시트 등 비정상 상태 표시
import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  variant = 'info',
  action,
}: {
  title: string;
  description?: string;
  variant?: 'info' | 'error';
  action?: ReactNode;
}) {
  const isError = variant === 'error';
  return (
    <div
      className={`rounded-xl border p-8 text-center ${
        isError ? 'border-danger/40 bg-danger/5 text-danger' : 'border-border bg-panel text-ink2'
      }`}
    >
      <p className={`text-base font-semibold mb-2 ${isError ? 'text-danger' : 'text-ink'}`}>
        {title}
      </p>
      {description ? <p className="text-sm">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
