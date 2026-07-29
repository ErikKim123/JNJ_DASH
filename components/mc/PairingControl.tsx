// 패어링 컨트롤 (예선/본선 공용) — 셔플 / 확정 / 리페어링. 기존 admin API 재사용. (요구 2·4)
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PairingRow } from '@/lib/db/types';
import { Btn, Card, StatusLine, adminFetch, sendDisplayCmd, useMcAction } from './ui';

type PairRound = 'prelim' | 'semi';

export function PairingControl({ contestId, round }: { contestId: string; round: PairRound }) {
  const [rows, setRows] = useState<PairingRow[] | null>(null);
  const { pending, error, message, run } = useMcAction();
  const base = `/api/admin/contests/${encodeURIComponent(contestId)}/pairings/${round}`;

  const load = useCallback(async () => {
    const data = await adminFetch<PairingRow[]>(base);
    setRows(data);
  }, [base]);

  useEffect(() => {
    load().catch(() => setRows([]));
  }, [load]);

  const status: 'empty' | 'draft' | 'confirmed' =
    !rows || rows.length === 0 ? 'empty' : rows.some((r) => r.status === 'confirmed') ? 'confirmed' : 'draft';

  const act = (action: 'shuffle' | 'confirm' | 'unlock', doneMsg: string) =>
    run(async () => {
      await adminFetch(`${base}?action=${action}`, { method: 'POST' });
      await load();
      return doneMsg;
    });

  // 조회 — 표출(프로젝터) 화면의 "조회 / Refresh" 를 원격 실행하고, MC 목록도 같이 새로고침.
  const refresh = () =>
    run(async () => {
      await Promise.all([load(), sendDisplayCmd(contestId, 'refresh')]);
      return '조회 완료 — 표출 화면을 갱신했습니다';
    });

  return (
    <Card
      title={`패어링 · ${status === 'confirmed' ? '확정됨' : status === 'draft' ? '초안' : '없음'}`}
      right={
        <span className="flex items-center gap-3">
          <span className="text-[10px] text-ink2">{rows ? `${rows.length}페어` : '…'}</span>
          <button type="button" onClick={refresh} disabled={pending} className="text-[11px] text-accent font-mono active:opacity-60 disabled:opacity-40">
            ↻ 조회
          </button>
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-2">
        {status !== 'confirmed' ? (
          <>
            <Btn variant="ghost" onClick={() => act('shuffle', '셔플 완료 — 확인 후 확정하세요')} disabled={pending}>
              {rows && rows.length ? '🔀 다시 셔플' : '🔀 셔플 (자동 매칭)'}
            </Btn>
            {status === 'draft' && (
              <Btn variant="primary" onClick={() => act('confirm', '확정 완료 — 표출 PAIRING 화면에 반영됩니다')} disabled={pending}>
                ✓ 확정 (표출 반영)
              </Btn>
            )}
          </>
        ) : (
          <Btn variant="danger" onClick={() => act('unlock', '잠금 해제 — 다시 셔플/편집 가능')} disabled={pending}>
            🔓 리페어링 (잠금 해제)
          </Btn>
        )}
      </div>

      {pending && <StatusLine>처리 중…</StatusLine>}
      {message && !error && <StatusLine tone="ok">{message}</StatusLine>}
      {error && <StatusLine tone="danger">{error}</StatusLine>}

      {/* 조회 — 패어링 목록 새로고침 */}
      <Btn variant="ghost" onClick={refresh} disabled={pending} className="mt-2 w-full">
        ↻ 조회하기 (표출 화면 갱신)
      </Btn>

      {/* 페어 미리보기 */}
      {rows && rows.length > 0 && (
        <div className="mt-3 border-t border-border pt-3 max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-ink2 text-[10px] uppercase tracking-widest">
                <th className="text-left font-normal pb-1 w-8">#</th>
                <th className="text-left font-normal pb-1">Leader</th>
                <th className="text-left font-normal pb-1">Follower</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-border/50">
                  <td className="py-1.5 text-ink2 font-mono">{p.pair_idx}</td>
                  <td className="py-1.5">
                    <span className="text-ink2 font-mono mr-1">{p.leader_num}</span>
                    {p.leader_name}
                  </td>
                  <td className="py-1.5">
                    <span className="text-ink2 font-mono mr-1">{p.follower_num}</span>
                    {p.follower_name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
