'use client';

// 대회 생성/편집 폼. mode='create' 면 id 입력 허용, mode='edit' 면 id 락.
import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input, Select } from './ui';
import type { ContestRow } from '@/lib/db/types';
import { SCORING_ITEMS, DEFAULT_SCORING_ITEMS, type ScoringItemKey } from '@/lib/db/scoring';

const SPONSOR_SLOTS = 6;

export type ContestFormMode = 'create' | 'edit';

export function ContestForm({
  mode,
  initial,
}: {
  mode: ContestFormMode;
  initial?: ContestRow;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    id: initial?.id ?? '',
    name: initial?.name ?? '',
    host_org: initial?.host_org ?? '',
    period_start: initial?.period_start ?? '',
    period_end: initial?.period_end ?? '',
    design_template_number: initial?.design_template_number ?? 1,
    festival_header: initial?.festival_header ?? '',
    tagline: initial?.tagline ?? '',
    prelim_pass_per_role: initial?.prelim_pass_per_role ?? 10,
    semi_pass_per_role: initial?.semi_pass_per_role ?? 5,
    status: initial?.status ?? 'ready',
    scoring_items:
      Array.isArray(initial?.scoring_items) && initial!.scoring_items.length > 0
        ? initial!.scoring_items
        : ([...DEFAULT_SCORING_ITEMS] as ScoringItemKey[]),
    sponsor_logos: ((): string[] => {
      const src = Array.isArray(initial?.sponsor_logos) ? initial!.sponsor_logos : [];
      const arr = [...src];
      while (arr.length < SPONSOR_SLOTS) arr.push('');
      return arr.slice(0, SPONSOR_SLOTS);
    })(),
    sponsor_logo_opacities: ((): number[] => {
      const src = Array.isArray(initial?.sponsor_logo_opacities) ? initial!.sponsor_logo_opacities : [];
      const arr = [...src];
      while (arr.length < SPONSOR_SLOTS) arr.push(100);
      return arr.slice(0, SPONSOR_SLOTS).map((n) => {
        const v = Number(n);
        if (!Number.isFinite(v)) return 100;
        return Math.max(0, Math.min(100, Math.round(v)));
      });
    })(),
  });

  function updateSponsorOpacity(slot: number, value: number) {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    setForm((s) => {
      const next = [...s.sponsor_logo_opacities];
      next[slot] = v;
      return { ...s, sponsor_logo_opacities: next };
    });
  }

  // 슬롯별 업로드 진행/에러 상태
  const [sponsorBusy, setSponsorBusy] = useState<boolean[]>(() => Array(SPONSOR_SLOTS).fill(false));
  const [sponsorErr, setSponsorErr] = useState<(string | null)[]>(() => Array(SPONSOR_SLOTS).fill(null));
  const fileInputs = useRef<Array<HTMLInputElement | null>>(Array(SPONSOR_SLOTS).fill(null));

  async function onSponsorPick(slot: number, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 허용
    if (!file) return;
    if (mode === 'create' && !form.id.trim()) {
      setSponsorErr((arr) => arr.map((v, i) => (i === slot ? '대회 ID 입력 후 업로드 가능' : v)));
      return;
    }
    setSponsorErr((arr) => arr.map((v, i) => (i === slot ? null : v)));
    setSponsorBusy((arr) => arr.map((v, i) => (i === slot ? true : v)));
    try {
      const fd = new FormData();
      fd.append('file', file);
      // create 모드에서는 slot 인덱스만 클라이언트 state 에 반영 (서버 PATCH 는 저장 시 같이 전송).
      // edit 모드에서는 slot 도 함께 보내 contests.sponsor_logos 를 즉시 동기화.
      if (mode === 'edit') fd.append('slot', String(slot));
      const cid = form.id || initial?.id || '';
      const res = await fetch(`/api/admin/contests/${encodeURIComponent(cid)}/sponsor-upload`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `upload failed (${res.status})`);
      }
      const { url } = await res.json();
      setForm((s) => {
        const next = [...s.sponsor_logos];
        next[slot] = url;
        return { ...s, sponsor_logos: next };
      });
    } catch (err) {
      setSponsorErr((arr) =>
        arr.map((v, i) => (i === slot ? (err instanceof Error ? err.message : 'upload failed') : v))
      );
    } finally {
      setSponsorBusy((arr) => arr.map((v, i) => (i === slot ? false : v)));
    }
  }

  function clearSponsor(slot: number) {
    setForm((s) => {
      const next = [...s.sponsor_logos];
      next[slot] = '';
      return { ...s, sponsor_logos: next };
    });
    setSponsorErr((arr) => arr.map((v, i) => (i === slot ? null : v)));
  }

  function toggleScoringItem(key: ScoringItemKey) {
    setForm((s) => {
      const has = s.scoring_items.includes(key);
      const next = has ? s.scoring_items.filter((k) => k !== key) : [...s.scoring_items, key];
      // 항상 최소 1개는 활성 유지
      return { ...s, scoring_items: next.length === 0 ? s.scoring_items : next };
    });
  }

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = {
        ...form,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
      };
      const url =
        mode === 'create'
          ? '/api/admin/contests'
          : `/api/admin/contests/${encodeURIComponent(form.id)}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      // PATCH 에는 id 보내지 않음 (서버는 URL 의 id 사용)
      const body =
        mode === 'create' ? payload : (() => { const { id, ...rest } = payload; void id; return rest; })();
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Request failed (${res.status})`);
        return;
      }
      const j = await res.json();
      router.push(`/admin/contests/${encodeURIComponent(j.data.id)}`);
      router.refresh();
    });
  }

  async function onDelete() {
    if (mode !== 'edit') return;
    if (!confirm(`Delete contest ${form.id} and all related data (participants/pairings/qualifiers/finals). Continue?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/contests/${encodeURIComponent(form.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError(`Delete failed (${res.status})`);
        return;
      }
      router.push('/admin');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Contest ID (slug)" hint="Alnum / - / _ only. e.g. JNJ-004">
          <Input
            value={form.id}
            onChange={(e) => update('id', e.target.value)}
            disabled={mode === 'edit'}
            required
            placeholder="JNJ-004"
            pattern="[A-Za-z0-9_-]+"
          />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => update('status', e.target.value as ContestRow['status'])}>
            <option value="ready">ready</option>
            <option value="live">live</option>
            <option value="done">done</option>
            <option value="archived">archived</option>
          </Select>
        </Field>

        <Field label="Name">
          <Input value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </Field>
        <Field label="Host Organization">
          <Input value={form.host_org} onChange={(e) => update('host_org', e.target.value)} />
        </Field>

        <Field label="Start Date">
          <Input type="date" value={form.period_start} onChange={(e) => update('period_start', e.target.value)} />
        </Field>
        <Field label="End Date">
          <Input type="date" value={form.period_end} onChange={(e) => update('period_end', e.target.value)} />
        </Field>

        <Field label="Design Template Number" hint="DashDesignTemplates/01/02 ...">
          <Input
            type="number"
            min={1}
            max={99}
            value={form.design_template_number}
            onChange={(e) => update('design_template_number', Number(e.target.value))}
          />
        </Field>
        <Field label=" ">
          <div />
        </Field>

        <Field label="Prelim Qualifiers (per role)">
          <Input
            type="number"
            min={1}
            max={200}
            value={form.prelim_pass_per_role}
            onChange={(e) => update('prelim_pass_per_role', Number(e.target.value))}
          />
        </Field>
        <Field label="Semi Qualifiers (per role)">
          <Input
            type="number"
            min={1}
            max={200}
            value={form.semi_pass_per_role}
            onChange={(e) => update('semi_pass_per_role', Number(e.target.value))}
          />
        </Field>

        <Field label="Festival Header (display)" hint="Defaults to contest name if blank">
          <Input value={form.festival_header} onChange={(e) => update('festival_header', e.target.value)} />
        </Field>
        <Field label="Tagline (display)">
          <Input value={form.tagline} onChange={(e) => update('tagline', e.target.value)} />
        </Field>
      </div>

      <section className="rounded border border-border bg-panel/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">PREP 화면 하단 광고 (Sponsor Logos)</h3>
          <span className="text-xs text-ink2">
            최대 {SPONSOR_SLOTS}개 · PREP 단계에서만 표출 · 3MB · jpg/png/webp/gif/svg
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {form.sponsor_logos.map((url, slot) => {
            const busy = sponsorBusy[slot];
            const err = sponsorErr[slot];
            const op = form.sponsor_logo_opacities[slot] ?? 100;
            return (
              <div
                key={slot}
                className="rounded border border-border bg-bg2 p-2 flex flex-col gap-2"
              >
                <div className="text-xs text-ink2 flex items-center justify-between gap-2">
                  <span className="shrink-0">슬롯 {slot + 1}</span>
                  <div className="flex items-center gap-1 flex-1 justify-end">
                    <label className="text-ink2 text-[10px] uppercase tracking-wide">투명도</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={op}
                      onChange={(e) => updateSponsorOpacity(slot, Number(e.target.value))}
                      className="w-12 h-6 px-1 text-xs rounded border border-border bg-panel text-ink text-right tabular-nums"
                    />
                    <span className="text-ink2 text-[10px]">%</span>
                  </div>
                  {url && (
                    <button
                      type="button"
                      onClick={() => clearSponsor(slot)}
                      className="text-danger hover:underline shrink-0"
                    >
                      제거
                    </button>
                  )}
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={op}
                  onChange={(e) => updateSponsorOpacity(slot, Number(e.target.value))}
                  className="w-full h-1 accent-accent"
                  aria-label={`슬롯 ${slot + 1} 투명도`}
                />
                <div className="h-20 rounded border border-dashed border-border bg-panel/60 flex items-center justify-center overflow-hidden">
                  {url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={url}
                      alt={`sponsor ${slot + 1}`}
                      className="max-h-full max-w-full object-contain"
                      style={{ opacity: op / 100 }}
                    />
                  ) : (
                    <span className="text-xs text-ink2">미설정</span>
                  )}
                </div>
                <input
                  ref={(el) => {
                    fileInputs.current[slot] = el;
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  onChange={(e) => onSponsorPick(slot, e)}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => fileInputs.current[slot]?.click()}
                  disabled={busy}
                >
                  {busy ? '업로드 중…' : url ? '교체' : '이미지 업로드'}
                </Button>
                {err && (
                  <p className="text-xs text-danger" role="alert">
                    {err}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-ink2 mt-3">
          이미지는 Supabase Storage 의 <code>contest-sponsors</code> 버킷에 저장됩니다.
          업로드 후에는 <b>Save</b> 를 눌러 대회 레코드와 연결을 마무리하세요.
        </p>
      </section>

      <section className="rounded border border-border bg-panel/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Final Round Scoring Items</h3>
          <span className="text-xs text-ink2">
            {form.scoring_items.length} active · at least 1 required
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {SCORING_ITEMS.map((item) => {
            const active = form.scoring_items.includes(item.key);
            return (
              <label
                key={item.key}
                className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition ${
                  active
                    ? 'border-accent bg-accent/10 text-ink'
                    : 'border-border bg-bg2 text-ink2 hover:border-accent/60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleScoringItem(item.key)}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm">{item.label}</span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-ink2 mt-3">
          Only active items appear on the Final Judging matrix. Existing scores for deactivated items are preserved in DB.
        </p>
      </section>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
        </Button>
        {mode === 'edit' && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={pending}>
            Delete Contest
          </Button>
        )}
      </div>
    </form>
  );
}
