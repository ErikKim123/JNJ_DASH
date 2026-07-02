'use client';

// /ovote/[contestId]/final — 로그인한 온라인 심사위원의 결승 채점 (VOTE 앱과 동일 UX).
//   · 점수는 로컬 draft 로 편집 → 하단 SAVE(중간 저장) / Submit(최종 제출·잠금).
//   · Submit 후 잠금(수정 불가, 카드 녹색). Edit 로 잠금 해제.
//   · final_status 가 OPEN/LIVE 이고 online_judge_rounds 에 final 포함일 때만 입력 가능.
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScoreInput, isValidScore } from '@/components/vote/ScoreInput';
import {
  ROUND_LIFECYCLE_LABEL,
  isRoundInteractive,
  type RoundLifecycle,
} from '@/lib/vote/sheet-schema';
import { OVoteTopNav } from '@/components/ovote/OVoteTopNav';
import { getSession, clearSession, type OJudgeSession } from '@/lib/ovote/session';

interface ScoringItem { key: string; label: string; column: string }
interface Finalist { num: string; name: string; role: 'leader' | 'follower'; photoUrl: string }
interface StateData {
  contestName: string;
  onlineEnabled: boolean;
  onlineRounds: string[];
  roundStatus: { prelim: RoundLifecycle; semi: RoundLifecycle; final: RoundLifecycle };
  scoringItems: ScoringItem[];
  finalists: Finalist[];
  myVotes: Record<string, Record<string, number | null>>;
  submittedAt: string | null;
}

type Draft = Record<string, Record<string, number | null>>; // num -> column -> value

