'use client';

// 대회 생성/편집 폼. mode='create' 면 id 입력 허용, mode='edit' 면 id 락.
import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input, Select } from './ui';
import type { ContestRow } from '@/lib/db/types';
import { SCORING_ITEMS, DEFAULT_SCORING_ITEMS, type ScoringItemKey } from '@/lib/db/scoring';
import { JOIN_PRESETS, JOIN_PRESET_MAP, resolveJoinPalette } from '@/lib/join/theme';
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
    group_name: initial?.group_name ?? '',
    festival_header: initial?.festival_header ?? '',
    tagline: initial?.tagline ?? '',
    prelim_pass_per_role: initial?.prelim_pass_per_role ?? 10,
    semi_pass_per_role: initial?.semi_pass_per_role ?? 5,
    prelim_group_size: initial?.prelim_group_size ?? 0,
    semi_group_size: initial?.semi_group_size ?? 0,
    prelim_groups: ((): number[] => {
      const a = initial?.prelim_groups;
      if (Array.isArray(a) && a.length) return a.map((n) => Math.max(0, Math.round(Number(n) || 0)));
      return initial?.prelim_group_size ? [initial.prelim_group_size] : [];
    })(),
    semi_groups: ((): number[] => {
      const a = initial?.semi_groups;
      if (Array.isArray(a) && a.length) return a.map((n) => Math.max(0, Math.round(Number(n) || 0)));
      return initial?.semi_group_size ? [initial.semi_group_size] : [];
    })(),
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
    join_theme: ((): string => {
      const k = initial?.join_theme ?? '';
      return JOIN_PRESET_MAP[k] ? k : 'dark';
    })(),
    join_accent: ((): string => {
      const v = initial?.join_accent ?? '';
      return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : '';
    })(),
    sns_url: initial?.sns_url ?? '',
    sns_enabled: initial?.sns_enabled ?? false,
    payment_url: initial?.payment_url ?? '',
    payment_enabled: initial?.payment_enabled ?? true,
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

  // 페어링 그룹 배열 편집 — 그룹별 커플 수 개별 입력.
  type GroupField = 'prelim_groups' | 'semi_groups';
  function setGroupVal(field: GroupField, idx: number, val: number) {
    setForm((s) => {
      const arr = [...s[field]];
      arr[idx] = Math.max(0, Math.min(2000, Math.round(val) || 0));
      return { ...s, [field]: arr };
    });
  }
  function addGroup(field: GroupField) {
    setForm((s) => ({ ...s, [field]: [...s[field], 0] }));
  }
  function removeGroup(field: GroupField, idx: number) {
    setForm((s) => ({ ...s, [field]: s[field].filter((_, i) => i !== idx) }));
  }
  function renderGroupRound(field: GroupField, label: string) {
    const arr = form[field];
    const total = arr.reduce((a, b) => a + (b || 0), 0);
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-ink2">{arr.length} groups · {total} couples</span>
        </div>
        <div className="space-y-2">
          {arr.map((n, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-6 text-center font-mono font-semibold text-accent">
                {String.fromCharCode(65 + idx)}
              </span>
              <Input
                type="number"
                min={0}
                max={2000}
                value={n}
                onChange={(e) => setGroupVal(field, idx, Number(e.target.value))}
                className="w-24"
              />
              <span className="text-xs text-ink2">couples</span>
              <button
                type="button"
                onClick={() => removeGroup(field, idx)}
                className="ml-auto text-danger/80 hover:text-danger text-sm px-2 leading-none"
                aria-label="remove group"
                title="remove group"
              >
                ×
              </button>
            </div>
          ))}
          {arr.length === 0 && (
            <p className="text-xs text-ink2">그룹 없음 — 전체가 한 목록으로 표시됩니다.</p>
          )}
          <button
            type="button"
            onClick={() => addGroup(field)}
            className="text-xs text-accent hover:underline"
          >
            + {t('cf.addGroup')}
          </button>
        </div>
      </div>
    );
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
            <option value="closed">{t('cf.statusClosed')}</option>
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
        <Field label={t('cf.group')} hint={t('cf.groupHint')}>
          <Input
            value={form.group_name}
            onChange={(e) => update('group_name', e.target.value)}
            placeholder="JLCL"
            maxLength={100}
          />
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

      {/* 페어링 그룹(조) 설정 — 그룹당 커플 수. >0 이면 페어링 목록을 A·B·C 그룹으로 분할 표시 */}
      <section className="rounded border border-border bg-panel/40 p-4">
        <h3 className="text-sm font-semibold mb-1">{t('cf.pairingGroupTitle')}</h3>
        <p className="text-xs text-ink2 mb-3">{t('cf.pairingGroupHint')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderGroupRound('prelim_groups', t('cf.pairingPrelim'))}
          {renderGroupRound('semi_groups', t('cf.pairingSemi'))}
        </div>
      </section>

      <section className="rounded border border-border bg-panel/40 p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="text-sm font-semibold">{t('cf.snsTitle')}</h3>
          {/* 활성/비활성 토글 — 비활성이면 done 화면 버튼 자체가 숨겨짐 */}
          <button
            type="button"
            role="switch"
            aria-checked={form.sns_enabled}
            onClick={() => update('sns_enabled', !form.sns_enabled)}
            className="inline-flex items-center gap-2 text-xs"
          >
            <span className="text-ink2">
              {form.sns_enabled ? t('cf.snsEnabledOn') : t('cf.snsEnabledOff')}
            </span>
            <span
              className={`relative w-9 h-5 rounded-full transition ${form.sns_enabled ? 'bg-accent' : 'bg-border'}`}
            >
              <span
                className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition"
                style={{ transform: form.sns_enabled ? 'translateX(16px)' : 'translateX(0)' }}
              />
            </span>
          </button>
        </div>
        <Field label={t('cf.snsLabel')} hint={t('cf.snsHint')}>
          <Input
            type="url"
            value={form.sns_url}
            onChange={(e) => update('sns_url', e.target.value)}
            placeholder="https://open.kakao.com/o/..."
            maxLength={2000}
            disabled={!form.sns_enabled}
          />
        </Field>
      </section>

      <section className="rounded border border-border bg-panel/40 p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="text-sm font-semibold">{t('cf.payTitle')}</h3>
          {/* 활성/비활성 토글 — 비활성이면 done 화면·메일 결제 버튼이 숨겨짐 */}
          <button
            type="button"
            role="switch"
            aria-checked={form.payment_enabled}
            onClick={() => update('payment_enabled', !form.payment_enabled)}
            className="inline-flex items-center gap-2 text-xs"
          >
            <span className="text-ink2">
              {form.payment_enabled ? t('cf.payEnabledOn') : t('cf.payEnabledOff')}
            </span>
            <span
              className={`relative w-9 h-5 rounded-full transition ${form.payment_enabled ? 'bg-accent' : 'bg-border'}`}
            >
              <span
                className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition"
                style={{ transform: form.payment_enabled ? 'translateX(16px)' : 'translateX(0)' }}
              />
            </span>
          </button>
        </div>
        <Field label={t('cf.payLabel')} hint={t('cf.payHint')}>
          <Input
            type="url"
            value={form.payment_url}
            onChange={(e) => update('payment_url', e.target.value)}
            placeholder="https://..."
            maxLength={2000}
            disabled={!form.payment_enabled}
          />
        </Field>
      </section>

      <JoinThemeSection
        presetKey={form.join_theme}
        accent={form.join_accent}
        onPresetChange={(k) => update('join_theme', k)}
        onAccentChange={(a) => update('join_accent', a)}
        contestId={initial?.id ?? form.id}
        groupName={form.group_name}
        canApplyGroup={mode === 'edit'}
        t={t}
      />

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

