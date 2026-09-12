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
  // WOLF 에서 토큰을 들고 넘어온 경우 폼 대신 '입장 중' 화면을 보여준다.
  const [entering, setEntering] = useState(false);

  // 이미 로그인돼 있으면 라운드 화면으로.
  // WOLF(worldoflatinfestivals.com) 에서 '심사하러 가기' 로 넘어왔으면 주소에 서명 토큰이 붙어 있다
  //   → 등록도 PIN 도 묻지 않고 그대로 입장시킨다.
  // 둘 다 아니면 다른 대회에서 쓰던 심사위원 번호를 채워준다 — 계정은 대회를 가리지 않으므로 그대로 통한다.
  useEffect(() => {
    if (getSession(contestId)) {
      router.replace(`/ovote/${encodeURIComponent(contestId)}/rounds`);
      return;
    }
    // useSearchParams 대신 window 에서 읽는다 — 이 화면 하나 때문에 Suspense 경계를 두지 않으려고.
    const token = new URLSearchParams(window.location.search).get('t');
    if (token) {
      // 주소에서 토큰을 바로 지운다. 새로고침하면 만료된 토큰으로 다시 실패하고,
      // 주소창에 남은 토큰이 어깨너머로 새어 나갈 이유도 없다.
      window.history.replaceState(null, '', `/ovote/${encodeURIComponent(contestId)}`);
      void enterWithToken(token);
      return;
    }
    setIdentifier((cur) => cur || getLastIdentifier());
    // enterWithToken 은 이 컴포넌트 안에서만 쓰이고 contestId 에만 의존한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId, router]);

  /** WOLF 토큰으로 입장 — 성공하면 로그인과 똑같이 세션을 세우고 라운드로 간다. */
  async function enterWithToken(token: string) {
    setEntering(true);
    setError(null);
    try {
      const res = await fetch(`/api/ovote/${encodeURIComponent(contestId)}/sso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.data) {
        // 실패하면 아래 로그인 폼이 그대로 보인다 — 번호와 PIN 이 있는 사람은 바로 들어갈 수 있다.
        setError(
          j.error === 'EXPIRED'
            ? 'WOLF 에서 받은 입장 링크가 만료되었습니다. WOLF 페이지에서 다시 눌러 주세요.'
            : j.error === 'CONTEST_CLOSED'
              ? '종료된 대회입니다.'
              : j.error === 'SSO_DISABLED'
                ? '지금은 WOLF 바로 입장을 쓸 수 없습니다. 아래에서 로그인하거나 등록해 주세요.'
                : 'WOLF 회원 확인에 실패했습니다. 아래에서 로그인하거나 등록해 주세요.',
        );
        return;
      }
      setSession(contestId, {
        judgeId: j.data.judgeId,
        name: j.data.name,
        displayOrder: j.data.displayOrder,
        judgeNo: j.data.judgeNo ?? null,
      });
      if (j.data.judgeNo) setLastIdentifier(String(j.data.judgeNo));
      router.replace(`/ovote/${encodeURIComponent(contestId)}/rounds`);
    } catch {
      setError('네트워크 오류');
    } finally {
      setEntering(false);
    }
  }

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
          {entering ? (
            'WOLF 회원 확인 중입니다. 잠시만 기다려 주세요…'
          ) : (
            <>
              심사위원 번호(또는 이메일)와 4자리 PIN으로 로그인하세요.
              <br />
              이 대회에 따로 등록하지 않으셨어도 그대로 로그인하시면 됩니다.
            </>
          )}
        </p>
      </header>

      {/* 확인이 끝날 때까지 폼을 내린다 — 곧 화면이 넘어갈 자리에 입력칸을 띄워 두면
          쓰지 않아도 될 번호를 찾아 헤매게 된다. 실패하면 그대로 폼이 돌아온다. */}
      {!entering && (
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
      )}
    </main>
  );
}
