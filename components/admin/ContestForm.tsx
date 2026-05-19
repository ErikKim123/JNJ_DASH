'use client';

// 대회 생성/편집 폼. mode='create' 면 id 입력 허용, mode='edit' 면 id 락.
import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input, Select } from './ui';
import type { ContestRow } from '@/lib/db/types';
import { SCORING_ITEMS, DEFAULT_SCORING_ITEMS, type ScoringItemKey } from '@/lib/db/scoring';

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
  });

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

        <Field label="Design Template Number" hint="DashDisignTemplates/01/02 ...">
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
