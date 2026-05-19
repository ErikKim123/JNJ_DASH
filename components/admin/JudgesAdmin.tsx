'use client';

// Judges registry — 통합 단일 명단 UI.
//   한 번의 add/edit/delete 가 prelim/semi/final 3 라운드에 자동 mirror.
//   DB 스키마는 라운드별 분리 그대로 유지 — 매핑 키는 (contest_id, display_order).
//
// 핵심:
//   add  : POST /admin/contests/[id]/judges       → 3 row 동시 생성
//   patch: PATCH /admin/contests/[id]/judges/[id] → 같은 display_order 의 3 row 동시 갱신
//   del  : DELETE /admin/contests/[id]/judges/[id]→ 같은 display_order 의 3 row 동시 삭제
//
// display_order 직접 편집은 차단 (3 row swap 시 unique 충돌). 순서 변경 필요 시 삭제→재추가.
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Field, Input, Select, Textarea } from './ui';
import type { JudgeRow, JudgeTargetRole } from '@/lib/db/types';

type VoteCount = Record<string, number>;

const TARGET_LABEL: Record<JudgeTargetRole, string> = {
  leader: 'Leader',
  follower: 'Follower',
  both: 'All',
};

/** 한 명의 심사위원 — 동일 display_order 의 prelim/semi/final row 묶음. */
export interface JudgeGroup {
  display_order: number;
  /** canonical row — prelim 우선. 프로필 필드의 source of truth. */
  canonical: JudgeRow;
  /** 그룹에 속한 모든 라운드의 judge.id (mirror 대상 식별용). */
  ids: string[];
}

