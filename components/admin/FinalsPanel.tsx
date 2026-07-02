'use client';

// 결승 결과 — 리더/팔로워별 순위·점수 편집 + 본선 통과자에서 가져오기.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Input, Select } from './ui';
import type { FinalResultRow, FinalRole, QualifierRow } from '@/lib/db/types';

const ROLE_LABEL: Record<FinalRole, string> = { leader: 'Leader', follower: 'Follower' };

/** 참가자별 판정단 / 온라인 / 최종(가중) 점수 — avg(0-10) + total(avg×항목수). */
export interface ScoreBreakdown {
  panelAvg: number | null;
  onlineAvg: number | null;
  finalAvg: number | null;
  panelTotal: number | null;
  onlineTotal: number | null;
  finalTotal: number | null;
}

function fmt(n: number | null | undefined, dp = 2): string {
  if (n == null) return '—';
  return Number.isInteger(n) ? String(n) : Number(n).toFixed(dp);
}

interface DraftRow {
  participant_num: string;
  team_name: string;
  role: FinalRole;
  final_rank: number | '';
  total_score: number | '';
  average: number | '';
  photo_url: string;
}

const EMPTY_DRAFT: DraftRow = {
  participant_num: '',
  team_name: '',
  role: 'leader',
  final_rank: '',
  total_score: '',
  average: '',
  photo_url: '',
};

