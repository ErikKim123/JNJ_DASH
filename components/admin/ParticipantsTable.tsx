'use client';

// Participants editor — thumbnails, inline edit, expandable detail row
// exposing every meta field imported from the source sheet (38+ keys).
// All UI text is English.
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Field, Input, Select, Textarea } from './ui';
import type { ParticipantRow, ParticipantRole } from '@/lib/db/types';
import {
  groupMeta,
  groupFinalScoresByJudge,
  circledOrdinal,
} from './participant-meta';
import { resolveActiveDefs, type ScoringItemKey, type ScoringItemDef } from '@/lib/db/scoring';
import { resolvePhotoUrl, normalizePhotoUrl } from './photo-url';
import { useT } from '@/lib/i18n/LocaleContext';
import type { MessageKey } from '@/lib/i18n/messages';

/**
 * meta key('부문' 등) → 현재 locale 라벨 변환.
 * 사전(messages.ts) 에 정의되지 않은 키는 원본 키를 그대로 사용 (커스텀 컬럼 대비).
 */
function useFieldLabel(): (key: string) => string {
  const t = useT();
  return (key: string) => {
    const mk = `pf.field.${key}` as MessageKey;
    const v = t(mk);
    return v === mk ? key : v;
  };
}

function useFieldHint(): (key: string) => string | undefined {
  const t = useT();
  return (key: string) => {
    const mk = `pf.hint.${key}` as MessageKey;
    const v = t(mk);
    return v === mk ? undefined : v;
  };
}

const ROLE_LABEL: Record<ParticipantRole, string> = {
  leader: 'Leader',
  follower: 'Follower',
  helper_leader: 'Helper (Leader)',
  helper_follower: 'Helper (Follower)',
};

interface DraftRow {
  num: string;
  team_name: string;
  representative: string;
  role: ParticipantRole;
  photo_url: string;
  meta: Record<string, string>; // PROFILE 8개 필드 — 시트 키 그대로 보존
}

// 신규 폼에서 노출할 PROFILE 키 목록 (participant-meta.ts 의 PROFILE_KEYS 와 동일 순서).
// label/hint 는 런타임에 locale 따라 번역 — useFieldLabel/useFieldHint 사용.
const PROFILE_FIELDS: { key: string; type?: 'date' | 'email' | 'text' | 'select'; options?: readonly string[] }[] = [
  { key: '부문' },
  { key: '장르' },
  { key: 'Division', type: 'select', options: ['Solo', 'Couple', 'Team'] },
  { key: '연락처' },
  { key: '이메일', type: 'email' },
  { key: 'Nationality' },
  { key: '접수일', type: 'date' },
  { key: '사진원본' },
  { key: 'X' },
];

// 펼침 행(MetaKeyRow) 에서도 dropdown 으로 렌더할 키 → 옵션 매핑.
// 신규 폼/펼침 양쪽이 동일한 옵션을 공유하도록 단일 출처(SOT) 유지.
const FIELD_SELECT_OPTIONS: Record<string, readonly string[]> = {
  Division: ['Solo', 'Couple', 'Team'],
};

const EMPTY_DRAFT: DraftRow = {
  num: '',
  team_name: '',
  representative: '',
  role: 'leader',
  photo_url: '',
  meta: {},
};

