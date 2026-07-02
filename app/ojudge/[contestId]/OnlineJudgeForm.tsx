'use client';

// 온라인 심사위원 셀프 등록 폼 — JOIN 참가자 폼과 동일 디자인/위젯 재사용.
// 필드: 사진 · 이름(First/Last) · 국가 · 이메일 · 연락처(WhatsApp) · 4자리 PIN.
// 제출: /api/ojudge/[contestId]/submit → 성공 시 /ojudge/[contestId]/done 로 이동.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizePhotoUrl } from '@/lib/photo';
import {
  COUNTRY_CODES,
  CountrySelect,
  WhatsAppInput,
  compressImage,
  Field,
  LangToggle,
  PhotoPreview,
  type Lang,
} from '../../join/_components/form-widgets';

const T = {
  basic: { ko: 'Basic', en: 'Basic' },
  security: { ko: '비밀번호', en: 'Password' },
  uploadPhoto: { ko: '사진 업로드', en: 'Upload Photo' },
  uploading: { ko: '업로드 중…', en: 'Uploading…' },
  photoHint: {
    ko: '얼굴이 잘 보이는 사진을 올려주세요 · JPEG / PNG / WebP',
    en: 'Please upload a photo with your face clearly visible · JPEG / PNG / WebP',
  },
  noPhoto: { ko: '사진 없음', en: 'No photo' },
  firstNameLabel: { ko: '이름 (First name · 필수)', en: 'First name (required)' },
  firstNamePlaceholder: { ko: '이름', en: 'First name' },
  lastNameLabel: { ko: '성 (Last name · 필수)', en: 'Last name (required)' },
  lastNamePlaceholder: { ko: '성', en: 'Last name' },
  repLabel: { ko: '국가 (필수)', en: 'Country (required)' },
  repPlaceholder: { ko: '국가 선택', en: 'Select country' },
  emailLabel: { ko: '이메일 (필수)', en: 'Email (required)' },
  phoneLabel: { ko: '연락처 (필수)', en: 'WhatsApp Number (required)' },
  pinLabel: { ko: '비밀번호 (숫자 4자리 · 필수)', en: 'Password (4 digits · required)' },
  pinHint: {
    ko: '채점 접속 시 사용할 4자리 숫자 비밀번호입니다. 잊지 않게 기억해 주세요.',
    en: 'A 4-digit numeric password for signing in to judge. Please remember it.',
  },
  pinConfirmLabel: { ko: '비밀번호 확인 (필수)', en: 'Confirm password (required)' },
  submit: { ko: '심사위원 등록', en: 'Register as Judge' },
  submitting: { ko: '제출 중…', en: 'Submitting…' },
  errFirst: { ko: '이름(First name)을 입력해주세요.', en: 'Please enter a first name.' },
  errLast: { ko: '성(Last name)을 입력해주세요.', en: 'Please enter a last name.' },
  errRep: { ko: '국가를 입력해주세요.', en: 'Please enter a country.' },
  errEmail: { ko: '이메일을 입력해주세요.', en: 'Please enter an email.' },
  errEmailFormat: { ko: '올바른 이메일 형식이 아닙니다.', en: 'Please enter a valid email.' },
  errPhone: { ko: '연락처(WhatsApp)를 입력해주세요.', en: 'Please enter your WhatsApp number.' },
  errPin: { ko: '숫자 4자리 비밀번호를 입력해주세요.', en: 'Please enter a 4-digit numeric password.' },
  errPinMatch: { ko: '비밀번호가 일치하지 않습니다.', en: 'Passwords do not match.' },
  errDuplicate: {
    ko: '이미 등록된 이메일 또는 연락처입니다.',
    en: 'This email or number is already registered.',
  },
  errNet: { ko: '네트워크 오류', en: 'Network error' },
  errPhoto: { ko: '사진 업로드 실패', en: 'Photo upload failed' },
  errSubmit: { ko: '등록 실패', en: 'Registration failed' },
  errFileSize: { ko: '파일이 너무 큽니다 (최대 5MB).', en: 'File too large (max 5MB).' },
  errFileType: { ko: '이미지 파일만 업로드 가능합니다 (jpeg/png/webp/gif).', en: 'Only image files allowed (jpeg/png/webp/gif).' },
} as const;

