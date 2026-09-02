'use client';

// /ovote/[contestId] — 관객 심사위원 로그인 (등록 번호/이메일 + 4자리 PIN).
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getLastIdentifier, getSession, setLastIdentifier, setSession } from '@/lib/ovote/session';

export default function OVoteLoginPage({
  params,
}: {
  params: Promise<{ contestId: string }>;
}) {
  const { contestId } = use(params);
  const router = useRouter();
  const [contestName, setContestName] = useState<string>('');
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이미 로그인돼 있으면 라운드 화면으로.
  // 아니면 다른 대회에서 쓰던 심사위원 번호를 채워준다 — 계정은 대회를 가리지 않으므로 그대로 통한다.
  useEffect(() => {
    if (getSession(contestId)) {
      router.replace(`/ovote/${encodeURIComponent(contestId)}/rounds`);
      return;
    }
    setIdentifier((cur) => cur || getLastIdentifier());
  }, [contestId, router]);

  // 대회명 표시용.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ovote/${encodeURIComponent(contestId)}/state`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j.data) setContestName(j.data.contestName ?? ''); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [contestId]);

  async function login() {
    if (!identifier.trim() || !/^\d{4}$/.test(pin)) {
      setError('등록 번호(또는 이메일)와 4자리 PIN을 입력하세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/ovote/${encodeURIComponent(contestId)}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), pin }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.data) {
        setError(
          j.error === 'INVALID_CREDENTIALS'
            ? '번호/이메일 또는 PIN이 올바르지 않습니다.'
            : j.error === 'PIN_INVALID'
              ? 'PIN은 숫자 4자리입니다.'
              : j.error === 'CONTEST_CLOSED'
                ? '종료된 대회입니다.'
                : `로그인 실패 (${res.status})`,
        );
        return;
      }
      setSession(contestId, {
        judgeId: j.data.judgeId,
        name: j.data.name,
        displayOrder: j.data.displayOrder,
        judgeNo: j.data.judgeNo ?? null,
      });
      // 다음 대회에서 미리 채워줄 값 — 전역 번호가 있으면 그걸 우선(대회별 번호는 다른 대회에서 안 통한다).
      setLastIdentifier(j.data.judgeNo ? String(j.data.judgeNo) : identifier.trim());
      router.replace(`/ovote/${encodeURIComponent(contestId)}/rounds`);
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        padding: 'var(--jnj-space-7) var(--jnj-space-5)',
        maxWidth: 480,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--jnj-space-6)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--jnj-space-2)' }}>
        <Link
          href="/ovote/competitions"
          className="jnj-small"
          style={{ color: 'var(--jnj-text-secondary)', textDecoration: 'none', letterSpacing: '0.06em' }}
        >
          ← Competitions
        </Link>
        {(contestName || contestId) && (
          <span className="jnj-small" style={{ color: 'var(--jnj-text-secondary)', letterSpacing: '0.06em' }}>
            {contestId}{contestName ? ` · ${contestName}` : ''}
          </span>
        )}
        <h1 className="jnj-display" style={{ fontSize: 'clamp(40px, 10vw, 72px)', margin: 0 }}>
          JUDGE LOGIN
        </h1>
        <p className="jnj-body" style={{ color: 'var(--jnj-text-secondary)', margin: 0 }}>
          심사위원 번호(또는 이메일)와 4자리 PIN으로 로그인하세요.
          <br />
          이 대회에 따로 등록하지 않으셨어도 그대로 로그인하시면 됩니다.
        </p>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--jnj-space-4)' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--jnj-space-2)' }}>
          <span className="jnj-small" style={{ color: 'var(--jnj-text-secondary)', letterSpacing: '0.06em' }}>
            심사위원 번호 또는 이메일
          </span>
          <input
            className="jnj-input"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="예: 100123 또는 name@example.com"
            autoComplete="username"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--jnj-space-2)' }}>
          <span className="jnj-small" style={{ color: 'var(--jnj-text-secondary)', letterSpacing: '0.06em' }}>
            PIN (숫자 4자리)
          </span>
          <input
            className="jnj-input"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={(e) => { if (e.key === 'Enter') login(); }}
            inputMode="numeric"
            type="tel"
            maxLength={4}
            placeholder="0000"
            autoComplete="current-password"
            style={{ letterSpacing: '0.4em', fontWeight: 700 }}
          />
        </label>

        {error && (
          <p role="alert" className="jnj-body-medium" style={{ color: 'var(--jnj-red)', margin: 0 }}>
            {error}
          </p>
        )}

        <button
          type="button"
          className="jnj-btn jnj-btn-primary"
          disabled={busy}
          onClick={login}
          style={{ padding: 'var(--jnj-space-3) var(--jnj-space-5)' }}
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </section>
    </main>
  );
}
