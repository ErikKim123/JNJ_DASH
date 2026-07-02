'use client';

// /ovote/[contestId]/rounds — 로그인한 온라인 심사위원의 라운드 선택.
//   online_judge_rounds 에 포함되고 해당 라운드 상태가 OPEN/LIVE 인 라운드만 활성화.
//   현재 결승만 구현 → 예선/본선은 (설정과 무관하게) 비활성 처리하고 안내.
import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ROUND_LABEL,
  ROUND_LIFECYCLE_LABEL,
  isRoundInteractive,
  type RoundLifecycle,
} from '@/lib/vote/sheet-schema';
import { OVoteTopNav } from '@/components/ovote/OVoteTopNav';
import { getSession, clearSession, type OJudgeSession } from '@/lib/ovote/session';

type Round = 'prelim' | 'semi' | 'final';

interface State {
  contestName: string;
  onlineRounds: Round[];
  roundStatus: Record<Round, RoundLifecycle>;
}

export default function OVoteRoundsPage({
  params,
}: {
  params: Promise<{ contestId: string }>;
}) {
  const { contestId } = use(params);
  const router = useRouter();
  const [session, setSessionState] = useState<OJudgeSession | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback((judgeId: string) => {
    setLoading(true);
    fetch(`/api/ovote/${encodeURIComponent(contestId)}/state?judgeId=${encodeURIComponent(judgeId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!j.data) { setError(j.error ?? '불러오기 실패'); return; }
        setError(null);
        setState({
          contestName: j.data.contestName ?? '',
          onlineRounds: j.data.onlineRounds ?? [],
          roundStatus: j.data.roundStatus,
        });
      })
      .catch(() => setError('네트워크 오류'))
      .finally(() => setLoading(false));
  }, [contestId]);

  useEffect(() => {
    const s = getSession(contestId);
    if (!s) {
      router.replace(`/ovote/${encodeURIComponent(contestId)}`);
      return;
    }
    setSessionState(s);
    load(s.judgeId);
  }, [contestId, router, load]);

  function logout() {
    clearSession(contestId);
    router.replace(`/ovote/${encodeURIComponent(contestId)}`);
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        padding: 'var(--jnj-space-6) var(--jnj-space-5)',
        maxWidth: 640,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--jnj-space-6)',
      }}
    >
      <OVoteTopNav
        back="/ovote/competitions"
        loading={loading}
        onRefresh={() => session && load(session.judgeId)}
        judgeName={session?.name}
        judgeNo={session?.displayOrder}
        onLogout={logout}
      />

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--jnj-space-2)' }}>
        {state?.contestName && (
          <span className="jnj-small" style={{ color: 'var(--jnj-text-secondary)', letterSpacing: '0.06em' }}>
            {contestId} · {state.contestName}
          </span>
        )}
        <span className="jnj-small" style={{ color: 'var(--jnj-text-secondary)', letterSpacing: '0.08em' }}>ROUND</span>
        <h1 className="jnj-display" style={{ fontSize: 'clamp(36px, 9vw, 64px)', margin: 0 }}>
          SELECT ROUND
        </h1>
      </section>

      {error && (
        <p role="alert" className="jnj-body-medium" style={{ color: 'var(--jnj-red)' }}>{error}</p>
      )}

      {state && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--jnj-space-3)' }}>
          {(['prelim', 'semi', 'final'] as Round[]).map((round) => (
            <RoundButton
              key={round}
              contestId={contestId}
              round={round}
              enabledForOnline={state.onlineRounds.includes(round)}
              status={state.roundStatus[round]}
              implemented={round === 'final'}
            />
          ))}
        </section>
      )}
    </main>
  );
}

function RoundButton({
  contestId,
  round,
  enabledForOnline,
  status,
  implemented,
}: {
  contestId: string;
  round: Round;
  enabledForOnline: boolean;
  status: RoundLifecycle;
  implemented: boolean;
}) {
  const interactive = isRoundInteractive(status);
  // 활성 조건: 온라인 라운드 설정 ON + 구현됨 + 상태 OPEN/LIVE.
  const clickable = enabledForOnline && implemented && interactive;

  let note: string;
  if (!enabledForOnline) note = '온라인 심사 비활성';
  else if (!implemented) note = '준비 중';
  else if (!interactive) note = ROUND_LIFECYCLE_LABEL[status];
  else note = ROUND_LIFECYCLE_LABEL[status];

  const variant = status === 'live' && clickable ? 'jnj-btn jnj-btn-primary' : 'jnj-btn jnj-btn-secondary';
  const style: React.CSSProperties = {
    width: '100%',
    padding: 'var(--jnj-space-4) var(--jnj-space-6)',
    justifyContent: 'space-between',
    opacity: clickable ? 1 : 0.45,
    cursor: clickable ? undefined : 'not-allowed',
  };
  const inner = (
    <>
      <span style={{ letterSpacing: '0.08em' }}>{ROUND_LABEL[round]}</span>
      <span style={{ fontFamily: 'var(--jnj-font-text)', fontWeight: 400, fontSize: 'var(--jnj-size-small)', opacity: 0.8 }}>
        {note}
      </span>
    </>
  );

  if (!clickable) {
    return <button type="button" className={variant} style={style} disabled aria-disabled>{inner}</button>;
  }
  return (
    <Link href={`/ovote/${encodeURIComponent(contestId)}/${round}`} className={variant} style={style}>
      {inner}
    </Link>
  );
}
