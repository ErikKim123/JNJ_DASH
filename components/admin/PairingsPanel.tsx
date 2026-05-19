'use client';

// 페어링 관리 UI. 라운드(prelim/semi)별 동일 컴포넌트 사용.
//
// 상태 머신:
//   [없음]      → [셔플] → draft → [확정] → confirmed
//   confirmed   → [리페어링 시작] → draft → [셔플] / [확정]
//
// draft 상태에서는 행 인라인 편집 허용. confirmed 상태에서는 read-only.
// [확정] 클릭 시 모든 페어 status=confirmed, [리페어링] 클릭 시 모두 draft.
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Input } from './ui';
import type { PairingRow } from '@/lib/db/types';

export function PairingsPanel({
  contestId,
  round,
  initial,
}: {
  contestId: string;
  round: 'prelim' | 'semi';
  initial: PairingRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PairingRow[]>(initial);

  const apiBase = `/api/admin/contests/${encodeURIComponent(contestId)}/pairings/${round}`;
  const roundLabel = round === 'prelim' ? 'Prelim' : 'Semi';

  const status = useMemo<'empty' | 'draft' | 'confirmed' | 'mixed'>(() => {
    if (!rows.length) return 'empty';
    const allConfirmed = rows.every((r) => r.status === 'confirmed');
    const allDraft = rows.every((r) => r.status === 'draft');
    if (allConfirmed) return 'confirmed';
    if (allDraft) return 'draft';
    return 'mixed';
  }, [rows]);

  const editable = status === 'draft' || status === 'empty' || status === 'mixed';

  async function call(method: 'POST' | 'PUT', query: string, body?: unknown) {
    setError(null);
    const url = query ? `${apiBase}?${query}` : apiBase;
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? `Request failed (${res.status})`);
      return null;
    }
    const j = await res.json();
    return j.data as PairingRow[];
  }

  function shuffle() {
    if (rows.length > 0 && !confirm(`Reshuffle ${roundLabel} pairs? Existing pairs will be discarded.`)) return;
    startTransition(async () => {
      const data = await call('POST', 'action=shuffle');
      if (data) {
        setRows(data);
        router.refresh();
      }
    });
  }

  function confirmAll() {
    if (!confirm(`Confirm ${rows.length} ${roundLabel} pairs? They will appear on the display.`)) return;
    startTransition(async () => {
      const data = await call('POST', 'action=confirm');
      if (data) {
        setRows(data);
        router.refresh();
      }
    });
  }

  function repair() {
    if (!confirm(`Switch ${roundLabel} pairs back to draft mode (re-pairing)?`)) return;
    startTransition(async () => {
      const data = await call('POST', 'action=unlock');
      if (data) {
        setRows(data);
        router.refresh();
      }
    });
  }

  function saveManual() {
    if (status === 'confirmed') {
      setError('Manual edits are blocked while confirmed. Click [Re-pair] first.');
      return;
    }
    startTransition(async () => {
      const data = await call('PUT', '', rows.map((r) => ({
        pair_idx: r.pair_idx,
        leader_num: r.leader_num,
        leader_name: r.leader_name,
        follower_num: r.follower_num,
        follower_name: r.follower_name,
        status: 'draft' as const,
      })));
      if (data) {
        setRows(data);
        router.refresh();
      }
    });
  }

  function updateRow(idx: number, patch: Partial<PairingRow>) {
    setRows((s) => s.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink2">
            {roundLabel} pairs: <span className="text-ink font-semibold">{rows.length}</span>
          </span>
          {status === 'confirmed' && <Badge tone="ok">Confirmed (live)</Badge>}
          {status === 'draft' && <Badge tone="warn">Draft</Badge>}
          {status === 'mixed' && <Badge tone="danger">Mixed state</Badge>}
          {status === 'empty' && <Badge tone="neutral">Empty</Badge>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={shuffle} disabled={pending}>🎲 Shuffle</Button>
          {editable && rows.length > 0 && (
            <>
              <Button onClick={saveManual} disabled={pending}>Save edits</Button>
              <Button variant="primary" onClick={confirmAll} disabled={pending}>✓ Confirm</Button>
            </>
          )}
          {status === 'confirmed' && (
            <Button variant="danger" onClick={repair} disabled={pending}>↺ Re-pair</Button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger mb-3" role="alert">
          {error}
        </p>
      )}

      <div className="rounded border border-border bg-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg2 text-ink2 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2 w-16">#</th>
              <th className="text-left px-3 py-2 w-24">Leader</th>
              <th className="text-left px-3 py-2">Leader Team</th>
              <th className="text-left px-3 py-2 w-24">Follower</th>
              <th className="text-left px-3 py-2">Follower Team</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-ink2">{r.pair_idx}</td>
                {editable ? (
                  <>
                    <td className="px-2 py-1"><Input value={r.leader_num} onChange={(e) => updateRow(i, { leader_num: e.target.value })} className="w-full font-mono" /></td>
                    <td className="px-2 py-1"><Input value={r.leader_name} onChange={(e) => updateRow(i, { leader_name: e.target.value })} className="w-full" /></td>
                    <td className="px-2 py-1"><Input value={r.follower_num} onChange={(e) => updateRow(i, { follower_num: e.target.value })} className="w-full font-mono" /></td>
                    <td className="px-2 py-1"><Input value={r.follower_name} onChange={(e) => updateRow(i, { follower_name: e.target.value })} className="w-full" /></td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 font-mono">{r.leader_num}</td>
                    <td className="px-3 py-2">{r.leader_name}</td>
                    <td className="px-3 py-2 font-mono">{r.follower_num}</td>
                    <td className="px-3 py-2">{r.follower_name}</td>
                  </>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-ink2 py-8">
                  No pairs yet. Click [🎲 Shuffle] to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink2 mt-3">
        💡 Shuffle randomly matches leaders and followers from the participant pool. Missing slots are filled with helpers. To edit after confirmation, click [Re-pair].
      </p>
    </div>
  );
}