export function FinalsPanel({
  contestId,
  initial,
  semiQualifiers,
  breakdown,
  weights,
}: {
  contestId: string;
  initial: FinalResultRow[];
  semiQualifiers: QualifierRow[];
  breakdown: Record<string, ScoreBreakdown>;
  weights: { panel: number; online: number; usePanel: boolean; useOnline: boolean };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<FinalResultRow[]>(initial);
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<DraftRow>(EMPTY_DRAFT);

  const apiBase = `/api/admin/contests/${encodeURIComponent(contestId)}/finals`;

  function toNum(v: number | ''): number | null {
    return v === '' ? null : v;
  }

  function updateRow(id: string, patch: Partial<FinalResultRow>) {
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
    if (!confirm(`Delete final result for #${num}?`)) return;
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

  function addRow() {
    setError(null);
    if (!newDraft.participant_num || !newDraft.team_name) {
      setError('Number and team name are required.');
      return;
    }
    startTransition(async () => {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDraft,
          final_rank: toNum(newDraft.final_rank),
          total_score: toNum(newDraft.total_score),
          average: toNum(newDraft.average),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Add failed (${res.status})`);
        return;
      }
      const j = await res.json();
      setRows((s) => [...s, j.data]);
      setNewDraft(EMPTY_DRAFT);
      setCreating(false);
      router.refresh();
    });
  }

  function importFromSemi() {
    const existing = new Set(rows.map((r) => `${r.role}:${r.participant_num}`));
    const passed = semiQualifiers
      .filter((q) => q.passed)
      .filter((q) => q.role === 'leader' || q.role === 'follower')
      .filter((q) => !existing.has(`${q.role}:${q.participant_num}`));
    if (passed.length === 0) {
      setError('No semi qualifiers available or all are already registered.');
      return;
    }
    if (!confirm(`Add ${passed.length} semi qualifiers as final candidates?`)) return;
    startTransition(async () => {
      for (const q of passed) {
        const res = await fetch(apiBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participant_num: q.participant_num,
            team_name: q.team_name,
            role: q.role as FinalRole,
            final_rank: null,
            total_score: null,
            average: null,
            photo_url: q.photo_url,
          }),
        });
        if (res.ok) {
          const j = await res.json();
          setRows((s) => [...s, j.data]);
        }
      }
      router.refresh();
    });
  }

  const leaderRows = rows.filter((r) => r.role === 'leader')
    .sort((a, b) => (a.final_rank ?? 999) - (b.final_rank ?? 999));
  const followerRows = rows.filter((r) => r.role === 'follower')
    .sort((a, b) => (a.final_rank ?? 999) - (b.final_rank ?? 999));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="text-sm text-ink2">
          Leaders <span className="text-ink font-semibold">{leaderRows.length}</span> ·{' '}
          Followers <span className="text-ink font-semibold">{followerRows.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={importFromSemi} disabled={pending}>Import from Semi Qualifiers</Button>
          <Button variant="primary" onClick={() => setCreating((c) => !c)} disabled={pending}>
            {creating ? 'Cancel' : '+ Add Manually'}
          </Button>
        </div>
      </div>

      {/* 점수 그룹 안내 — 판정단/온라인 사용 여부 + 가중치 */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-ink2">점수 구성:</span>
        <span className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5">
          판정단 {weights.usePanel ? `가중치 ${fmt(weights.panel)}` : <span className="text-ink2/50">미사용</span>}
        </span>
        <span className="text-ink2">+</span>
        <span className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5">
          온라인 {weights.useOnline ? `가중치 ${fmt(weights.online)}` : <span className="text-ink2/50">미사용</span>}
        </span>
        <span className="text-ink2">→</span>
        <span className="inline-flex items-center gap-1 rounded border border-ok/40 text-ok px-2 py-0.5">최종(가중 평균)</span>
        <span className="text-ink2/60">· 각 점수는 항목 평균(0–10) 기준 · 총점 = 평균 × 항목수</span>
      </div>

      {error && (
        <p className="text-sm text-danger mb-3" role="alert">{error}</p>
      )}

      {creating && (
        <div className="rounded border border-accent/40 bg-accent/5 p-3 mb-4 grid grid-cols-1 md:grid-cols-7 gap-2">
          <Input value={newDraft.participant_num} onChange={(e) => setNewDraft({ ...newDraft, participant_num: e.target.value })} placeholder="#" />
          <Input value={newDraft.team_name} onChange={(e) => setNewDraft({ ...newDraft, team_name: e.target.value })} placeholder="Team name" className="md:col-span-2" />
          <Select value={newDraft.role} onChange={(e) => setNewDraft({ ...newDraft, role: e.target.value as FinalRole })}>
            <option value="leader">Leader</option>
            <option value="follower">Follower</option>
          </Select>
          <Input type="number" min={1} placeholder="Rank" value={newDraft.final_rank} onChange={(e) => setNewDraft({ ...newDraft, final_rank: e.target.value === '' ? '' : Number(e.target.value) })} />
          <Input type="number" step="0.001" placeholder="Total" value={newDraft.total_score} onChange={(e) => setNewDraft({ ...newDraft, total_score: e.target.value === '' ? '' : Number(e.target.value) })} />
          <Button variant="primary" onClick={addRow} disabled={pending}>Save</Button>
        </div>
      )}

      <RoleTable
        title="Leaders"
        rows={leaderRows}
        breakdown={breakdown}
        pending={pending}
        onUpdate={updateRow}
        onDelete={deleteRow}
      />
      <div className="h-4" />
      <RoleTable
        title="Followers"
        rows={followerRows}
        breakdown={breakdown}
        pending={pending}
        onUpdate={updateRow}
        onDelete={deleteRow}
      />

      <p className="text-xs text-ink2 mt-3">
        💡 Use the same rank number (e.g., 1·1) for ties. Final pairing is done manually on stage — no automatic shuffle.
      </p>
    </div>
  );
}

function ScoreCell({ total, avg, green = false }: { total: number | null; avg: number | null; green?: boolean }) {
  return (
    <div className={`flex flex-col items-end leading-tight font-mono ${green ? 'text-ok' : ''}`}>
      <span className={green ? 'font-semibold text-base' : 'text-sm'}>{fmt(total)}</span>
      <span className={`text-[11px] ${green ? 'text-ok/80' : 'text-ink2/70'}`}>{fmt(avg)} avg</span>
    </div>
  );
}

function RoleTable({
  title,
  rows,
  breakdown,
  pending,
  onUpdate,
  onDelete,
}: {
  title: string;
  rows: FinalResultRow[];
  breakdown: Record<string, ScoreBreakdown>;
  pending: boolean;
  onUpdate: (id: string, patch: Partial<FinalResultRow>) => void;
  onDelete: (id: string, num: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge>{rows.length}</Badge>
      </div>
      <div className="rounded border border-border bg-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg2 text-ink2 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2 w-20">Rank</th>
              <th className="text-left px-3 py-2 w-20">#</th>
              <th className="text-left px-3 py-2 min-w-[10rem]">Team</th>
              <th className="text-right px-3 py-2 w-28">판정단</th>
              <th className="text-right px-3 py-2 w-28">온라인</th>
              <th className="text-right px-3 py-2 w-32 text-ok">최종(가중)</th>
              <th className="text-right px-3 py-2 w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const b = breakdown[r.participant_num];
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-2 py-1">
                    <Input
                      type="number" min={1} max={100}
                      value={r.final_rank ?? ''}
                      onChange={(e) => onUpdate(r.id, { final_rank: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono">{r.participant_num}</td>
                  <td className="px-2 py-1">
                    <Input
                      value={r.team_name}
                      onChange={(e) => onUpdate(r.id, { team_name: e.target.value })}
                      className="w-full"
                    />
                  </td>
                  <td className="px-3 py-2"><ScoreCell total={b?.panelTotal ?? null} avg={b?.panelAvg ?? null} /></td>
                  <td className="px-3 py-2"><ScoreCell total={b?.onlineTotal ?? null} avg={b?.onlineAvg ?? null} /></td>
                  <td className="px-3 py-2 bg-ok/5"><ScoreCell total={b?.finalTotal ?? null} avg={b?.finalAvg ?? null} green /></td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="danger" onClick={() => onDelete(r.id, r.participant_num)} disabled={pending}>Del</Button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-ink2 py-6 text-sm">
                  No {title.toLowerCase()} entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