// ── Tone & Manner (JOIN APP 테마) ──────────────────────────────────────
// 프리셋 테마(라이트/다크/미드나잇 등) + 포인트 색상 오버라이드.
// JOIN 앱 전체(랜딩/목록/등록폼/완료)가 이 값을 따른다.
const ACCENT_PRESETS = ['', '#007D48', '#D30005', '#1151FF', '#F25C05', '#7A3FF2'];
const ACCENT_HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function JoinThemeSection({
  presetKey,
  accent,
  onPresetChange,
  onAccentChange,
  contestId,
  groupName,
  canApplyGroup,
  t,
}: {
  presetKey: string;
  accent: string;
  onPresetChange: (k: string) => void;
  onAccentChange: (a: string) => void;
  contestId: string;
  groupName: string;
  canApplyGroup: boolean;
  t: (key: MessageKey) => string;
}) {
  const p = resolveJoinPalette(presetKey, accent);
  const accentValid = ACCENT_HEX_RE.test(accent);

  const [applyBusy, setApplyBusy] = useState(false);
  const [applyMsg, setApplyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const group = groupName.trim();

  async function applyToGroup() {
    setApplyMsg(null);
    if (!group) {
      setApplyMsg({ ok: false, text: t('cf.themeApplyNoGroup') });
      return;
    }
    if (!confirm(fmt(t('cf.themeApplyConfirm'), { GROUP: group }))) return;
    setApplyBusy(true);
    try {
      const res = await fetch(
        `/api/admin/contests/${encodeURIComponent(contestId)}/apply-theme-to-group`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ join_theme: presetKey, join_accent: accentValid ? accent : '' }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = j.error === 'NO_GROUP' ? t('cf.themeApplyNoGroup') : (j.error ?? `(${res.status})`);
        setApplyMsg({ ok: false, text: reason });
        return;
      }
      setApplyMsg({ ok: true, text: fmt(t('cf.themeApplyDone'), { N: j.data?.applied ?? 0, GROUP: group }) });
    } catch (e) {
      setApplyMsg({ ok: false, text: e instanceof Error ? e.message : 'error' });
    } finally {
      setApplyBusy(false);
    }
  }

  return (
    <section className="rounded border border-border bg-panel/40 p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="text-sm font-semibold">{t('cf.themeTitle')}</h3>
        <span className="text-xs text-ink2">{t('cf.themeMeta')}</span>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* 컨트롤 */}
        <div className="flex flex-col gap-4 flex-1 w-full">
          {/* 프리셋 테마 그리드 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-ink2 uppercase tracking-wide">{t('cf.themePreset')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {JOIN_PRESETS.map((preset) => {
                const active = preset.key === presetKey;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => onPresetChange(preset.key)}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                      active ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-accent/60'
                    }`}
                    style={{ background: preset.bg }}
                    title={preset.label}
                  >
                    <span
                      className="w-5 h-5 rounded-full shrink-0"
                      style={{ background: preset.accent, border: `1px solid ${preset.border}` }}
                    />
                    <span style={{ color: preset.text, fontSize: 12, fontWeight: 600 }}>
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 포인트 색상 (오버라이드) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-ink2 uppercase tracking-wide">{t('cf.themeAccent')}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {ACCENT_PRESETS.map((preset) => {
                const isActive = (accentValid ? accent.toLowerCase() : '') === preset.toLowerCase();
                const isDefault = preset === '';
                return (
                  <button
                    key={preset || 'default'}
                    type="button"
                    onClick={() => onAccentChange(preset)}
                    title={isDefault ? t('cf.themeAccentDefault') : preset}
                    aria-label={isDefault ? t('cf.themeAccentDefault') : preset}
                    className={`w-7 h-7 rounded-full border-2 transition ${
                      isActive ? 'border-accent scale-110' : 'border-border'
                    }`}
                    style={{
                      background: isDefault
                        ? 'repeating-conic-gradient(#bbb 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                        : preset,
                    }}
                  />
                );
              })}
              <input
                type="color"
                value={accentValid ? accent : '#007D48'}
                onChange={(e) => onAccentChange(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer bg-transparent border border-border p-0"
                aria-label={t('cf.themeAccentPick')}
              />
              <input
                type="text"
                value={accent}
                onChange={(e) => onAccentChange(e.target.value)}
                placeholder="#007D48"
                maxLength={7}
                className="w-24 h-7 px-2 text-xs rounded border border-border bg-panel text-ink font-mono"
              />
              {accent && (
                <button
                  type="button"
                  onClick={() => onAccentChange('')}
                  className="text-xs text-ink2 hover:text-danger"
                >
                  {t('cf.themeAccentClear')}
                </button>
              )}
            </div>
            <p className="text-xs text-ink2">{t('cf.themeHint')}</p>
          </div>

          {/* 그룹 일괄 적용 */}
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              variant="primary"
              onClick={applyToGroup}
              disabled={!canApplyGroup || applyBusy || !group}
            >
              {applyBusy
                ? t('cf.themeApplying')
                : group
                  ? fmt(t('cf.themeApplyGroup'), { GROUP: group })
                  : t('cf.themeApplyGroupEmpty')}
            </Button>
            <p className="text-xs text-ink2">
              {canApplyGroup ? t('cf.themeApplyHint') : t('cf.themeApplyNeedsSave')}
            </p>
            {applyMsg && (
              <p className={`text-xs ${applyMsg.ok ? 'text-accent' : 'text-danger'}`} role="status">
                {applyMsg.text}
              </p>
            )}
          </div>
        </div>

        {/* 라이브 프리뷰 */}
        <div className="shrink-0 w-full md:w-56">
          <div className="text-[10px] text-ink2 uppercase tracking-wide mb-1.5">{t('cf.themePreview')}</div>
          <div
            className="rounded-xl p-3 flex flex-col gap-2.5"
            style={{ background: p.bg, border: `1px solid ${p.border}` }}
          >
            <div style={{ color: p.text, fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}>
              PSLF
            </div>
            {/* 대회 카드 */}
            <div
              className="rounded-lg p-2.5 flex items-center justify-between gap-2"
              style={{ background: p.surface, border: `1px solid ${p.border}` }}
            >
              <div className="min-w-0">
                <div
                  className="inline-block px-1.5 py-0.5 rounded-full text-[8px] font-semibold mb-1"
                  style={{ color: '#007D48', border: '1px solid #007D48', background: 'rgba(0,125,72,0.12)' }}
                >
                  OPEN
                </div>
                <div style={{ color: p.text, fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
                  Salsa J&amp;J
                </div>
                <div style={{ color: p.textMuted, fontSize: 9, marginTop: 2 }}>2026-06-01</div>
              </div>
              <div className="w-8 h-8 rounded bg-white shrink-0" style={{ border: `1px solid ${p.border}` }} />
            </div>
            {/* 입력 + 버튼 */}
            <div
              className="rounded-md px-2.5 py-2 text-[10px]"
              style={{ background: p.track, color: p.textMuted, border: `1px solid ${p.border}` }}
            >
              Name
            </div>
            <div
              className="rounded-full py-2 text-center text-[11px] font-semibold"
              style={{ background: p.accent, color: p.onAccent }}
            >
              Submit Entry
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