function t(key: keyof typeof T, lang: Lang): string {
  return T[key][lang];
}

interface Draft {
  first_name: string;
  last_name: string;
  representative: string;
  email: string;
  phone: string;
  photo_url: string;
  pin: string;
  pin_confirm: string;
}

export function OnlineJudgeForm({ contestId }: { contestId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [draft, setDraft] = useState<Draft>({
    first_name: '',
    last_name: '',
    representative: '',
    email: '',
    phone: '',
    photo_url: '',
    pin: '',
    pin_confirm: '',
  });
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function uploadPhoto(file: File) {
    setError(null);
    if (!/^image\//.test(file.type)) { setError(t('errFileType', lang)); return; }
    if (file.size > 40 * 1024 * 1024) { setError(t('errFileSize', lang)); return; }
    setPhotoBusy(true);
    try {
      let toUpload = file;
      if (file.type !== 'image/gif') {
        try {
          toUpload = await compressImage(file, { maxDim: 1600, targetBytes: 3 * 1024 * 1024 });
        } catch {
          toUpload = file;
        }
      }
      if (toUpload.size > 5 * 1024 * 1024) { setError(t('errFileSize', lang)); return; }
      if (!/^image\/(jpeg|png|webp|gif)$/.test(toUpload.type)) { setError(t('errFileType', lang)); return; }
      const fd = new FormData();
      fd.append('file', toUpload);
      const res = await fetch(`/api/ojudge/${encodeURIComponent(contestId)}/photo`, { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.url) {
        setError(j.error ?? `${t('errPhoto', lang)} (${res.status})`);
        return;
      }
      setField('photo_url', j.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errNet', lang));
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submit() {
    setError(null);
    if (!draft.first_name.trim()) { setError(t('errFirst', lang)); return; }
    if (!draft.last_name.trim()) { setError(t('errLast', lang)); return; }
    if (!draft.representative.trim()) { setError(t('errRep', lang)); return; }
    const email = draft.email.trim();
    if (!email) { setError(t('errEmail', lang)); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(t('errEmailFormat', lang)); return; }
    const phoneDigits = draft.phone.replace(/\D/g, '');
    if (phoneDigits.length < 5) { setError(t('errPhone', lang)); return; }
    if (!/^\d{4}$/.test(draft.pin)) { setError(t('errPin', lang)); return; }
    if (draft.pin !== draft.pin_confirm) { setError(t('errPinMatch', lang)); return; }

    setBusy(true);
    try {
      const res = await fetch(`/api/ojudge/${encodeURIComponent(contestId)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: draft.first_name.trim(),
          last_name: draft.last_name.trim(),
          representative: draft.representative.trim(),
          email,
          phone: draft.phone.trim(),
          photo_url: draft.photo_url,
          pin: draft.pin,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.data) {
        if (j.error === 'DUPLICATE') { setError(t('errDuplicate', lang)); return; }
        if (j.error === 'PHONE_REQUIRED') { setError(t('errPhone', lang)); return; }
        if (j.error === 'PIN_INVALID') { setError(t('errPin', lang)); return; }
        setError(j.error ?? `${t('errSubmit', lang)} (${res.status})`);
        return;
      }
      const params = new URLSearchParams({
        num: String(j.data.display_order ?? ''),
        name: draft.first_name.trim(),
      });
      router.push(`/ojudge/${encodeURIComponent(contestId)}/done?${params.toString()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errNet', lang));
    } finally {
      setBusy(false);
    }
  }

  const photoPreview = draft.photo_url ? normalizePhotoUrl(draft.photo_url) : '';

  return (
    <div className="jnj-stack-6">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <LangToggle lang={lang} onChange={setLang} />
      </div>

      {/* BASIC */}
      <section>
        <h2 className="jnj-section-title">{t('basic', lang)}</h2>
        <div className="jnj-card jnj-stack-4">
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <PhotoPreview url={photoPreview} emptyLabel={t('noPhoto', lang)} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPhoto(f);
                }}
              />
              <button
                type="button"
                className="jnj-btn jnj-btn-secondary"
                onClick={() => fileRef.current?.click()}
                disabled={photoBusy}
              >
                {photoBusy ? t('uploading', lang) : t('uploadPhoto', lang)}
              </button>
              <p className="jnj-small">{t('photoHint', lang)}</p>
            </div>
          </div>

          <Field label={t('firstNameLabel', lang)}>
            <input
              type="text"
              className="jnj-input"
              value={draft.first_name}
              onChange={(e) => setField('first_name', e.target.value)}
              placeholder={t('firstNamePlaceholder', lang)}
              maxLength={200}
            />
          </Field>

          <Field label={t('lastNameLabel', lang)}>
            <input
              type="text"
              className="jnj-input"
              value={draft.last_name}
              onChange={(e) => setField('last_name', e.target.value)}
              placeholder={t('lastNamePlaceholder', lang)}
              maxLength={200}
            />
          </Field>

          <Field label={t('phoneLabel', lang)}>
            <WhatsAppInput
              value={draft.phone}
              onChange={(v) => setField('phone', v)}
              placeholder={lang === 'ko' ? '010-0000-0000' : '10-1234-5678'}
              selectLabel={lang === 'ko' ? '국가 선택' : 'Select'}
              defaultDial=""
            />
          </Field>

          <Field label={t('repLabel', lang)}>
            <CountrySelect
              value={draft.representative}
              onChange={(v) => setField('representative', v)}
              placeholder={t('repPlaceholder', lang)}
              options={COUNTRY_CODES}
            />
          </Field>

          <Field label={t('emailLabel', lang)}>
            <input
              type="email"
              className="jnj-input"
              value={draft.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="name@example.com"
              maxLength={320}
            />
          </Field>
        </div>
      </section>

      {/* PASSWORD */}
      <section>
        <h2 className="jnj-section-title">{t('security', lang)}</h2>
        <div className="jnj-card jnj-stack-4">
          <Field label={t('pinLabel', lang)}>
            <input
              type="tel"
              inputMode="numeric"
              className="jnj-input"
              value={draft.pin}
              onChange={(e) => setField('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
              maxLength={4}
              style={{ letterSpacing: '0.4em', fontWeight: 700 }}
            />
            <p className="jnj-small">{t('pinHint', lang)}</p>
          </Field>
          <Field label={t('pinConfirmLabel', lang)}>
            <input
              type="tel"
              inputMode="numeric"
              className="jnj-input"
              value={draft.pin_confirm}
              onChange={(e) => setField('pin_confirm', e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
              maxLength={4}
              style={{ letterSpacing: '0.4em', fontWeight: 700 }}
            />
          </Field>
        </div>
      </section>

      {error && (
        <p
          role="alert"
          style={{
            color: 'var(--jnj-red)',
            fontSize: 14,
            margin: 0,
            padding: '12px 16px',
            background: 'rgba(211, 0, 5, 0.10)',
            borderRadius: 8,
          }}
        >
          {error}
        </p>
      )}

      <div
        style={{
          position: 'sticky',
          bottom: 16,
          paddingTop: 16,
          background: 'linear-gradient(to top, var(--jnj-bg) 70%, transparent)',
        }}
      >
        <button
          type="button"
          onClick={submit}
          disabled={busy || photoBusy}
          className="jnj-btn jnj-btn-primary jnj-btn-full jnj-btn-lg"
        >
          {busy ? t('submitting', lang) : t('submit', lang)}
        </button>
      </div>
    </div>
  );
}