export function JudgesAdmin({
  contestId,
  initial,
  voteCounts,
}: {
  contestId: string;
  initial: JudgeGroup[];
  voteCounts: VoteCount;
}) {
  const router = useRouter();
  const [groups, setGroups] = useState<JudgeGroup[]>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const apiBase = `/api/admin/contests/${encodeURIComponent(contestId)}/judges`;

  function addJudge() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Add failed (${res.status})`);
        return;
      }
      setName('');
      // mirror 결과는 라운드별 row 3개 → 페이지 데이터 재로드가 깔끔.
      router.refresh();
    });
  }

  function patchJudge(group: JudgeGroup, patch: Partial<JudgeRow>) {
    startTransition(async () => {
      const res = await fetch(`${apiBase}/${group.canonical.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Update failed (${res.status})`);
        router.refresh();
        return;
      }
      const j = await res.json();
      setGroups((s) => s.map((g) =>
        g.display_order === group.display_order
          ? { ...g, canonical: { ...g.canonical, ...j.data } }
          : g
      ));
    });
  }

  function deleteJudge(group: JudgeGroup) {
    const total = group.ids.reduce((sum, id) => sum + (voteCounts[id] ?? 0), 0);
    const msg = total > 0
      ? `Delete judge "${group.canonical.name}"? Removes the judge from every round and erases ${total} vote(s)/score(s) recorded across prelim/semi/final.`
      : `Delete judge "${group.canonical.name}"? Removes the judge from prelim, semi, and final.`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await fetch(`${apiBase}/${group.canonical.id}`, { method: 'DELETE' });
      if (!res.ok) { setError(`Delete failed (${res.status})`); return; }
      setGroups((s) => s.filter((g) => g.display_order !== group.display_order));
      if (expandedOrder === group.display_order) setExpandedOrder(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded border border-border bg-panel">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg2/50 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">Judges</h3>
            <Badge tone="info">{groups.length} judges</Badge>
            <span className="text-xs text-ink2">예선 · 본선 · 결승 모두 동일 명단으로 자동 등록</span>
          </div>
        </header>

        {error && (
          <div className="px-4 py-2 text-sm text-danger bg-danger/5 border-b border-danger/20" role="alert">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg2 text-ink2 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 w-10"></th>
                <th className="text-left px-3 py-2 w-16">#</th>
                <th className="text-left px-3 py-2 min-w-[8rem]">Name</th>
                <th className="text-left px-3 py-2 min-w-[8rem]">Alias</th>
                <th className="text-left px-3 py-2 min-w-[10rem]">Specialty</th>
                <th className="text-left px-3 py-2 w-24">Target</th>
                <th className="text-left px-3 py-2 w-20">Max&nbsp;O</th>
                <th className="text-left px-3 py-2 w-24">Activity</th>
                <th className="text-right px-3 py-2 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-ink2 py-8">
                    No judges registered yet.
                  </td>
                </tr>
              )}
              {groups.map((g) => (
                <JudgeRowEditor
                  key={g.display_order}
                  group={g}
                  voteCount={g.ids.reduce((sum, id) => sum + (voteCounts[id] ?? 0), 0)}
                  pending={pending}
                  expanded={expandedOrder === g.display_order}
                  onToggle={() => setExpandedOrder(expandedOrder === g.display_order ? null : g.display_order)}
                  onPatch={(p) => patchJudge(g, p)}
                  onDelete={() => deleteJudge(g)}
                />
              ))}
            </tbody>
            <tfoot className="border-t border-border bg-bg2/30">
              <tr>
                <td className="px-3 py-3" colSpan={3}>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addJudge(); } }}
                    placeholder="New judge name (then Enter)"
                    className="w-full"
                  />
                </td>
                <td className="px-3 py-3 text-xs text-ink2" colSpan={5}>
                  Order auto-assigned to {(groups.at(-1)?.display_order ?? 0) + 1}. 한 번 추가하면 예선·본선·결승에 동시 등록됩니다.
                </td>
                <td className="px-3 py-3 text-right">
                  <Button variant="primary" onClick={addJudge} disabled={pending || !name.trim()}>
                    + Add
                  </Button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p className="text-xs text-ink2">
        💡 한 명의 심사위원이 예선·본선·결승을 모두 심사합니다. 이름·별칭·전문·연락처·Max O 등 모든 프로필 편집은
        세 라운드에 자동 동기화되며, 삭제 시에도 세 라운드의 모든 vote 와 함께 제거됩니다. Activity 는 세 라운드 합산 값입니다.
      </p>
    </div>
  );
}

function JudgeRowEditor({
  group,
  voteCount,
  pending,
  expanded,
  onToggle,
  onPatch,
  onDelete,
}: {
  group: JudgeGroup;
  voteCount: number;
  pending: boolean;
  expanded: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<JudgeRow>) => void;
  onDelete: () => void;
}) {
  const judge = group.canonical;
  // local mirror — autosave on blur
  const [d, setD] = useState({
    name: judge.name,
    alias: judge.alias,
    specialty: judge.specialty,
    target_role: judge.target_role,
    career: judge.career,
    phone: judge.phone,
    email: judge.email,
    memo: judge.memo,
    max_votes: judge.max_votes,
  });

  function commit<K extends keyof typeof d>(field: K, value: (typeof d)[K]) {
    if (value === judge[field as keyof JudgeRow]) return;
    onPatch({ [field]: value } as Partial<JudgeRow>);
  }

  const targetTone = useMemo(() => {
    if (judge.target_role === 'leader') return 'info' as const;
    if (judge.target_role === 'follower') return 'neutral' as const;
    return 'warn' as const;
  }, [judge.target_role]);

  return (
    <>
      <tr className={`border-t border-border ${expanded ? 'bg-accent/5' : ''}`}>
        <td className="px-3 py-2 text-center">
          <button
            type="button"
            onClick={onToggle}
            className="text-ink2 hover:text-accent text-sm w-6 h-6 inline-flex items-center justify-center rounded border border-border"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        </td>
        <td className="px-2 py-2">
          <span className="inline-block w-14 font-mono text-center text-ink2">{group.display_order}</span>
        </td>
        <td className="px-2 py-2">
          <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })}
            onBlur={() => { const v = d.name.trim(); if (!v) setD({ ...d, name: judge.name }); else commit('name', v); }}
            className="w-full" />
        </td>
        <td className="px-2 py-2">
          <Input value={d.alias} onChange={(e) => setD({ ...d, alias: e.target.value })}
            onBlur={() => commit('alias', d.alias)} className="w-full" placeholder="—" />
        </td>
        <td className="px-2 py-2">
          <Input value={d.specialty} onChange={(e) => setD({ ...d, specialty: e.target.value })}
            onBlur={() => commit('specialty', d.specialty)} className="w-full" placeholder="—" />
        </td>
        <td className="px-2 py-2">
          <Select
            value={d.target_role}
            onChange={(e) => {
              const v = e.target.value as JudgeTargetRole;
              setD({ ...d, target_role: v });
              commit('target_role', v);
            }}
            className="w-full"
          >
            <option value="both">All</option>
            <option value="leader">Leader</option>
            <option value="follower">Follower</option>
          </Select>
        </td>
        <td className="px-2 py-2">
          <Input
            type="number" min={0} max={999}
            value={d.max_votes ?? ''}
            onChange={(e) => setD({ ...d, max_votes: e.target.value === '' ? null : Number(e.target.value) })}
            onBlur={() => commit('max_votes', d.max_votes)}
            placeholder="∞"
            className="w-16 font-mono text-center"
          />
        </td>
        <td className="px-3 py-2 text-xs">
          {voteCount > 0
            ? <span className="text-ok">{voteCount} vote{voteCount === 1 ? '' : 's'}</span>
            : <span className="text-ink2/50">none</span>}
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex justify-end gap-1">
            <Button onClick={onToggle} disabled={pending}>{expanded ? 'Close' : 'Edit'}</Button>
            <Button variant="danger" onClick={onDelete} disabled={pending}>Del</Button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-border bg-bg2/40">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Career" hint="Brief résumé / notable wins">
                <Textarea
                  value={d.career}
                  onChange={(e) => setD({ ...d, career: e.target.value })}
                  onBlur={() => commit('career', d.career)}
                  rows={3}
                  placeholder="2015 World B-Boy Champion · Pop ..."
                />
              </Field>
              <div className="grid grid-cols-1 gap-3">
                <Field label="Phone">
                  <Input value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })}
                    onBlur={() => commit('phone', d.phone)} placeholder="010-1234-5678" />
                </Field>
                <Field label="Email">
                  <Input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })}
                    onBlur={() => commit('email', d.email)} placeholder="judge@example.com" />
                </Field>
              </div>
              <Field label="Memo" hint="Internal notes (e.g. chair, panel role)">
                <Textarea
                  value={d.memo}
                  onChange={(e) => setD({ ...d, memo: e.target.value })}
                  onBlur={() => commit('memo', d.memo)}
                  rows={3}
                  placeholder="Head judge · panel chair"
                />
              </Field>
              <div className="text-xs text-ink2 space-y-1 self-end">
                <p>
                  <span className="text-ink2/60">Target →</span>{' '}
                  <Badge tone={targetTone}>{TARGET_LABEL[judge.target_role]}</Badge>{' '}
                  <span className="text-ink2/60">— who this judge evaluates</span>
                </p>
                <p>
                  <span className="text-ink2/60">Max O votes →</span>{' '}
                  <span className="font-mono">{judge.max_votes ?? '∞'}</span>{' '}
                  <span className="text-ink2/60">— cap per round (blank = unlimited)</span>
                </p>
                <p className="pt-1 text-ink2/60">
                  순서 변경은 현재 UI 에서 비활성화 — 변경하려면 삭제 후 재추가.
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
