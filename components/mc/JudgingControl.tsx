// 심사·확정 컨트롤 (예선/본선 공용) — 실시간 순위 + 경계 동점 추려내기 + 통과자 확정. (요구 3·5)
//   순위 데이터는 StandingsProvider 가 5초마다 폴링한 것을 공유한다(배너와 같은 값).
'use client';

import { Btn, Card, StatusLine, adminFetch, sendDisplayCmd, useMcAction } from './ui';
import type { RoleStanding, StandingEntry } from '@/lib/judging/standings';
import { roleLabel, useStandings } from './standingsContext';

type PairRound = 'prelim' | 'semi';

export function JudgingControl({ contestId, round }: { contestId: string; round: PairRound }) {
  const { data, error: loadError, loading, updatedAt, reload, ties, tieCount, openTie } = useStandings();
  const { pending, error, message, run } = useMcAction();
  const cbase = `/api/admin/contests/${encodeURIComponent(contestId)}/judging/${round}`;

  const commit = () =>
    run(async () => {
      const res = await adminFetch<{ confirmedLeaders: number; confirmedFollowers: number }>(
        `${cbase}/commit`,
        { method: 'POST' }
      );
      await reload();
      return `통과 확정 — 리더 ${res.confirmedLeaders} · 팔로워 ${res.confirmedFollowers}`;
    });

  const uncommit = () =>
    run(async () => {
      await adminFetch(`${cbase}/uncommit`, { method: 'POST' });
      await reload();
      return '확정 취소 완료';
    });

  // 조회 — 표출(프로젝터) 화면의 "조회 / Refresh" 를 원격 실행하고, MC 순위표도 같이 새로고침.
  const refresh = () =>
    run(async () => {
      await Promise.all([reload(), sendDisplayCmd(contestId, 'refresh')]);
      return '조회 완료 — 표출 화면을 갱신했습니다';
    });

  if (!data) {
    return (
      <Card title="심사 순위">
        {loadError ? <StatusLine tone="danger">{loadError}</StatusLine> : <p className="text-sm text-ink2">불러오는 중…</p>}
      </Card>
    );
  }

  return (
    <>
      {/* 동점 추려내기 — 동점이 있으면 순위표보다 먼저, 눈에 띄게. */}
      {ties.length > 0 && (
        <section className="rounded-2xl border-2 border-danger/60 bg-danger/10 p-4">
          <h2 className="text-sm font-semibold text-danger">⚠ 경계 동점 {tieCount}명</h2>
          <div className="mt-2 space-y-1">
            {ties.map((role) => (
              <p key={role.role} className="text-xs text-ink2">
                {roleLabel(role.role)} — 동점 {role.tie!.candidates.length}명 중{' '}
                <span className="text-accent font-semibold">{role.tie!.slots}자리</span> ·{' '}
                {role.entries
                  .filter((e) => e.boundaryTie)
                  .map((e) => `${e.num} ${e.name}`)
                  .join(', ')}
              </p>
            ))}
          </div>
          <Btn variant="primary" onClick={openTie} className="w-full mt-3">
            ⚖ 동점 추려내기 (통과자 고르기)
          </Btn>
          <p className="text-[10px] text-ink2 mt-2">
            합의된 사람을 통과로 두고 저장하면 그대로 확정됩니다 · ★ = 헤드(타이브레이커) 심사위원 O
          </p>
        </section>
      )}

      <Card
        title={`심사 순위 · 정원 역할별 ${data.maxPerRole}`}
        right={
          <span className="flex items-center gap-2 text-[10px] text-ink2">
            {loading ? '갱신중…' : updatedAt ? new Date(updatedAt).toLocaleTimeString('ko-KR', { hour12: false }) : ''}
            <button
              type="button"
              onClick={refresh}
              disabled={pending}
              className="text-[11px] text-accent font-mono active:opacity-60 disabled:opacity-40"
            >
              ↻ 조회
            </button>
          </span>
        }
      >
        <RoleTable label="리더 / Leader" role={data.leader} />
        <div className="h-3" />
        <RoleTable label="팔로워 / Follower" role={data.follower} />
      </Card>

      <div className="grid grid-cols-1 gap-2">
        <Btn variant="primary" onClick={commit} disabled={pending}>
          ✓ 통과자 확정 (Commit){ties.length ? ' · 동점 전원 통과' : ''}
        </Btn>
        {ties.length > 0 && (
          <p className="text-[10px] text-danger text-center -mt-1">
            그냥 확정하면 동점자가 모두 통과해 정원을 넘습니다 — 위의 동점 추려내기를 쓰세요
          </p>
        )}
        {data.committed && (
          <Btn variant="danger" onClick={uncommit} disabled={pending}>
            확정 취소 (Uncommit)
          </Btn>
        )}
        {/* 조회 — 순위·동점 후보 새로고침 */}
        <Btn variant="ghost" onClick={refresh} disabled={pending}>
          ↻ 조회하기 (표출 화면 갱신)
        </Btn>
      </div>

      {pending && <StatusLine>처리 중…</StatusLine>}
      {message && !error && <StatusLine tone="ok">{message}</StatusLine>}
      {(error || loadError) && <StatusLine tone="danger">{error ?? loadError}</StatusLine>}
    </>
  );
}

function RoleTable({ label, role }: { label: string; role: RoleStanding }) {
  const passedCount = role.entries.filter((e) => e.passed).length;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-[10px] text-ink2">통과 {passedCount}</span>
      </div>
      <div className="space-y-0.5">
        {role.entries.map((e) => (
          <Row key={e.num} e={e} />
        ))}
        {role.entries.length === 0 && <p className="text-xs text-ink2 py-2">후보 없음</p>}
      </div>
    </div>
  );
}

function Row({ e }: { e: StandingEntry }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
        e.boundaryTie ? 'bg-accent/10 border border-accent/40' : e.inQuota ? 'bg-bg2' : 'opacity-60'
      }`}
    >
      <span className="w-6 text-center font-mono text-ink2">{e.rank || '–'}</span>
      <span className="font-mono text-ink2 w-8">{e.num}</span>
      <span className="flex-1 truncate">{e.name}</span>
      {e.headO ? <span className="text-accent" title="헤드 심사 O">★</span> : null}
      <span className="font-mono w-10 text-right">{e.value}표</span>
      {e.passed ? (
        <span className="text-ok text-[10px] font-semibold w-8 text-right">통과</span>
      ) : e.boundaryTie ? (
        <span className="text-accent text-[10px] font-semibold w-8 text-right">동점</span>
      ) : (
        <span className="w-8" />
      )}
    </div>
  );
}
