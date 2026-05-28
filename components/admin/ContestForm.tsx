'use client';

// 대회 생성/편집 폼. mode='create' 면 id 입력 허용, mode='edit' 면 id 락.
import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input, Select } from './ui';
import type { ContestRow } from '@/lib/db/types';
import { SCORING_ITEMS, DEFAULT_SCORING_ITEMS, type ScoringItemKey } from '@/lib/db/scoring';
import { useT } from '@/lib/i18n/LocaleContext';
import type { MessageKey } from '@/lib/i18n/messages';

const SPONSOR_SLOTS = 6;

/** 간단한 {KEY} → value 치환. messages.ts 의 placeholder 패턴과 일치. */
function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export type ContestFormMode = 'create' | 'edit';

export function ContestForm({
  mode,
  initial,
}: {
  mode: ContestFormMode;
  initial?: ContestRow;
}) {
  const router = useRouter();
  const t = useT();
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
    background_image: initial?.background_image ?? '',
    background_opacity: ((): number => {
      const v = initial?.background_opacity;
      if (typeof v !== 'number' || !Number.isFinite(v)) return 100;
      return Math.max(0, Math.min(100, Math.round(v)));
    })(),
  });

  function updateBackgroundOpacity(value: number) {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    setForm((s) => ({ ...s, background_opacity: v }));
  }

  // 배경 이미지 업로드 상태
  const [bgBusy, setBgBusy] = useState(false);
  const [bgErr, setBgErr] = useState<string | null>(null);
  const bgInputRef = useRef<HTMLInputElement | null>(null);

  async function onBackgroundPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (mode === 'create' && !form.id.trim()) {
      setBgErr(t('cf.bgIdRequired'));
      return;
    }
    setBgErr(null);
    setBgBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const cid = form.id || initial?.id || '';
      const res = await fetch(`/api/admin/contests/${encodeURIComponent(cid)}/background-upload`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `upload failed (${res.status})`);
      }
      const { url } = await res.json();
      setForm((s) => ({ ...s, background_image: url }));
      // 업로드 라우트가 contests.background_image 를 이미 DB 에 기록함.
      // 서버 컴포넌트 캐시를 비워 다음 SSR 에서 최신 값이 반영되도록 한다.
      router.refresh();
    } catch (err) {
      setBgErr(err instanceof Error ? err.message : t('cf.bgUploadFailed'));
    } finally {
      setBgBusy(false);
    }
  }

  function clearBackground() {
    setForm((s) => ({ ...s, background_image: '' }));
    setBgErr(null);
  }

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
      setSponsorErr((arr) => arr.map((v, i) => (i === slot ? t('cf.sponsorIdRequired') : v)));
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
      router.refresh();
    } catch (err) {
      setSponsorErr((arr) =>
        arr.map((v, i) => (i === slot ? (err instanceof Error ? err.message : t('cf.sponsorUploadFailed')) : v))
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
        setError(j.error ?? fmt(t('cf.requestFailed'), { STATUS: res.status }));
        return;
      }
      const j = await res.json();
      router.push(`/admin/contests/${encodeURIComponent(j.data.id)}`);
      router.refresh();
    });
  }

  async function onDelete() {
    if (mode !== 'edit') return;
    if (!confirm(fmt(t('cf.deleteConfirm'), { ID: form.id }))) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/contests/${encodeURIComponent(form.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError(fmt(t('cf.deleteFailed'), { STATUS: res.status }));
        return;
      }
      router.push('/admin');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t('cf.id')} hint={t('cf.idHint')}>
          <Input
            value={form.id}
            onChange={(e) => update('id', e.target.value)}
            disabled={mode === 'edit'}
            required
            placeholder="JNJ-004"
            pattern="[A-Za-z0-9_-]+"
          />
        </Field>
        <Field label={t('cf.status')}>
          <Select value={form.status} onChange={(e) => update('status', e.target.value as ContestRow['status'])}>
            <option value="ready">{t('cf.statusReady')}</option>
            <option value="live">{t('cf.statusLive')}</option>
            <option value="done">{t('cf.statusDone')}</option>
            <option value="archived">{t('cf.statusArchived')}</option>
          </Select>
        </Field>

        <Field label={t('cf.name')}>
          <Input value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </Field>
        <Field label={t('cf.hostOrg')}>
          <Input value={form.host_org} onChange={(e) => update('host_org', e.target.value)} />
        </Field>

        <Field label={t('cf.startDate')}>
          <Input type="date" value={form.period_start} onChange={(e) => update('period_start', e.target.value)} />
        </Field>
        <Field label={t('cf.endDate')}>
          <Input type="date" value={form.period_end} onChange={(e) => update('period_end', e.target.value)} />
        </Field>

        <Field label={t('cf.templateNumber')} hint={t('cf.templateNumberHint')}>
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

        <Field label={t('cf.prelimQualifiers')}>
          <Input
            type="number"
            min={1}
            max={200}
            value={form.prelim_pass_per_role}
            onChange={(e) => update('prelim_pass_per_role', Number(e.target.value))}
          />
        </Field>
        <Field label={t('cf.semiQualifiers')}>
          <Input
            type="number"
            min={1}
            max={200}
            value={form.semi_pass_per_role}
            onChange={(e) => update('semi_pass_per_role', Number(e.target.value))}
          />
        </Field>

        <Field label={t('cf.festivalHeader')} hint={t('cf.festivalHeaderHint')}>
          <Input value={form.festival_header} onChange={(e) => update('festival_header', e.target.value)} />
        </Field>
        <Field label={t('cf.tagline')}>
          <Input value={form.tagline} onChange={(e) => update('tagline', e.target.value)} />
        </Field>
      </div>

      <section className="rounded border border-border bg-panel/40 p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="text-sm font-semibold">{t('cf.bgTitle')}</h3>
          <span className="text-xs text-ink2">{t('cf.bgMeta')}</span>
        </div>
        <div className="flex flex-col md:flex-row gap-3 items-start">
          <div className="w-full md:w-80 aspect-[16/9] rounded border border-dashed border-border bg-panel/60 flex items-center justify-center overflow-hidden shrink-0">
            {form.background_image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={form.background_image}
                alt="contest background"
                className="w-full h-full object-cover"
                style={{ opacity: form.background_opacity / 100 }}
              />
            ) : (
              <span className="text-xs text-ink2 px-3 text-center">{t('cf.bgNotSet')}</span>
            )}
          </div>
          <div className="flex flex-col gap-2 flex-1 w-full">
            <input
              ref={bgInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onBackgroundPick}
              className="hidden"
            />
            <Button
              type="button"
              variant="primary"
              onClick={() => bgInputRef.current?.click()}
              disabled={bgBusy}
            >
              {bgBusy ? t('cf.bgUploading') : form.background_image ? t('cf.bgReplace') : t('cf.bgUpload')}
            </Button>
            <div className="flex items-center gap-2 px-1">
              <label className="text-xs text-ink2 uppercase tracking-wide shrink-0">
                {t('cf.bgOpacity')}
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={form.background_opacity}
                onChange={(e) => updateBackgroundOpacity(Number(e.target.value))}
                className="flex-1 h-1 accent-accent"
                aria-label={t('cf.bgOpacityAria')}
                disabled={!form.background_image}
              />
              <input
                type="number"
                min={0}
                max={100}
                value={form.background_opacity}
                onChange={(e) => updateBackgroundOpacity(Number(e.target.value))}
                className="w-14 h-6 px-1 text-xs rounded border border-border bg-panel text-ink text-right tabular-nums"
                disabled={!form.background_image}
              />
              <span className="text-ink2 text-xs">%</span>
            </div>
            {form.background_image && (
              <Button type="button" variant="danger" onClick={clearBackground} disabled={bgBusy}>
                {t('cf.bgRemove')}
              </Button>
            )}
            {bgErr && (
              <p className="text-xs text-danger" role="alert">
                {bgErr}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded border border-border bg-panel/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{t('cf.sponsorTitle')}</h3>
          <span className="text-xs text-ink2">
            {fmt(t('cf.sponsorMeta'), { N: SPONSOR_SLOTS })}
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
                  <span className="shrink-0">{fmt(t('cf.sponsorSlot'), { N: slot + 1 })}</span>
                  <div className="flex items-center gap-1 flex-1 justify-end">
                    <label className="text-ink2 text-[10px] uppercase tracking-wide">{t('cf.sponsorOpacity')}</label>
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
                      {t('cf.sponsorRemove')}
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
                  aria-label={fmt(t('cf.sponsorOpacityAria'), { N: slot + 1 })}
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
                    <span className="text-xs text-ink2">{t('cf.sponsorNotSet')}</span>
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
                  {busy ? t('cf.sponsorUploading') : url ? t('cf.sponsorReplace') : t('cf.sponsorUpload')}
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
        <p
          className="text-xs text-ink2 mt-3"
          dangerouslySetInnerHTML={{ __html: t('cf.sponsorHint') }}
        />
      </section>

      <section className="rounded border border-border bg-panel/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{t('cf.scoringTitle')}</h3>
          <span className="text-xs text-ink2">
            {fmt(t('cf.scoringMeta'), { N: form.scoring_items.length })}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {SCORING_ITEMS.map((item) => {
            const active = form.scoring_items.includes(item.key);
            const labelKey = `cf.scoring.${item.key}` as MessageKey;
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
                <span className="text-sm">{t(labelKey)}</span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-ink2 mt-3">{t('cf.scoringHint')}</p>
      </section>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button
          type="submit"
          variant="primary"
          disabled={pending || bgBusy || sponsorBusy.some(Boolean)}
        >
          {pending ? t('cf.saving') : mode === 'create' ? t('cf.create') : t('cf.save')}
        </Button>
        {mode === 'edit' && (
          <Button
            type="button"
            variant="danger"
            onClick={onDelete}
            disabled={pending || bgBusy || sponsorBusy.some(Boolean)}
          >
            {t('cf.delete')}
          </Button>
        )}
      </div>
    </form>
  );
}