export default function OVoteFinalPage({
  params,
}: {
  params: Promise<{ contestId: string }>;
}) {
  const { contestId } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<OJudgeSession | null>(null);
  const [data, setData] = useState<StateData | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const draftRef = useRef<Draft>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => { draftRef.current = draft; }, [draft]);

  const load = useCallback((judgeId: string) => {
    setLoading(true);
    fetch(`/api/ovote/${encodeURIComponent(contestId)}/state?judgeId=${encodeURIComponent(judgeId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!j.data) { setError(j.error ?? '불러오기 실패'); return; }
        setError(null);
        const d = j.data as StateData;
        setData(d);
        // draft 시드 — 기존 점수 우선, 없으면 null(ScoreInput 이 기본 5 로 시드).
        const seed: Draft = {};
        for (const f of d.finalists) {
          const row: Record<string, number | null> = {};
          for (const it of d.scoringItems) row[it.column] = d.myVotes[f.num]?.[it.column] ?? null;
          seed[f.num] = row;
        }
        setDraft(seed);
        setLocked(Boolean(d.submittedAt));
      })
      .catch(() => setError('네트워크 오류'))
      .finally(() => setLoading(false));
  }, [contestId]);

  useEffect(() => {
    const s = getSession(contestId);
    if (!s) { router.replace(`/ovote/${encodeURIComponent(contestId)}`); return; }
    setSession(s);
    load(s.judgeId);
  }, [contestId, router, load]);

  const roundOpen = useMemo(() => {
    if (!data) return false;
    if (!data.onlineEnabled || !data.onlineRounds.includes('final')) return false;
    return isRoundInteractive(data.roundStatus.final);
  }, [data]);

  // 입력 잠금 = 라운드 닫힘 OR 제출 완료.
  const inputsDisabled = !roundOpen || locked;

  const validCount = useMemo(() => {
    if (!data) return 0;
    return data.finalists.filter((f) =>
      data.scoringItems.every((it) => isValidScore(draft[f.num]?.[it.column] ?? null)),
    ).length;
  }, [data, draft]);
  const total = data?.finalists.length ?? 0;
  const allValid = total > 0 && validCount === total;

  function setCell(num: string, column: string, value: number | null) {
    setDraft((s) => ({ ...s, [num]: { ...(s[num] ?? {}), [column]: value } }));
  }

  function collectEntries() {
    if (!data) return [];
    const cur = draftRef.current;
    return data.finalists.map((f) => {
      const row = cur[f.num] ?? {};
      const e: Record<string, unknown> = { participant_num: f.num };
      for (const it of data.scoringItems) e[it.column] = row[it.column] ?? null;
      return e;
    });
  }

  async function handleSave() {
    if (!session || inputsDisabled) return;
    setSaving(true); setError(null); setNotice(null);
    // ScoreInput 의 기본값 시드(onChange) 가 반영되도록 살짝 양보.
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/ovote/${encodeURIComponent(contestId)}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ judgeId: session.judgeId, submitted: false, entries: collectEntries() }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { setError(errMsg(j.error, res.status)); return; }
        setNotice('저장되었습니다.');
      } catch { setError('네트워크 오류'); }
      finally { setSaving(false); }
    }, 120);
  }

  async function handleSubmit() {
    if (!session || inputsDisabled) return;
    if (!allValid) { setError('모든 진출자의 점수를 입력하세요.'); return; }
    if (!window.confirm('결승 점수를 제출할까요?\n\n제출 후에는 Edit 을 눌러야 수정할 수 있습니다.')) return;
    setSubmitting(true); setError(null); setNotice(null);
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/ovote/${encodeURIComponent(contestId)}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ judgeId: session.judgeId, submitted: true, entries: collectEntries() }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { setError(errMsg(j.error, res.status)); return; }
        setLocked(true);
        setNotice('제출 완료되었습니다.');
      } catch { setError('네트워크 오류'); }
      finally { setSubmitting(false); }
    }, 120);
  }

  function logout() {
    clearSession(contestId);
    router.replace(`/ovote/${encodeURIComponent(contestId)}`);
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        padding: 'var(--jnj-space-5) var(--jnj-space-4) calc(var(--jnj-space-10) + env(safe-area-inset-bottom, 0px))',
        maxWidth: 720,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--jnj-space-5)',
      }}
    >
      <OVoteTopNav
        back={`/ovote/${encodeURIComponent(contestId)}/rounds`}
        loading={loading}
        onRefresh={() => session && load(session.judgeId)}
        judgeName={session?.name}
        judgeNo={session?.displayOrder}
        onLogout={logout}
      />

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--jnj-space-2)' }}>
        <span className="jnj-small" style={{ color: 'var(--jnj-text-secondary)', letterSpacing: '0.08em' }}>ROUND</span>
        <h1 className="jnj-display" style={{ fontSize: 'clamp(40px, 11vw, 88px)', margin: 0 }}>FINAL</h1>
        {total > 0 && (
          <span className="jnj-small" style={{ color: 'var(--jnj-text-secondary)', letterSpacing: '0.06em' }}>
            {validCount} / {total}
          </span>
        )}
      </section>

      {error && <p role="alert" className="jnj-body-medium" style={{ color: 'var(--jnj-red)' }}>{error}</p>}
      {notice && <p className="jnj-body-medium" style={{ color: 'var(--jnj-green, #00A859)' }}>{notice}</p>}

      {data && !roundOpen && (
        <div
          role="status"
          style={{
            padding: 'var(--jnj-space-3) var(--jnj-space-4)',
            borderRadius: 'var(--jnj-radius-md)',
            border: '1px solid var(--jnj-red)',
            background: 'var(--jnj-red-50)',
            color: 'var(--jnj-red)',
            fontFamily: 'var(--jnj-font-text-medium)',
            fontSize: 'var(--jnj-size-small)',
          }}
        >
          {!data.onlineEnabled || !data.onlineRounds.includes('final')
            ? '이 대회는 온라인 결승 심사가 활성화되어 있지 않습니다.'
            : `결승이 ${ROUND_LIFECYCLE_LABEL[data.roundStatus.final]} 상태입니다 — 입력이 잠겨 있습니다.`}
        </div>
      )}

      {data && data.finalists.length === 0 && (
        <p className="jnj-body" style={{ color: 'var(--jnj-text-secondary)' }}>결승 진출자가 아직 확정되지 않았습니다.</p>
      )}

      {data && data.finalists.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--jnj-space-5)' }}>
          {data.finalists.map((f) => {
            const row = draft[f.num] ?? {};
            const sum = data.scoringItems.reduce((acc, it) => acc + (typeof row[it.column] === 'number' ? (row[it.column] as number) : 0), 0);
            const maxTotal = 10 * data.scoringItems.length;
            return (
              <li
                key={f.num}
                style={{
                  padding: 'var(--jnj-space-4)',
                  borderRadius: 'var(--jnj-radius-lg)',
                  border: `1.5px solid ${locked ? 'var(--jnj-green, #00A859)' : 'var(--jnj-grey-200)'}`,
                  background: locked ? 'var(--jnj-green-50, #E6F7EF)' : 'var(--jnj-white)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--jnj-space-3)',
                  transition: 'border-color var(--jnj-transition), background var(--jnj-transition)',
                }}
              >
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--jnj-space-3)' }}>
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--jnj-space-3)' }}>
                    <Avatar url={f.photoUrl} number={f.num} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--jnj-space-2)', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--jnj-font-display)', fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 500, lineHeight: 1 }}>
                        #{f.num}
                      </span>
                      <RoleBadge role={f.role} />
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--jnj-font-display)', fontSize: 32, lineHeight: 1, color: locked ? 'var(--jnj-green, #00A859)' : 'var(--jnj-text-primary)' }}>
                    {sum}
                    <span style={{ fontFamily: 'var(--jnj-font-text-medium)', fontSize: 'var(--jnj-size-small)', letterSpacing: '0.08em', marginLeft: 6, color: 'var(--jnj-text-secondary)' }}>
                      /{maxTotal}
                    </span>
                  </div>
                </header>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols(data.scoringItems.length)}, minmax(0, 1fr))`, gap: 'var(--jnj-space-3)' }}>
                  {data.scoringItems.map((it) => (
                    <ScoreInput
                      key={it.key}
                      label={it.label}
                      value={row[it.column] ?? null}
                      disabled={inputsDisabled}
                      onChange={(n) => setCell(f.num, it.column, n)}
                    />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.finalists.length > 0 && roundOpen && (
        <div
          style={{
            position: 'sticky',
            bottom: 'env(safe-area-inset-bottom, 0px)',
            marginInline: 'calc(-1 * var(--jnj-space-4))',
            padding: 'var(--jnj-space-3) var(--jnj-space-4) calc(var(--jnj-space-3) + env(safe-area-inset-bottom, 0px))',
            background: 'var(--jnj-white)',
            boxShadow: '0px -1px 0px 0px var(--jnj-grey-200) inset',
            display: 'flex',
            gap: 'var(--jnj-space-2)',
          }}
        >
          {locked ? (
            // 제출 후에는 본인이 다시 열 수 없음 — 관리자가 해제해야 수정 가능.
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 'var(--jnj-space-3)',
                borderRadius: 'var(--jnj-radius-md)',
                border: '1px solid var(--jnj-green, #00A859)',
                background: 'var(--jnj-green-50, #E6F7EF)',
                color: 'var(--jnj-green, #00A859)',
                fontFamily: 'var(--jnj-font-text-medium)',
                fontSize: 'var(--jnj-size-small)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              제출 완료 · 수정하려면 관리자에게 문의하세요
            </div>
          ) : (
            <>
              <button type="button" className="jnj-btn jnj-btn-secondary" onClick={handleSave} disabled={saving || submitting} style={{ flex: 1 }}>
                {saving ? 'Saving…' : 'SAVE'}
              </button>
              <button type="button" className="jnj-btn jnj-btn-primary" onClick={handleSubmit} disabled={saving || submitting || !allValid} style={{ flex: 1 }}>
                {submitting ? 'Submitting…' : `Submit (${validCount}/${total})`}
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}

function errMsg(error: string | undefined, status: number): string {
  if (error === 'ROUND_LOCKED') return '결승 심사가 잠겨 있습니다.';
  if (error === 'JUDGE_NOT_IN_CONTEST') return '로그인이 만료되었습니다. 다시 로그인하세요.';
  return `요청 실패 (${status})`;
}

function cols(n: number): number {
  if (n <= 1) return 1;
  if (n === 2 || n === 4) return 2;
  if (n === 3 || n === 5 || n === 6) return 3;
  return 4;
}

function RoleBadge({ role }: { role: 'leader' | 'follower' }) {
  const isLeader = role === 'leader';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: isLeader ? 'var(--jnj-text-primary)' : 'var(--jnj-white)',
        color: isLeader ? 'var(--jnj-white)' : 'var(--jnj-text-primary)',
        border: '1px solid var(--jnj-text-primary)',
        fontFamily: 'var(--jnj-font-text-medium)',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.06em',
        padding: '2px 8px',
        borderRadius: 'var(--jnj-radius-pill)',
        textTransform: 'uppercase',
      }}
    >
      {isLeader ? 'LEADER' : 'FOLLOWER'}
    </span>
  );
}

function Avatar({ url, number }: { url: string; number: string }) {
  const size = 56;
  const common: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    border: '1px solid var(--jnj-grey-200)', overflow: 'hidden',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--jnj-grey-200)', color: 'var(--jnj-text-primary)',
    fontFamily: 'var(--jnj-font-display)', fontSize: Math.round(size * 0.4), fontWeight: 500,
  };
  if (url) {
    return (
      <span style={common}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`#${number}`} width={size} height={size} loading="lazy" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </span>
    );
  }
  return <span style={common}>{number.replace(/^0+/, '') || number}</span>;
}