export function ParticipantsTable({
  contestId,
  initial,
  scoringItems,
}: {
  contestId: string;
  initial: ParticipantRow[];
  /** 결승 활성 채점 항목 키. FinalScoreTable 컬럼이 이것에 따라 동적으로 늘어남. */
  scoringItems?: readonly ScoringItemKey[];
}) {
  const activeScoringDefs = useMemo(() => resolveActiveDefs(scoringItems), [scoringItems]);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParticipantRow[]>(initial);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<DraftRow>(EMPTY_DRAFT);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.num, r.team_name, r.representative].some((v) => v.toLowerCase().includes(q))
    );
  }, [rows, filter]);

  function patchRow(id: string, patch: Partial<ParticipantRow>) {
    // 1) optimistic — 입력 즉시 화면 반영
    const next = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    setRows(next);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/contests/${encodeURIComponent(contestId)}/participants/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Update failed (${res.status})`);
        router.refresh();
        return;
      }
      // 2) 성공 시 — DB 응답값으로 row 동기화 (저장 증명 + 서버 정규화 반영)
      try {
        const j = await res.json();
        if (j?.data) setRows((s) => s.map((r) => (r.id === id ? (j.data as ParticipantRow) : r)));
      } catch { /* response 파싱 실패는 무시 — optimistic 값 유지 */ }
    });
  }

  function deleteRow(id: string, num: string) {
    if (!confirm(`Delete participant #${num}?`)) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/contests/${encodeURIComponent(contestId)}/participants/${id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        setError(`Delete failed (${res.status})`);
        return;
      }
      setRows((s) => s.filter((r) => r.id !== id));
      if (expandedId === id) setExpandedId(null);
      router.refresh();
    });
  }

  function addRow() {
    setError(null);
    if (!newDraft.num || !newDraft.team_name) {
      setError('Number and team name are required.');
      return;
    }
    // 빈 PROFILE 필드는 meta 에서 제외 (시트 import 와 동일한 sparse 정책)
    const trimmedMeta: Record<string, string> = {};
    for (const [k, v] of Object.entries(newDraft.meta)) {
      const t = (v ?? '').trim();
      if (t) trimmedMeta[k] = t;
    }
    const payload = {
      num: newDraft.num,
      team_name: newDraft.team_name,
      representative: newDraft.representative,
      role: newDraft.role,
      photo_url: newDraft.photo_url,
      meta: trimmedMeta,
    };
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/contests/${encodeURIComponent(contestId)}/participants`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Add failed (${res.status})`);
        return;
      }
      const j = await res.json();
      setRows((s) => [...s, j.data].sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true })));
      setNewDraft(EMPTY_DRAFT);
      setCreating(false);
      router.refresh();
    });
  }

  const stats = useMemo(() => ({
    total: rows.length,
    leaders: rows.filter((r) => r.role === 'leader').length,
    followers: rows.filter((r) => r.role === 'follower').length,
    helpers: rows.filter((r) => r.role.startsWith('helper')).length,
  }), [rows]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <p className="text-sm text-ink2">
          Total <span className="text-ink font-semibold">{stats.total}</span> ·{' '}
          Leaders {stats.leaders} · Followers {stats.followers} · Helpers {stats.helpers}
        </p>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by # / name…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-56"
          />
          <Button variant="primary" onClick={() => setCreating((c) => !c)} disabled={pending}>
            {creating ? 'Cancel' : '+ Add Participant'}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger mb-3" role="alert">{error}</p>
      )}

      {creating && (
        <NewParticipantCard
          contestId={contestId}
          draft={newDraft}
          setDraft={setNewDraft}
          pending={pending}
          onSave={addRow}
          onCancel={() => { setNewDraft(EMPTY_DRAFT); setCreating(false); setError(null); }}
        />
      )}

      <div className="rounded border border-border bg-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg2 text-ink2 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2 w-12"></th>
              <th className="text-left px-3 py-2 w-20">Photo</th>
              <th className="text-left px-3 py-2 w-20">#</th>
              <th className="text-left px-3 py-2">Team</th>
              <th className="text-left px-3 py-2 w-32">Rep.</th>
              <th className="text-left px-3 py-2 w-32">Role</th>
              <th className="text-right px-3 py-2 w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const expanded = expandedId === r.id;
              return (
                <FragmentRow key={r.id}>
                  <tr
                    className={`border-t border-border ${expanded ? 'bg-accent/5' : 'hover:bg-bg2/30'} transition`}
                  >
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : r.id)}
                        className="text-ink2 hover:text-accent text-sm w-6 h-6 inline-flex items-center justify-center rounded border border-border"
                        aria-label={expanded ? 'Collapse' : 'Expand'}
                      >
                        {expanded ? '▾' : '▸'}
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      <PhotoThumb url={resolvePhotoUrl(r)} size={40} />
                    </td>
                    <td className="px-3 py-2 font-mono">{r.num}</td>
                    <td className="px-3 py-2">{r.team_name || <span className="text-ink2">—</span>}</td>
                    <td className="px-3 py-2 text-ink2">{r.representative || '—'}</td>
                    <td className="px-3 py-2">
                      <Badge tone={r.role.startsWith('helper') ? 'warn' : 'neutral'}>
                        {ROLE_LABEL[r.role]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button onClick={() => setExpandedId(expanded ? null : r.id)} disabled={pending}>
                          {expanded ? 'Close' : 'Edit'}
                        </Button>
                        <Button variant="danger" onClick={() => deleteRow(r.id, r.num)} disabled={pending}>
                          Del
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-t border-border bg-bg2/40">
                      <td colSpan={7} className="px-6 py-4">
                        <ExpandedDetail
                          row={r}
                          pending={pending}
                          activeScoringDefs={activeScoringDefs}
                          contestId={contestId}
                          onPatch={(patch) => patchRow(r.id, patch)}
                        />
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}

            {filtered.length === 0 && !creating && (
              <tr>
                <td colSpan={7} className="text-center text-ink2 py-8">
                  {rows.length === 0 ? 'No participants yet.' : 'No matches.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink2 mt-3">
        Click the chevron or [Edit] to expand a row. All sheet-imported fields are preserved under <code className="bg-bg2 px-1">meta</code> and editable in the detail panel.
      </p>
    </div>
  );
}

// Tiny pass-through so we can render two <tr> per logical row.
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ─── Thumbnail ──────────────────────────────────────────────────────────

function PhotoThumb({ url, size = 40 }: { url: string; size?: number }) {
  // url 이 비어있거나 onError 가 발생하면 N/A placeholder 로 폴백.
  const [broken, setBroken] = useState(false);
  if (!url || broken) {
    return (
      <div
        className="rounded border border-border bg-bg2 text-ink2 text-[10px] flex items-center justify-center"
        style={{ width: size, height: size }}
        title={url || 'No photo'}
      >
        N/A
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" title={url} className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="rounded border border-border object-cover bg-bg2"
        style={{ width: size, height: size }}
        onError={() => setBroken(true)}
      />
    </a>
  );
}

// ─── Expanded detail (basic + sectioned meta) ──────────────────────────────

function ExpandedDetail({
  row,
  pending,
  activeScoringDefs,
  contestId,
  onPatch,
}: {
  row: ParticipantRow;
  pending: boolean;
  activeScoringDefs: ScoringItemDef[];
  contestId: string;
  onPatch: (patch: Partial<ParticipantRow>) => void;
}) {
  // Basic fields
  const [num, setNum] = useState(row.num);
  const [team, setTeam] = useState(row.team_name);
  const [rep, setRep] = useState(row.representative);
  const [role, setRole] = useState<ParticipantRole>(row.role);
  const [photo, setPhoto] = useState(row.photo_url);
  const [meta, setMeta] = useState<Record<string, unknown>>(row.meta ?? {});
  const [showJson, setShowJson] = useState(false);
  const [jsonDraft, setJsonDraft] = useState(JSON.stringify(row.meta ?? {}, null, 2));
  const [jsonErr, setJsonErr] = useState<string | null>(null);

  // row.meta 가 외부 (PATCH 응답 등) 로 변경되면 local state 도 sync — 입력값 유지 보장.
  useEffect(() => {
    setMeta(row.meta ?? {});
    setJsonDraft(JSON.stringify(row.meta ?? {}, null, 2));
  }, [row.meta]);

  // 분류된 그룹
  const groups = useMemo(() => groupMeta(meta as Record<string, unknown>), [meta]);
  const totalMetaCount = useMemo(() => Object.keys(meta).length, [meta]);

  function commitBasic() {
    onPatch({ num, team_name: team, representative: rep, role, photo_url: photo });
  }

  function commitMetaKey(key: string, value: string) {
    const next = { ...meta };
    if (value === '') delete next[key];
    else next[key] = value;
    setMeta(next);
    onPatch({ meta: next });
    setJsonDraft(JSON.stringify(next, null, 2));
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonDraft);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Root must be an object');
      }
      setMeta(parsed);
      setJsonErr(null);
      onPatch({ meta: parsed });
    } catch (e) {
      setJsonErr(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }

  return (
    <div className="space-y-4">
      {/* ── BASIC ── */}
      <section className="rounded border border-border bg-bg2/30 p-4">
        <h4 className="text-xs uppercase tracking-widest text-accent mb-3">Basic</h4>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
          <div className="md:col-span-2 flex flex-col items-center gap-2">
            <PhotoThumb url={photo ? normalizePhotoUrl(photo) : resolvePhotoUrl(row)} size={96} />
            <PhotoUploadButton
              contestId={contestId}
              participantId={row.id}
              onUploaded={(url) => {
                setPhoto(url);
                onPatch({ photo_url: url });
              }}
            />
          </div>
          <div className="md:col-span-10 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Photo URL" hint="Upload a file or paste a https / Drive URL">
              <Input value={photo} onChange={(e) => setPhoto(e.target.value)} onBlur={commitBasic} placeholder="https://…" />
            </Field>
            <Field label="#">
              <Input value={num} onChange={(e) => setNum(e.target.value)} onBlur={commitBasic} />
            </Field>
            <Field label="Role">
              <Select
                value={role}
                onChange={(e) => { const v = e.target.value as ParticipantRole; setRole(v); onPatch({ role: v }); }}
              >
                {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Team Name">
              <Input value={team} onChange={(e) => setTeam(e.target.value)} onBlur={commitBasic} />
            </Field>
            <Field label="Representative">
              <Input value={rep} onChange={(e) => setRep(e.target.value)} onBlur={commitBasic} />
            </Field>
          </div>
        </div>
      </section>

      {/* ── PROFILE (개인정보) ── */}
      {groups.profile.length > 0 && (
        <Section title="Profile" tone="info" count={groups.profile.length} defaultOpen>
          <KeyValueGrid entries={groups.profile} cols={3} onCommit={commitMetaKey} />
          <ResendEmailButton
            contestId={contestId}
            participantId={row.id}
            email={(row.meta?.['이메일'] as string | undefined) ?? ''}
          />
        </Section>
      )}

      {/* ── SHEET STATUS (자동 통과 + 등수 + 점수 집계) ── */}
      {(groups.pass_flag.length + groups.rank.length + groups.score_agg.length) > 0 && (
        <Section
          title="Sheet Status (auto-calculated)"
          tone="warn"
          count={groups.pass_flag.length + groups.rank.length + groups.score_agg.length}
          defaultOpen
        >
          {groups.pass_flag.length > 0 && (
            <SubGroup label="Pass Flags">
              <FlagGrid entries={groups.pass_flag} onCommit={commitMetaKey} />
            </SubGroup>
          )}
          {groups.rank.length > 0 && (
            <SubGroup label="Ranks">
              <KeyValueGrid entries={groups.rank} cols={3} onCommit={commitMetaKey} />
            </SubGroup>
          )}
          {(groups.score_agg.length > 0 || activeScoringDefs.length > 0) && (
            <SubGroup label="Score Aggregates">
              <ScoreAggregatesGrid
                entries={groups.score_agg}
                activeDefs={activeScoringDefs}
                onCommit={commitMetaKey}
              />
            </SubGroup>
          )}
        </Section>
      )}

      {/* ── PRELIM VOTES (예선 심사위원 투표) ── */}
      {groups.prelim_vote.length > 0 && (
        <Section
          title="Prelim Vote (from sheet)"
          tone="info"
          count={dedupOrdinalCount(groups.prelim_vote)}
        >
          <PrelimVoteGrid entries={groups.prelim_vote} onCommit={commitMetaKey} />
        </Section>
      )}

      {/* ── FINAL SCORES (결승 심사위원 점수) ── */}
      {(groups.final_score.length > 0 || activeScoringDefs.length > 0) && (
        <Section title="Final Score (from sheet)" tone="ok" count={groups.final_score.length}>
          <FinalScoreTable
            entries={groups.final_score}
            activeDefs={activeScoringDefs}
            onCommit={commitMetaKey}
          />
        </Section>
      )}

      {/* ── OTHER ── */}
      {groups.other.length > 0 && (
        <Section title="Other Sheet Fields" tone="neutral" count={groups.other.length}>
          <KeyValueGrid entries={groups.other} cols={3} onCommit={commitMetaKey} />
        </Section>
      )}

      {/* ── JSON 편집 ── */}
      <section className="rounded border border-border bg-bg2/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs uppercase tracking-widest text-ink2">
            All Imported Fields <span className="text-ink2/60 normal-case">({totalMetaCount} total)</span>
          </h4>
          <Button variant="ghost" onClick={() => setShowJson((s) => !s)}>
            {showJson ? 'Hide JSON' : 'Edit as JSON'}
          </Button>
        </div>
        {showJson && (
          <div>
            <Textarea
              value={jsonDraft}
              onChange={(e) => setJsonDraft(e.target.value)}
              rows={12}
              className="w-full font-mono text-xs"
            />
            {jsonErr && <p className="text-xs text-danger mt-1">{jsonErr}</p>}
            <div className="flex justify-end mt-2">
              <Button variant="primary" onClick={applyJson} disabled={pending}>Apply JSON</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Section wrapper with collapsible state ─────────────────────────────

function Section({
  title,
  tone = 'neutral',
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'info';
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded border border-border bg-bg2/30">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-bg2/60 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-ink2 text-sm">{open ? '▾' : '▸'}</span>
          <h4 className="text-xs uppercase tracking-widest text-ink">{title}</h4>
          {count != null && <Badge tone={tone}>{count}</Badge>}
        </div>
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>}
    </section>
  );
}

function SubGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-ink2/70 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

// ─── Generic key/value editor ──────────────────────────────────────────

function KeyValueGrid({
  entries,
  cols = 3,
  onCommit,
}: {
  entries: [string, string][];
  cols?: 2 | 3 | 4 | 5;
  onCommit: (key: string, value: string) => void;
}) {
  const colsCls = cols === 2 ? 'md:grid-cols-2'
    : cols === 4 ? 'md:grid-cols-2 lg:grid-cols-4'
    : cols === 5 ? 'md:grid-cols-3 lg:grid-cols-5'
    : 'md:grid-cols-2 lg:grid-cols-3';
  return (
    <div className={`grid grid-cols-1 ${colsCls} gap-2`}>
      {entries.map(([k, v]) => (
        <MetaKeyRow key={k} k={k} value={v} onCommit={(nv) => onCommit(k, nv)} />
      ))}
    </div>
  );
}

function MetaKeyRow({ k, value, onCommit }: { k: string; value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  const empty = value === '';
  const fieldLabel = useFieldLabel();
  const options = FIELD_SELECT_OPTIONS[k];
  // title 속성에는 원본 DB 키를 그대로 노출 — 디버깅·매핑 확인 용도.
  return (
    <label className="flex flex-col gap-1">
      <span className={`text-xs truncate ${empty ? 'text-ink2/50' : 'text-ink2'}`} title={k}>{fieldLabel(k)}</span>
      {options ? (
        <Select
          value={v}
          onChange={(e) => {
            const nv = e.target.value;
            setV(nv);
            if (nv !== value) onCommit(nv);
          }}
          className={empty ? 'opacity-60' : ''}
        >
          <option value="">—</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      ) : (
        <Input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => { if (v !== value) onCommit(v); }}
          className={empty ? 'opacity-60' : ''}
        />
      )}
    </label>
  );
}

// ─── Pass flag chips (TRUE / FALSE 토글) ─────────────────────────────

function FlagGrid({
  entries,
  onCommit,
}: {
  entries: [string, string][];
  onCommit: (key: string, value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      {entries.map(([k, v]) => {
        const truthy = /^(TRUE|true|1|O|✓|☑)$/.test(v.trim());
        return (
          <button
            key={k}
            type="button"
            onClick={() => onCommit(k, truthy ? 'FALSE' : 'TRUE')}
            className={`flex items-center justify-between px-3 py-2 rounded border text-sm transition ${
              truthy
                ? 'border-ok/40 bg-ok/10 text-ok'
                : 'border-border bg-bg2 text-ink2 hover:border-accent/60'
            }`}
          >
            <span className="truncate">{k.replace(/\s*\(자동\)$/, '')}</span>
            <span className="font-mono text-xs ml-2">{truthy ? '☑ TRUE' : '☐ FALSE'}</span>
          </button>
        );
      })}
    </div>
  );
}

// ① ~ ⑮ ordinal 기준 unique 심사위원 수 — section badge count 용.
function dedupOrdinalCount(entries: [string, string][]): number {
  const seen = new Set<number>();
  for (const [k] of entries) seen.add(circledOrdinal(k));
  return seen.size;
}

// ─── Prelim vote grid — 한 컬럼당 한 심사위원, O/X 토글 ─────────────────

function PrelimVoteGrid({
  entries,
  onCommit,
}: {
  entries: [string, string][];
  onCommit: (key: string, value: string) => void;
}) {
  // 같은 ordinal 의 짧은/긴 헤더 중복 노출 방지 — 첫 번째만 채택.
  const seen = new Set<number>();
  const dedup: [string, string][] = [];
  for (const [k, v] of entries) {
    const ord = circledOrdinal(k);
    if (seen.has(ord)) continue;
    seen.add(ord);
    dedup.push([k, v]);
  }
  function cycle(curr: string): string {
    const u = curr.trim().toUpperCase();
    if (u === 'O') return 'X';
    if (u === 'X') return '';
    return 'O';
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
      {dedup.map(([k, v]) => {
        const u = v.trim().toUpperCase();
        const tone =
          u === 'O' ? 'bg-ok/15 text-ok border-ok/40' :
          u === 'X' ? 'bg-danger/15 text-danger border-danger/40' :
          'bg-bg2/40 text-ink2/40 border-border hover:border-accent';
        // 짧은 라벨 추출 (긴 안내 헤더면 마지막 ① name 부분만)
        const label = k.length > 30 ? k.slice(-12) : k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onCommit(k, cycle(v))}
            title={k}
            className={`px-2 py-1.5 rounded border text-xs transition text-left ${tone}`}
          >
            <div className="truncate font-mono">{label}</div>
            <div className="font-mono text-sm text-center mt-0.5">{u || '·'}</div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Final score table — judge × item 매트릭스 ─────────────────────────

function FinalScoreTable({
  entries,
  activeDefs,
  onCommit,
}: {
  entries: [string, string][];
  /** 대회에 활성화된 채점 항목. 컬럼은 이것 기준으로 생성됨. */
  activeDefs: ScoringItemDef[];
  onCommit: (key: string, value: string) => void;
}) {
  const byJudge = useMemo(() => groupFinalScoresByJudge(entries), [entries]);
  const judges = Object.keys(byJudge).sort((a, b) => circledOrdinal(a) - circledOrdinal(b));

  // 컬럼: 활성 항목(canonical 순) + 시트에는 있지만 비활성인 항목도 보존 노출 (운영자가 알아챌 수 있게).
  const activeKor = activeDefs.map((d) => d.korLabel);
  const inSheetKor = new Set<string>();
  for (const v of Object.values(byJudge)) for (const k of Object.keys(v)) inSheetKor.add(k);
  const extra = [...inSheetKor].filter((k) => !activeKor.includes(k));
  const columns: { kor: string; label: string; active: boolean }[] = [
    ...activeDefs.map((d) => ({ kor: d.korLabel, label: d.label, active: true })),
    ...extra.map((k) => ({ kor: k, label: k, active: false })),
  ];

  if (judges.length === 0 && columns.length === 0) {
    return <p className="text-xs text-ink2">No final-score data yet.</p>;
  }
  if (judges.length === 0) {
    return (
      <p className="text-xs text-ink2">
        No final-score data yet. Active items: {columns.filter((c) => c.active).map((c) => c.label).join(' / ')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-sm">
        <thead className="text-ink2 text-xs uppercase">
          <tr>
            <th className="text-left px-2 py-1 sticky left-0 bg-bg2/30">Judge</th>
            {columns.map((c) => (
              <th key={c.kor} className={`text-left px-2 py-1 ${c.active ? '' : 'text-ink2/50'}`}>
                <span title={c.active ? `${c.label} (active)` : `${c.label} (inactive — kept for legacy data)`}>
                  {c.kor}
                  {!c.active && <span className="ml-1 text-[10px]">·off</span>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {judges.map((j) => (
            <tr key={j} className="border-t border-border/40">
              <td className="px-2 py-1 font-mono text-xs sticky left-0 bg-bg2/30">
                {j === '' ? <span className="text-ink2/60 italic">(unassigned)</span> : j}
              </td>
              {columns.map((c) => {
                // judge 가 비어 있으면 시트 원본 키가 항목명 단독("기본기") → prefix 공백 금지
                const fullKey = j ? `${j} ${c.kor}` : c.kor;
                const v = byJudge[j]?.[c.kor] ?? '';
                return (
                  <td key={c.kor} className="px-1 py-1">
                    <ScoreInput value={v} onCommit={(nv) => onCommit(fullKey, nv)} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Score aggregates — 결승 총점/평균 + 활성 항목별 합계 동적 슬롯 ───

function ScoreAggregatesGrid({
  entries,
  activeDefs,
  onCommit,
}: {
  entries: [string, string][];
  activeDefs: ScoringItemDef[];
  onCommit: (key: string, value: string) => void;
}) {
  // 시트에서 들어온 키 → 값 맵
  const fromSheet = new Map(entries);

  // 컬럼 순서: 결승 총점 → 결승 평균 → 활성 항목 합계 (canonical 순) → 시트에 있지만 비활성인 합계 (off)
  const FIXED = ['결승 총점', '결승 평균'];
  const activeKor = activeDefs.map((d) => d.korLabel);
  const activeAggKeys = activeKor.map((k) => `${k} 합계`);
  const allowedSet = new Set<string>([...FIXED, ...activeAggKeys]);
  const legacy = [...fromSheet.keys()].filter((k) => !allowedSet.has(k));

  const cols: { key: string; label: string; active: boolean }[] = [
    ...FIXED.map((k) => ({ key: k, label: k, active: true })),
    ...activeAggKeys.map((k) => ({ key: k, label: k, active: true })),
    ...legacy.map((k) => ({ key: k, label: k, active: false })),
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
      {cols.map((c) => (
        <AggInput
          key={c.key}
          k={c.key}
          label={c.label}
          value={fromSheet.get(c.key) ?? ''}
          active={c.active}
          onCommit={(nv) => onCommit(c.key, nv)}
        />
      ))}
    </div>
  );
}

function AggInput({
  k,
  label,
  value,
  active,
  onCommit,
}: {
  k: string;
  label: string;
  value: string;
  active: boolean;
  onCommit: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  const empty = value === '';
  return (
    <label className="flex flex-col gap-1">
      <span
        className={`text-xs truncate ${active ? (empty ? 'text-ink2/50' : 'text-ink2') : 'text-ink2/50'}`}
        title={active ? k : `${k} (inactive — kept for legacy data)`}
      >
        {label}
        {!active && <span className="ml-1 text-[10px]">·off</span>}
      </span>
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== value) onCommit(v); }}
        className={empty ? 'opacity-60' : ''}
      />
    </label>
  );
}

// ─── New participant card — BASIC + PROFILE ────────────────────────────
// 인라인 1줄 폼 대신 풀폭 카드. PROFILE 8개 필드는 meta 객체로 저장된다.
function NewParticipantCard({
  contestId,
  draft,
  setDraft,
  pending,
  onSave,
  onCancel,
}: {
  contestId: string;
  draft: {
    num: string;
    team_name: string;
    representative: string;
    role: ParticipantRole;
    photo_url: string;
    meta: Record<string, string>;
  };
  setDraft: (
    update:
      | typeof draft
      | ((prev: typeof draft) => typeof draft)
  ) => void;
  pending: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const fieldLabel = useFieldLabel();
  const fieldHint = useFieldHint();
  function setField<K extends keyof typeof draft>(key: K, value: typeof draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function setMetaField(key: string, value: string) {
    setDraft((d) => ({ ...d, meta: { ...d.meta, [key]: value } }));
  }
  return (
    <div className="mb-4 rounded border border-accent/40 bg-accent/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-accent">New Participant</h3>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
          <Button variant="primary" onClick={onSave} disabled={pending}>Save</Button>
        </div>
      </div>

      {/* BASIC */}
      <section className="rounded border border-border bg-bg2/30 p-4">
        <h4 className="text-xs uppercase tracking-widest text-accent mb-3">Basic</h4>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
          <div className="md:col-span-2 flex flex-col items-center gap-2">
            <PhotoThumb url={normalizePhotoUrl(draft.photo_url)} size={96} />
            <PhotoUploadButton
              contestId={contestId}
              onUploaded={(url) => setField('photo_url', url)}
            />
          </div>
          <div className="md:col-span-10 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Photo URL" hint="Upload a file or paste a https / Drive URL">
              <Input
                value={draft.photo_url}
                onChange={(e) => setField('photo_url', e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="# (required)">
              <Input
                value={draft.num}
                onChange={(e) => setField('num', e.target.value)}
                placeholder="120"
              />
            </Field>
            <Field label="Role">
              <Select
                value={draft.role}
                onChange={(e) => setField('role', e.target.value as ParticipantRole)}
              >
                {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Team Name (required)">
              <Input
                value={draft.team_name}
                onChange={(e) => setField('team_name', e.target.value)}
                placeholder="팀명"
              />
            </Field>
            <Field label="Representative">
              <Input
                value={draft.representative}
                onChange={(e) => setField('representative', e.target.value)}
                placeholder="대표자"
              />
            </Field>
          </div>
        </div>
      </section>

      {/* PROFILE */}
      <section className="rounded border border-border bg-bg2/30 p-4">
        <h4 className="text-xs uppercase tracking-widest text-info mb-3">
          Profile <span className="text-ink2/60 normal-case ml-1">(optional)</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PROFILE_FIELDS.map((f) => (
            <Field key={f.key} label={fieldLabel(f.key)} hint={fieldHint(f.key)}>
              {f.type === 'select' && f.options ? (
                <Select
                  value={draft.meta[f.key] ?? ''}
                  onChange={(e) => setMetaField(f.key, e.target.value)}
                >
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
              ) : (
                <Input
                  type={f.type ?? 'text'}
                  value={draft.meta[f.key] ?? ''}
                  onChange={(e) => setMetaField(f.key, e.target.value)}
                  placeholder={fieldHint(f.key) ?? ''}
                />
              )}
            </Field>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Resend confirmation email button ──────────────────────────────────
// PROFILE 섹션 하단에서 호출. 등록 시 메일 발송이 안 된 경우(키 미설정/샌드박스 제한 등)
// 운영자가 ENV 보정 후 수동으로 재발송할 수 있게 한다.
function ResendEmailButton({
  contestId,
  participantId,
  email,
}: {
  contestId: string;
  participantId: string;
  email: string;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function send() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/admin/contests/${encodeURIComponent(contestId)}/participants/${participantId}/resend-email`,
        { method: 'POST' }
      );
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.sent) {
        setResult({ ok: true, msg: `발송 완료 → ${j.to ?? email} (id: ${j.id ?? '-'})` });
      } else {
        const reason = j.reason ?? j.error ?? `HTTP ${res.status}`;
        const detail = j.error && j.error !== reason ? ` · ${j.error}` : '';
        setResult({ ok: false, msg: `발송 실패: ${reason}${detail}` });
      }
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : '네트워크 오류' });
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || !email;
  return (
    <div className="mt-3 flex items-center gap-3 flex-wrap">
      <Button variant="secondary" onClick={send} disabled={disabled}>
        {busy ? t('pf.resendSending') : t('pf.resend')}
      </Button>
      <span className="text-xs text-ink2">
        {email ? `→ ${email}` : t('pf.resendEmailMissing')}
      </span>
      {result && (
        <span className={`text-xs ${result.ok ? 'text-ok' : 'text-danger'}`}>{result.msg}</span>
      )}
    </div>
  );
}

// ─── Photo upload button ────────────────────────────────────────────────
// 숨겨진 <input type="file"> 을 트리거하는 버튼.
// participantId 가 있으면 서버가 photo_url 도 PATCH (응답 .data 로 반영).
// 없으면 (신규 행) 서버는 URL 만 반환 — 호출부에서 draft.photo_url 에 채움.
function PhotoUploadButton({
  contestId,
  participantId,
  compact = false,
  onUploaded,
}: {
  contestId: string;
  participantId?: string;
  compact?: boolean;
  onUploaded: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(file: File) {
    setErr(null);
    if (file.size > 5 * 1024 * 1024) {
      setErr('File too large (max 5MB)');
      return;
    }
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setErr('Only jpeg / png / webp / gif allowed');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    if (participantId) fd.append('participantId', participantId);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/contests/${encodeURIComponent(contestId)}/photo-upload`, {
        method: 'POST',
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.url) {
        setErr(j.error ?? `Upload failed (${res.status})`);
        return;
      }
      onUploaded(j.url as string);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className={compact ? 'flex flex-col gap-0.5' : 'flex flex-col items-center gap-1'}>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button
        type="button"
        variant="secondary"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className={compact ? 'text-[10px] px-1.5 py-0.5' : ''}
      >
        {busy ? 'Uploading…' : compact ? 'Upload' : '📷 Upload'}
      </Button>
      {err && <p className="text-[10px] text-danger max-w-[120px] text-center">{err}</p>}
    </div>
  );
}

function ScoreInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== value) onCommit(v); }}
      inputMode="decimal"
      className="w-14 h-7 rounded border border-border bg-bg2 text-center text-xs focus:outline-none focus:border-accent"
    />
  );
}
