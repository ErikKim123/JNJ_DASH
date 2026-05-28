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
import { useMemo, useRef, useState, useTransition, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Field, Input, Select, Textarea } from './ui';
import type { JudgeRow, JudgeTargetRole, JudgingRound } from '@/lib/db/types';

type VoteCount = Record<string, number>;
type RoundIdMap = Partial<Record<JudgingRound, string>>;

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
  /** 라운드별 row id — 라운드별 vote count 집계용. */
  idsByRound: RoundIdMap;
  /** 라운드별 max_votes — 라운드마다 다른 정원에 맞춰 분리 편집. */
  maxVotesByRound: Partial<Record<JudgingRound, number | null>>;
}

export function JudgesAdmin({
  contestId,
  initial,
  voteCounts,
  prelimQuotaPerRole,
  semiQuotaPerRole,
}: {
  contestId: string;
  initial: JudgeGroup[];
  voteCounts: VoteCount;
  /** 대회 정보의 prelim_pass_per_role — 예선 O 표 정원 표시용. */
  prelimQuotaPerRole: number;
  /** 대회 정보의 semi_pass_per_role — 본선 O 표 정원 표시용. */
  semiQuotaPerRole: number;
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

  // 라운드별 max_votes 패치 — mirror 가 아닌 per-round endpoint 사용.
  // 같은 심사위원이라도 예선/본선 정원이 달라 라운드별로 다른 cap 을 둘 수 있어야 한다.
  function patchMaxVotes(group: JudgeGroup, round: JudgingRound, value: number | null) {
    const judgeId = group.idsByRound[round];
    if (!judgeId) {
      setError(`No judge row for round=${round}`);
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/contests/${encodeURIComponent(contestId)}/judging/${round}/judges/${judgeId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ max_votes: value }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Update failed (${res.status})`);
        router.refresh();
        return;
      }
      setGroups((s) => s.map((g) => {
        if (g.display_order !== group.display_order) return g;
        return {
          ...g,
          maxVotesByRound: { ...g.maxVotesByRound, [round]: value },
          // canonical 도 예선 값과 sync (target_role 등 다른 패치가 canonical 만 보는 코드 호환).
          canonical: round === 'prelim' ? { ...g.canonical, max_votes: value } : g.canonical,
        };
      }));
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
                <th className="text-left px-3 py-2 w-20">Photo</th>
                <th className="text-left px-3 py-2 min-w-[8rem]">Name</th>
                <th className="text-left px-3 py-2 min-w-[8rem]">Alias</th>
                <th className="text-left px-3 py-2 min-w-[10rem]">Specialty</th>
                <th className="text-left px-3 py-2 w-24">Target</th>
                <th className="text-left px-3 py-2 w-28">Max&nbsp;O</th>
                <th className="text-left px-3 py-2 w-32">Activity</th>
                <th className="text-right px-3 py-2 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-ink2 py-8">
                    No judges registered yet.
                  </td>
                </tr>
              )}
              {groups.map((g) => {
                const prelimVotes = voteCounts[g.idsByRound.prelim ?? ''] ?? 0;
                const semiVotes = voteCounts[g.idsByRound.semi ?? ''] ?? 0;
                const finalVotes = voteCounts[g.idsByRound.final ?? ''] ?? 0;
                return (
                  <JudgeRowEditor
                    key={g.display_order}
                    contestId={contestId}
                    group={g}
                    voteCounts={{ prelim: prelimVotes, semi: semiVotes, final: finalVotes }}
                    prelimQuota={prelimQuotaPerRole}
                    semiQuota={semiQuotaPerRole}
                    pending={pending}
                    expanded={expandedOrder === g.display_order}
                    onToggle={() => setExpandedOrder(expandedOrder === g.display_order ? null : g.display_order)}
                    onPatch={(p) => patchJudge(g, p)}
                    onPatchMaxVotes={(round, v) => patchMaxVotes(g, round, v)}
                    onDelete={() => deleteJudge(g)}
                    onPhotoUploaded={(url) => {
                      setGroups((s) => s.map((x) =>
                        x.display_order === g.display_order
                          ? { ...x, canonical: { ...x.canonical, photo_url: url } }
                          : x
                      ));
                    }}
                  />
                );
              })}
            </tbody>
            <tfoot className="border-t border-border bg-bg2/30">
              <tr>
                <td className="px-3 py-3" colSpan={4}>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addJudge(); } }}
                    placeholder="New judge name (then Enter)"
                    className="w-full"
                  />
                </td>
                <td className="px-3 py-3 text-xs text-ink2" colSpan={5}>
                  Order auto-assigned to {(groups.at(-1)?.display_order ?? 0) + 1}. 한 번 추가하면 예선·본선·결승에 동시 등록됩니다. 사진은 추가 후 업로드.
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
        세 라운드에 자동 동기화되며, 삭제 시에도 세 라운드의 모든 vote 와 함께 제거됩니다.
        Activity 는 라운드별 O 표 수 / 통과 정원(대회 정보의 prelim/semi pass-per-role) 으로 표시됩니다.
      </p>
    </div>
  );
}

function JudgeRowEditor({
  contestId,
  group,
  voteCounts,
  prelimQuota,
  semiQuota,
  pending,
  expanded,
  onToggle,
  onPatch,
  onPatchMaxVotes,
  onDelete,
  onPhotoUploaded,
}: {
  contestId: string;
  group: JudgeGroup;
  voteCounts: { prelim: number; semi: number; final: number };
  prelimQuota: number;
  semiQuota: number;
  pending: boolean;
  expanded: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<JudgeRow>) => void;
  onPatchMaxVotes: (round: JudgingRound, value: number | null) => void;
  onDelete: () => void;
  onPhotoUploaded: (url: string) => void;
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
  });
  // 라운드별 max_votes — 별도 endpoint 로 patch 하므로 d 와 분리.
  const [maxVotes, setMaxVotes] = useState<{ prelim: number | null; semi: number | null }>({
    prelim: group.maxVotesByRound.prelim ?? null,
    semi: group.maxVotesByRound.semi ?? null,
  });

  // 사진 업로드 상태
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  async function onPhotoPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoErr(null);
    setPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('judgeId', judge.id);
      const res = await fetch(
        `/api/admin/contests/${encodeURIComponent(contestId)}/judge-photo-upload`,
        { method: 'POST', body: fd },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.url) {
        setPhotoErr(j.error ?? `Upload failed (${res.status})`);
        return;
      }
      onPhotoUploaded(j.url as string);
    } catch (err) {
      setPhotoErr(err instanceof Error ? err.message : 'UPLOAD_ERROR');
    } finally {
      setPhotoBusy(false);
    }
  }

  function clearPhoto() {
    if (!judge.photo_url) return;
    if (!confirm(`Remove photo for "${judge.name}"?`)) return;
    onPatch({ photo_url: '' });
    onPhotoUploaded('');
  }

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
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoBusy}
              className="block w-12 h-12 rounded-full overflow-hidden border border-border bg-bg2 hover:border-accent disabled:opacity-50"
              title={judge.photo_url ? 'Click to replace photo' : 'Click to upload photo'}
              aria-label={judge.photo_url ? 'Replace photo' : 'Upload photo'}
            >
              {judge.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={judge.photo_url}
                  alt={judge.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="block text-[10px] text-ink2/60 leading-[3rem] text-center">+ Add</span>
              )}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={onPhotoPick}
            />
            {judge.photo_url && !photoBusy && (
              <button
                type="button"
                onClick={clearPhoto}
                className="text-[10px] text-danger/80 hover:text-danger underline"
              >
                Remove
              </button>
            )}
            {photoBusy && <span className="text-[10px] text-ink2">Uploading…</span>}
            {photoErr && <span className="text-[10px] text-danger" title={photoErr}>Failed</span>}
          </div>
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
          {/* 예선 / 본선 라운드별 cap — 빈 칸 = ∞ (제한 없음). 결승은 점수 입력 방식이라 cap 없음.
              신규 추가 시 자동으로 대회 정원이 들어가며, placeholder 도 대회 정원으로 안내. */}
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-[10px] text-ink2/70" title={`예선 O 표 상한 — 비우면 무제한 (대회 정원 ${prelimQuota})`}>
              <span className="w-6 shrink-0">예선</span>
              <Input
                type="number" min={0} max={999}
                value={maxVotes.prelim ?? ''}
                onChange={(e) => setMaxVotes((s) => ({ ...s, prelim: e.target.value === '' ? null : Number(e.target.value) }))}
                onBlur={() => {
                  if (maxVotes.prelim !== (group.maxVotesByRound.prelim ?? null)) {
                    onPatchMaxVotes('prelim', maxVotes.prelim);
                  }
                }}
                placeholder={String(prelimQuota)}
                className="w-14 font-mono text-center"
              />
            </label>
            <label className="flex items-center gap-1 text-[10px] text-ink2/70" title={`본선 O 표 상한 — 비우면 무제한 (대회 정원 ${semiQuota})`}>
              <span className="w-6 shrink-0">본선</span>
              <Input
                type="number" min={0} max={999}
                value={maxVotes.semi ?? ''}
                onChange={(e) => setMaxVotes((s) => ({ ...s, semi: e.target.value === '' ? null : Number(e.target.value) }))}
                onBlur={() => {
                  if (maxVotes.semi !== (group.maxVotesByRound.semi ?? null)) {
                    onPatchMaxVotes('semi', maxVotes.semi);
                  }
                }}
                placeholder={String(semiQuota)}
                className="w-14 font-mono text-center"
              />
            </label>
          </div>
        </td>
        <td className="px-3 py-2 text-xs">
          {/* 예선/본선 = O 표 X/정원 · 결승 = 채점한 참가자 수 */}
          <div className="space-y-0.5 font-mono leading-tight">
            <div title="예선 O 표 / 통과 정원">
              <span className="text-ink2/60 mr-1">예선</span>
              <span className={voteCounts.prelim > 0 ? 'text-ok' : 'text-ink2/40'}>
                {voteCounts.prelim}
              </span>
              <span className="text-ink2/40"> / {prelimQuota}</span>
            </div>
            <div title="본선 O 표 / 통과 정원">
              <span className="text-ink2/60 mr-1">본선</span>
              <span className={voteCounts.semi > 0 ? 'text-ok' : 'text-ink2/40'}>
                {voteCounts.semi}
              </span>
              <span className="text-ink2/40"> / {semiQuota}</span>
            </div>
            {voteCounts.final > 0 && (
              <div title="결승 채점 참가자 수">
                <span className="text-ink2/60 mr-1">결승</span>
                <span className="text-ok">{voteCounts.final}</span>
              </div>
            )}
          </div>
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
          <td colSpan={10} className="px-6 py-4">
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
                  <span className="font-mono">예선 {maxVotes.prelim ?? `(${prelimQuota})`}</span>{' '}
                  <span className="text-ink2/60">·</span>{' '}
                  <span className="font-mono">본선 {maxVotes.semi ?? `(${semiQuota})`}</span>{' '}
                  <span className="text-ink2/60">— 라운드별 cap (빈 칸 = 무제한, 괄호는 대회 정원)</span>
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
