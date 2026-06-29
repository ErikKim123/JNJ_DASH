'use client';

// 심사위원 본인 전용 채점 화면 (모바일 우선).
//   final         : 활성 채점 항목별 숫자 입력
//   prelim / semi : O / X 토글 (·→O→X→·), 역할별 O 표 상한(maxPerRole) 적용
// 입력은 blur/토글 시 자동 저장. 하단 SUBMIT → submitted_at 설정 → 관리자 매트릭스 컬럼 녹색.
// 제출 후에는 입력 잠금. "수정하기"로 제출을 해제하면 다시 편집 가능.
import { useMemo, useState, useEffect, useRef } from 'react';
import type { JudgeRow, JudgeVoteRow, JudgingRound, VoteMark } from '@/lib/db/types';
import { resolveActiveDefs, type ScoringItemKey, type ScoringItemDef } from '@/lib/db/scoring';

export interface JudgeEligible {
  num: string;
  team_name: string;
  role: 'leader' | 'follower';
  isHelper: boolean;
}

const EMPTY_VOTE = (judgeId: string, num: string): JudgeVoteRow => ({
  id: '',
  judge_id: judgeId,
  participant_num: num,
  vote_mark: null,
  basic_score: null,
  connectivity_score: null,
  musicality_score: null,
  creativity_score: null,
  crowd_reaction_score: null,
  showmanship_score: null,
  updated_at: '',
});

