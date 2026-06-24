'use client';

// 통과자 관리. 라운드(prelim/semi) 별 동일 컴포넌트.
//
// 핵심 액션:
//   - [참가자에서 가져오기]: contest 의 participants 풀에서 미등록 인원을 추가 (passed=false 로).
//   - 행 단위: 통과 토글 / 표시순위 / 투표수 / 역할 / 사진 편집.
//   - 일괄 확정 (보여진 행 전부 passed=true).
import { Fragment, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Input, Select } from './ui';
import type { ParticipantRow, ParticipantRole, QualifierRow } from '@/lib/db/types';

const ROLE_LABEL: Record<ParticipantRole, string> = {
  leader: 'Leader',
  follower: 'Follower',
  helper_leader: 'Helper (Leader)',
  helper_follower: 'Helper (Follower)',
};

export function QualifiersPanel({
  contestId,
  round,
  initial,
  participants,
  maxPerRole,
}: {
  contestId: string;
  round: 'prelim' | 'semi';
  initial: QualifierRow[];
  participants: ParticipantRow[];
  maxPerRole: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<QualifierRow[]>(initial);
  const [sortBy, setSortBy] = useState<'votes' | 'order' | 'role' | 'name' | 'num'>('votes');
  const [refreshing, setRefreshing] = useState(false);

  // 서버 컴포넌트가 listQualifiersWithLiveVotes 로 judge_votes 의 O 카운트를 합산하므로,
  // router.refresh() 만으로 최신 votes/passed 가 다시 계산되어 내려온다.
  function refreshData() {
    setError(null);
    setRefreshing(true);
    startTransition(() => {
      router.refresh();
      // router.refresh 는 awaitable 이 아니라 짧은 지연 후 인디케이터 해제
      setTimeout(() => setRefreshing(false), 600);
    });
  }

  // initial prop 이 router.refresh 후 갱신되면 로컬 rows 를 동기화.
  useEffect(() => {
    setRows(initial);
  }, [initial]);

  const apiBase = `/api/admin/contests/${encodeURIComponent(contestId)}/qualifiers/${round}`;
  const roundLabel = round === 'prelim' ? 'Prelim' : 'Semi';

  const sortedRows = useMemo(() => {
    const list = rows.slice();
    const byNum = (a: QualifierRow, b: QualifierRow) =>
      a.participant_num.localeCompare(b.participant_num, undefined, { numeric: true });
    switch (sortBy) {
      case 'order':
        // display_order asc → votes desc → num
        list.sort((a, b) => (a.display_order - b.display_order) || (b.votes - a.votes) || byNum(a, b));
        break;
      case 'votes':
        // votes desc → display_order asc → num
        list.sort((a, b) => (b.votes - a.votes) || (a.display_order - b.display_order) || byNum(a, b));
        break;
      case 'role':
        // role (leader 우선) → votes desc → num
        list.sort((a, b) => a.role.localeCompare(b.role) || (b.votes - a.votes) || byNum(a, b));
        break;
      case 'name':
        // team_name (ko collation) → votes desc → num
        list.sort((a, b) => a.team_name.localeCompare(b.team_name, 'ko') || (b.votes - a.votes) || byNum(a, b));
        break;
      case 'num':
        // participant_num (numeric asc)
        list.sort(byNum);
        break;
    }
    return list;
  }, [rows, sortBy]);

  // 라이브 통과 판정 — commit 로직과 동일한 Olympic 랭킹 (boundary tie 포함).
  // qualifiers.passed (stale) 가 아니라 현재 votes 기준으로 "지금 commit 하면 어떻게 될지" 를 보여준다.
  const liveWouldPass = useMemo(() => {
    const set = new Set<string>(); // `${role}:${num}`
    for (const role of ['leader', 'follower'] as const) {
      const list = rows
        .filter((r) => r.role === role && r.votes > 0)
        .sort((a, b) =>
          b.votes - a.votes ||
          a.participant_num.localeCompare(b.participant_num, undefined, { numeric: true })
        );
      let lastVotes = -1;
      let lastRank = 0;
      for (let i = 0; i < list.length; i++) {
        if (list[i].votes !== lastVotes) {
          lastRank = i + 1;
          lastVotes = list[i].votes;
        }
        if (lastRank <= maxPerRole) set.add(`${role}:${list[i].participant_num}`);
      }
    }
    return set;
  }, [rows, maxPerRole]);

  const summary = useMemo(() => {
    let passedLeaders = 0;
    let passedFollowers = 0;
    for (const r of rows) {
      if (!liveWouldPass.has(`${r.role}:${r.participant_num}`)) continue;
      if (r.role === 'leader') passedLeaders++;
      else if (r.role === 'follower') passedFollowers++;
    }
    return {
      total: rows.length,
      passed: passedLeaders + passedFollowers,
      passedLeaders,
      passedFollowers,
    };
  }, [rows, liveWouldPass]);

  function updateRow(id: string, patch: Partial<QualifierRow>) {
    setRows((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    startTransition(async () => {
      const res = await fetch(`${apiBase}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Update failed (${res.status})`);
        router.refresh();
      }
    });
  }

  function deleteRow(id: string, num: string) {
    if (!confirm(`Delete ${roundLabel} qualifier entry for #${num}?`)) return;
    startTransition(async () => {
      const res = await fetch(`${apiBase}/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError(`Delete failed (${res.status})`);
        return;
      }
      setRows((s) => s.filter((r) => r.id !== id));
      router.refresh();
    });
  }

  function importFromParticipants() {
    const existing = new Set(rows.map((r) => r.participant_num));
    const toAdd = participants
      .filter((p) => !existing.has(p.num))
      .filter((p) => p.role === 'leader' || p.role === 'follower')
      .map((p) => ({
        participant_num: p.num,
        team_name: p.team_name,
        representative: p.representative,
        role: p.role,
        photo_url: p.photo_url,
        passed: false,
        votes: 0,
        display_order: 0,
      }));
    if (toAdd.length === 0) {
      setError('All participants are already registered.');
      return;
    }
    if (!confirm(`Add ${toAdd.length} participants as ${roundLabel} qualifier candidates?`)) return;
    startTransition(async () => {
      for (const q of toAdd) {
        const res = await fetch(apiBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(q),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error ?? `Add failed (${res.status})`);
          break;
        }
        const j = await res.json();
        setRows((s) => [...s, j.data]);
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="text-sm text-ink2 flex items-center gap-3 flex-wrap">
          <span>Total <span className="text-ink font-semibold">{summary.total}</span></span>
          <span>Passed {summary.passed}</span>
          <span>· Leaders {summary.passedLeaders}/{maxPerRole}</span>
          <span>· Followers {summary.passedFollowers}/{maxPerRole}</span>
          {(summary.passedLeaders > maxPerRole || summary.passedFollowers > maxPerRole) && (
            <Badge tone="warn">Over capacity — review ties</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-widest text-ink2">Sort</label>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="w-40"
          >
            <option value="votes">Votes (desc)</option>
            <option value="order">Order</option>
            <option value="role">Role</option>
            <option value="name">Team Name</option>
            <option value="num">Num</option>
          </Select>
          <Button
            onClick={refreshData}
            disabled={pending || refreshing}
            title="judge_votes 의 최신 O 카운트를 다시 가져와 votes/passed 를 재계산"
          >
            {refreshing ? '…' : '↻ 조회'}
          </Button>
          <Button variant="primary" onClick={importFromParticipants} disabled={pending}>
            + Import from Participants
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger mb-3" role="alert">{error}</p>
      )}

      <div className="rounded border border-border bg-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg2 text-ink2 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2 w-12">#</th>
              <th className="text-left px-3 py-2 w-16">Pass</th>
              <th className="text-left px-3 py-2 w-20">Num</th>
              <th className="text-left px-3 py-2">Team</th>
              <th className="text-left px-3 py-2 w-28">Role</th>
              <th className="text-left px-3 py-2 w-24">Votes (live)</th>
              <th className="text-left px-3 py-2 w-20">Order</th>
              <th className="text-right px-3 py-2 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* 같은 라운드 안에서 role 별 ranking 으로 정원 안 강조. votes desc 기준 상위 maxPerRole. */}
            {(() => {
              // role 별 ranking 맵 (vote desc → in-quota 표시)
              const rankByNum = new Map<string, number>();
              for (const role of ['leader', 'follower'] as const) {
                const list = rows.filter((r) => r.role === role)
                  .slice()
                  .sort((a, b) => (b.votes - a.votes) || a.participant_num.localeCompare(b.participant_num, undefined, { numeric: true }));
                list.forEach((r, i) => rankByNum.set(`${r.role}:${r.participant_num}`, i + 1));
              }
              const renderRow = (r: QualifierRow, seq: number) => {
                const rank = rankByNum.get(`${r.role}:${r.participant_num}`) ?? 999;
                const inQuota = rank <= maxPerRole;
                return (
                  <tr key={r.id} className={`border-t border-border ${inQuota ? 'bg-ok/[0.04]' : ''}`}>
                    <td className="px-3 py-2 font-mono text-ink2/60">{seq}</td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={r.passed}
                        onChange={(e) => updateRow(r.id, { passed: e.target.checked })}
                        disabled={pending}
                        className="w-4 h-4 accent-accent"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono">{r.participant_num}</td>
                    <td className="px-3 py-2">{r.team_name}</td>
                    <td className="px-2 py-1">
                      <Select
                        value={r.role}
                        onChange={(e) => updateRow(r.id, { role: e.target.value as ParticipantRole })}
                        className="w-full"
                      >
                        {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <span className={`font-mono ${inQuota ? 'text-accent font-semibold' : 'text-ink2'}`}>
                        {r.votes}
                      </span>
                      <span className="text-ink2/50 text-xs ml-1">#{rank}</span>
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number" min={0}
                        value={r.display_order}
                        onChange={(e) => updateRow(r.id, { display_order: Number(e.target.value) })}
                        className="w-full"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="danger" onClick={() => deleteRow(r.id, r.participant_num)} disabled={pending}>
                        Del
                      </Button>
                    </td>
                  </tr>
                );
              };
              // 리더 / 팔로워 섹션으로 구분. 순번은 역할별로 1부터. (그 외 역할은 마지막 섹션)
              const groups: { key: string; label: string; rows: QualifierRow[] }[] = [
                { key: 'leader', label: ROLE_LABEL.leader, rows: sortedRows.filter((r) => r.role === 'leader') },
                { key: 'follower', label: ROLE_LABEL.follower, rows: sortedRows.filter((r) => r.role === 'follower') },
              ];
              const other = sortedRows.filter((r) => r.role !== 'leader' && r.role !== 'follower');
              if (other.length) groups.push({ key: 'other', label: 'Other', rows: other });
              return groups.map((g) => g.rows.length === 0 ? null : (
                <Fragment key={g.key}>
                  <tr className="bg-bg2/60 border-t-2 border-accent/30">
                    <td colSpan={8} className="px-3 py-1.5 text-xs font-semibold text-accent uppercase tracking-wider">
                      {g.label}
                      <span className="ml-2 text-ink2 normal-case font-normal">
                        · {g.rows.length}{g.key !== 'other'
                          ? ` · pass ${g.rows.filter((r) => liveWouldPass.has(`${g.key}:${r.participant_num}`)).length}/${maxPerRole}`
                          : ''}
                      </span>
                    </td>
                  </tr>
                  {g.rows.map((r, i) => renderRow(r, i + 1))}
                </Fragment>
              ));
            })()}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-ink2 py-8">
                  No {roundLabel} qualifiers with votes yet. Enter scores in <strong>{roundLabel} Judging</strong> first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink2 mt-3">
        💡 Only candidates who received at least one O vote in <strong>{roundLabel} Judging</strong> are listed here — those are the actual qualifiers.
        Rows highlighted (rank ≤ {maxPerRole}) are within capacity. Use Pass to confirm the final list (auto-fills on the RESULT display when unchecked).
      </p>
    </div>
  );
}
