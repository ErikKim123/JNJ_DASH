'use client';

// admin 영역 공용 UI 프리미티브 — 디자인 토큰(panel/border/accent) 재사용으로 통일감.
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', className = '', children, ...rest },
  ref
) {
  const base =
    'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
  const v: Record<Variant, string> = {
    primary: 'bg-accent text-bg hover:bg-accent2',
    secondary: 'border border-border bg-bg2 hover:border-accent hover:text-accent',
    danger: 'border border-danger/40 text-danger hover:bg-danger/10',
    ghost: 'text-ink2 hover:text-ink',
  };
  return (
    <button ref={ref} className={`${base} ${v[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`rounded border border-border bg-bg2 px-2 py-1.5 text-sm focus:outline-none focus:border-accent ${className}`}
        {...rest}
      />
    );
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={`rounded border border-border bg-bg2 px-2 py-1.5 text-sm focus:outline-none focus:border-accent ${className}`}
        {...rest}
      >
        {children}
      </select>
    );
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={`rounded border border-border bg-bg2 px-2 py-1.5 text-sm focus:outline-none focus:border-accent ${className}`}
        {...rest}
      />
    );
  }
);

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-widest text-ink2">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink2">{hint}</span>}
    </label>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'info';
}) {
  const tones: Record<string, string> = {
    neutral: 'border-border text-ink2',
    ok: 'border-ok/40 text-ok',
    warn: 'border-accent/40 text-accent',
    danger: 'border-danger/40 text-danger',
    info: 'border-info/40 text-info',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 pb-4 border-b border-border flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink2 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Tabs({
  items,
  current,
}: {
  items: { href: string; label: string; badge?: string | number }[];
  current: string;
}) {
  return (
    <nav className="flex items-center gap-1 mb-4 border-b border-border">
      {items.map((it) => {
        const active = it.href === current;
        return (
          <a
            key={it.href}
            href={it.href}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition ${
              active
                ? 'border-accent text-ink'
                : 'border-transparent text-ink2 hover:text-ink'
            }`}
          >
            {it.label}
            {it.badge != null && (
              <span className="ml-1.5 text-xs text-ink2">({it.badge})</span>
            )}
          </a>
        );
      })}
    </nav>
  );
}