export function JudgeScoring({
  contestId,
  round,
  contestName,
  judge,
  eligible,
  votes: initialVotes,
  scoringItems,
  maxPerRole,
}: {
  contestId: string;
  round: JudgingRound;
  contestName: string;
  judge: JudgeRow;
  eligible: JudgeEligible[];
  votes: JudgeVoteRow[];
  scoringItems?: readonly ScoringItemKey[];
  maxPerRole: number;
}) {
  const isFinal = round === 'final';
  const apiBase = `/api/judge/${encodeURIComponent(contestId)}/${round}/${judge.id}`;
  const activeDefs: ScoringItemDef[] = useMemo(() => resolveActiveDefs(scoringItems), [scoringItems]);

  const [votes, setVotes] = useState<Map<string, JudgeVoteRow>>(() => {
    const m = new Map<string, JudgeVoteRow>();
    for (const v of initialVotes) m.set(v.participant_num, v);
    return m;
  });
  const [submitted, setSubmitted] = useState(judge.submitted_at != null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);
  const [busy, setBusy] = useState(false);

  const roundLabel = round === 'prelim' ? '예선' : round === 'semi' ? '본선' : '결승';
  const L = '리더';
  const F = '팔로워';

  // 역할별 O 표 카운트 (prelim/semi 상한 체크)
  const oCount = useMemo(() => {
    let leader = 0, follower = 0;
    for (const e of eligible) {
      if (e.isHelper) continue;
      if (votes.get(e.num)?.vote_mark === 'O') (e.role === 'leader' ? leader++ : follower++);
    }
    return { leader, follower };
  }, [votes, eligible]);

  // 입력 완료 수 (진행률)
  const doneCount = useMemo(() => {
    let n = 0;
    for (const e of eligible) {
      const v = votes.get(e.num);
      if (isFinal) {
        if (v && activeDefs.every((d) => v[d.column] != null)) n++;
      } else if (v?.vote_mark != null) n++;
    }
    return n;
  }, [votes, eligible, isFinal, activeDefs]);

  async function setVote(num: string, patch: Partial<JudgeVoteRow>) {
    if (submitted) return;
    setError(null);
    const cur = votes.get(num) ?? EMPTY_VOTE(judge.id, num);
    const merged: JudgeVoteRow = { ...cur, ...patch, judge_id: judge.id, participant_num: num };
    setVotes((m) => new Map(m).set(num, merged));
    setSaving((s) => s + 1);
    try {
      const res = await fetch(`${apiBase}/votes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_num: num, ...patch }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error === 'ALREADY_SUBMITTED' ? '이미 제출되어 수정할 수 없습니다. "수정하기"를 눌러 주세요.' : (j.error ?? `저장 실패 (${res.status})`));
      } else {
        const j = await res.json();
        setVotes((m) => new Map(m).set(num, j.data));
      }
    } catch {
      setError('네트워크 오류 — 저장되지 않았습니다.');
    } finally {
      setSaving((s) => s - 1);
    }
  }

  function cycleMark(e: JudgeEligible) {
    if (submitted) return;
    const cur = votes.get(e.num)?.vote_mark ?? null;
    const next: VoteMark | null = cur == null ? 'O' : cur === 'O' ? 'X' : null;
    if (next === 'O' && !e.isHelper) {
      const count = e.role === 'leader' ? oCount.leader : oCount.follower;
      if (count >= maxPerRole) {
        setError(`${e.role === 'leader' ? L : F} O 표는 최대 ${maxPerRole}명까지 가능합니다.`);
        return;
      }
    }
    setVote(e.num, { vote_mark: next });
  }

  async function doSubmit() {
    const remaining = eligible.length - doneCount;
    if (remaining > 0 && !confirm(`아직 ${remaining}팀이 미입력입니다.\n그래도 제출할까요?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submitted: true }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? `제출 실패 (${res.status})`); return; }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally { setBusy(false); }
  }

  async function undoSubmit() {
    if (!confirm('제출을 해제하고 다시 편집할까요?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submitted: false }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? `해제 실패 (${res.status})`); return; }
      setSubmitted(false);
    } finally { setBusy(false); }
  }

  const leaders = eligible.filter((e) => e.role === 'leader');
  const followers = eligible.filter((e) => e.role === 'follower');

  return (
    <main className="min-h-dvh bg-bg text-ink pb-28">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-20 bg-bg2/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-xl mx-auto">
          <p className="text-[11px] font-mono uppercase tracking-wider text-ink2">{contestName} · {roundLabel} 채점</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-accent/40 text-accent text-[11px] font-mono">
              {judge.target_role === 'leader' ? L : judge.target_role === 'follower' ? F : 'ALL'}
            </span>
            <h1 className="text-lg font-semibold truncate">{judge.name} 심사위원</h1>
            <span className="ml-auto text-[11px] text-ink2">
              {saving > 0 ? '저장 중…' : '자동 저장됨'}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4">
        {error && (
          <p className="mt-3 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        {/* 제출 완료 배너 */}
        {submitted && (
          <div className="mt-4 rounded-lg border border-ok/50 bg-ok/15 px-4 py-4 text-center">
            <p className="text-ok text-xl font-bold">✓ 제출 완료</p>
            <p className="mt-1 text-sm text-ink2">채점이 관리자에게 제출되었습니다. 수정하려면 아래 버튼을 누르세요.</p>
            <button
              type="button"
              onClick={undoSubmit}
              disabled={busy}
              className="mt-3 rounded border border-border px-4 py-2 text-sm text-ink2 hover:border-accent hover:text-accent disabled:opacity-50"
            >
              수정하기 (제출 해제)
            </button>
          </div>
        )}

        {!submitted && (
          <p className="mt-3 text-sm text-ink2">
            {isFinal
              ? '각 팀의 항목별 점수를 입력한 뒤, 맨 아래 SUBMIT 버튼을 눌러 제출하세요.'
              : '각 팀을 눌러 O / X 를 선택한 뒤, 맨 아래 SUBMIT 버튼을 눌러 제출하세요.'}
          </p>
        )}

        {/* 채점 목록 */}
        <RoleSection title={L} count={leaders.length} />
        {leaders.map((e) => (
          <TeamCard key={e.num} e={e} L={L} F={F} isFinal={isFinal} defs={activeDefs}
            vote={votes.get(e.num)} disabled={submitted}
            onScore={(col, val) => setVote(e.num, { [col]: val } as Partial<JudgeVoteRow>)}
            onMark={() => cycleMark(e)} />
        ))}

        {followers.length > 0 && <RoleSection title={F} count={followers.length} />}
        {followers.map((e) => (
          <TeamCard key={e.num} e={e} L={L} F={F} isFinal={isFinal} defs={activeDefs}
            vote={votes.get(e.num)} disabled={submitted}
            onScore={(col, val) => setVote(e.num, { [col]: val } as Partial<JudgeVoteRow>)}
            onMark={() => cycleMark(e)} />
        ))}

        {eligible.length === 0 && (
          <p className="mt-8 text-center text-sm text-ink2">채점 대상이 아직 없습니다.</p>
        )}
      </div>

      {/* 하단 고정 SUBMIT */}
      {!submitted && eligible.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-20 bg-bg2/95 backdrop-blur border-t border-border px-4 py-3">
          <div className="max-w-xl mx-auto flex items-center gap-3">
            <span className="text-sm text-ink2 whitespace-nowrap">
              입력 <span className="text-ink font-semibold">{doneCount}</span>/{eligible.length}
            </span>
            <button
              type="button"
              onClick={doSubmit}
              disabled={busy || saving > 0}
              className="flex-1 rounded-lg bg-ok/90 hover:bg-ok px-4 py-3 text-center text-base font-bold text-black disabled:opacity-50"
            >
              {busy ? '제출 중…' : 'SUBMIT 제출하기'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function RoleSection({ title, count }: { title: string; count: number }) {
  return (
    <div className="mt-6 mb-2 flex items-center gap-2">
      <h2 className="text-sm font-semibold text-accent">{title}</h2>
      <span className="text-xs text-ink2">{count}팀</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function TeamCard({
  e, L, F, isFinal, defs, vote, disabled, onScore, onMark,
}: {
  e: JudgeEligible;
  L: string;
  F: string;
  isFinal: boolean;
  defs: ScoringItemDef[];
  vote: JudgeVoteRow | undefined;
  disabled: boolean;
  onScore: (column: ScoringItemDef['column'], value: number | null) => void;
  onMark: () => void;
}) {
  const mark = vote?.vote_mark ?? null;
  return (
    <div className="mb-2 rounded-lg border border-border bg-panel px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-ink2">{e.num}</span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono ${e.role === 'leader' ? 'border-info/40 text-info' : 'border-border text-ink2'}`}>
          {e.role === 'leader' ? L : F}
        </span>
        {e.isHelper && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-accent/40 text-accent text-[10px] font-mono">헬퍼</span>
        )}
        <span className="font-medium truncate">{e.team_name}</span>
      </div>

      {isFinal ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {defs.map((d) => (
            <ScoreField
              key={d.key}
              label={d.korLabel}
              value={(vote?.[d.column] as number | null | undefined) ?? null}
              disabled={disabled}
              onCommit={(n) => onScore(d.column, n)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onMark}
            disabled={disabled}
            className={`flex-1 h-12 rounded-lg border text-lg font-bold transition disabled:opacity-60 ${
              mark === 'O' ? 'bg-ok/20 text-ok border-ok/50' :
              mark === 'X' ? 'bg-danger/20 text-danger border-danger/50' :
              'bg-bg2 text-ink2 border-border'
            }`}
          >
            {mark ?? '· 탭하여 선택 (O / X)'}
          </button>
        </div>
      )}
    </div>
  );
}

function ScoreField({
  label, value, disabled, onCommit,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onCommit: (v: number | null) => void;
}) {
  const [v, setV] = useState<string>(value == null ? '' : String(value));
  const focusedRef = useRef(false);
  useEffect(() => {
    if (focusedRef.current) return;
    setV(value == null ? '' : String(value));
  }, [value]);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-ink2 text-center">{label}</span>
      <input
        inputMode="decimal"
        disabled={disabled}
        value={v}
        onFocus={() => { focusedRef.current = true; }}
        onChange={(ev) => setV(ev.target.value)}
        onBlur={() => {
          focusedRef.current = false;
          const s = v.trim();
          if (s === '') { if (value != null) onCommit(null); }
          else {
            const n = Number(s);
            if (Number.isFinite(n) && n !== value) onCommit(n);
            else setV(value == null ? '' : String(value));
          }
        }}
        className="w-full h-12 rounded-lg border border-border bg-bg2 text-center text-lg focus:outline-none focus:border-accent disabled:opacity-60"
      />
    </label>
  );
}
