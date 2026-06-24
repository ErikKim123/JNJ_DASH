'use client';

// 페어링 관리 UI. 라운드(prelim/semi)별 동일 컴포넌트 사용.
//
// 상태 머신:
//   [없음]      → [셔플] → draft → [확정] → confirmed
//   confirmed   → [리페어링 시작] → draft → [셔플] / [확정]
//
// draft 상태에서는 행 인라인 편집 허용. confirmed 상태에서는 read-only.
// [확정] 클릭 시 모든 페어 status=confirmed, [리페어링] 클릭 시 모두 draft.
import { Fragment, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Input } from './ui';
import type { PairingRow } from '@/lib/db/types';

export function PairingsPanel({
  contestId,
  round,
  initial,
  groups = [],
  groupSize = 0,
}: {
  contestId: string;
  round: 'prelim' | 'semi';
  initial: PairingRow[];
  /** 그룹별 커플 수 배열. 예: [20,20,20] → A·B·C. 우선 적용. */
  groups?: number[];
  /** (legacy) 그룹당 커플 수 — groups 가 비어있을 때만 균등 분할 폴백. */
  groupSize?: number;
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

  // 그룹 경계 계산 — groups 배열 우선, 없으면 groupSize 로 균등 분할.
  // 정의된 그룹 합보다 페어가 많으면 남는 페어는 다음 알파벳 그룹으로.
  const headerByStart = useMemo(() => {
    const sizes = (groups && groups.length)
      ? groups.filter((n) => n > 0)
      : (groupSize > 0
          ? Array.from({ length: Math.ceil(rows.length / groupSize) }, (_, i) =>
              Math.min(groupSize, rows.length - i * groupSize))
          : []);
    const m = new Map<number, { end: number; label: string }>();
    if (!sizes.length) return m;
    let acc = 0, g = 0;
    for (; g < sizes.length && acc < rows.length; g++) {
      const end = Math.min(acc + sizes[g], rows.length);
      m.set(acc, { end, label: String.fromCharCode(65 + g) });
      acc = end;
    }
    if (acc < rows.length) m.set(acc, { end: rows.length, label: String.fromCharCode(65 + g) });
    return m;
  }, [groups, groupSize, rows.length]);

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
            <Button onClick={saveManual} disabled={pending}>Save edits</Button>
          )}
          {/* Confirm 은 항상 노출 — 확정 상태에선 비활성('Confirmed') 으로 표시해 버튼이 사라지지 않게. */}
          {rows.length > 0 && (
            <Button
              variant="primary"
              onClick={confirmAll}
              disabled={pending || status === 'confirmed'}
              title={
                status === 'confirmed'
                  ? 'Already confirmed — click Re-pair to edit, then Confirm again'
                  : 'Confirm pairs (show on display)'
              }
            >
              {status === 'confirmed' ? '✓ Confirmed' : '✓ Confirm'}
            </Button>
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
            {rows.map((r, i) => {
              // 그룹 분할 — 그룹 시작 위치마다 A·B·C… 헤더 행을 삽입.
              const hdr = headerByStart.get(i);
              const showHeader = !!hdr;
              const groupLabel = hdr?.label ?? '';
              const groupEnd = hdr?.end ?? i;
              return (
              <Fragment key={r.id}>
                {showHeader && (
                  <tr className="bg-bg2 border-t-2 border-accent/40">
                    <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
                      Group {groupLabel}
                      <span className="ml-2 text-ink2 normal-case font-normal">
                        #{r.pair_idx}–#{rows[groupEnd - 1]?.pair_idx} · {groupEnd - i} couples
                      </span>
                    </td>
                  </tr>
                )}
              <tr className="border-t border-border">
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
              </Fragment>
              );
            })}
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
