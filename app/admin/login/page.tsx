'use client';

// /admin/login — ADMIN_PIN 입력. 성공 시 ?next= 경로로 리다이렉트, 없으면 /admin.
import { useState, useTransition, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/admin';
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      if (res.status === 401) setError('Incorrect PIN.');
      else setError(`Login failed (${res.status})`);
      setPin('');
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-border bg-panel p-8 shadow-xl"
      >
        <h1 className="text-2xl font-semibold tracking-tight mb-1">
          JNJ <span className="text-accent">Admin</span>
        </h1>
        <p className="text-sm text-ink2 mb-6">Enter the operations PIN</p>

        <label className="block text-xs uppercase tracking-widest text-ink2 mb-2">PIN</label>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-md border border-border bg-bg2 px-3 py-2 text-base font-mono tracking-widest focus:outline-none focus:border-accent"
          required
        />

        {error && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !pin}
          className="mt-6 w-full rounded-md bg-accent text-bg font-semibold py-2 hover:bg-accent2 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? 'Verifying…' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
