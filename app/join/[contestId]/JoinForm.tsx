'use client';

// 참가자 신청 폼 — BASIC + PROFILE.
// 사진 업로드는 /api/join/[contestId]/photo, 제출은 /api/join/[contestId]/submit.
// 제출 성공 시 /join/[contestId]/done?num={번호} 로 이동.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ParticipantRole } from '@/lib/db/types';
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
} from '../_components/form-widgets';

const ROLE_OPTIONS: { value: ParticipantRole; label: string }[] = [
  { value: 'leader', label: 'Leader' },
  { value: 'follower', label: 'Follower' },
];

// 부문/장르 선택지 — value 와 라벨 모두 영문 단일 키 (대회 운영 표준 명칭).
const CATEGORY_OPTIONS: { value: string; label: { ko: string; en: string } }[] = [
  { value: 'Jack & Jill', label: { ko: 'Jack & Jill', en: 'Jack & Jill' } },
  { value: 'Battle', label: { ko: 'Battle', en: 'Battle' } },
  { value: 'Competition', label: { ko: 'Competition', en: 'Competition' } },
];

const GENRE_OPTIONS: { value: string; label: { ko: string; en: string } }[] = [
  { value: 'Salsa', label: { ko: 'Salsa', en: 'Salsa' } },
  { value: 'Bachata', label: { ko: 'Bachata', en: 'Bachata' } },
  { value: 'Kizomba', label: { ko: 'Kizomba', en: 'Kizomba' } },
  { value: 'Zouk', label: { ko: 'Zouk', en: 'Zouk' } },
];

const DIVISION_OPTIONS: { value: string; label: { ko: string; en: string } }[] = [
  { value: 'Solo', label: { ko: 'Solo', en: 'Solo' } },
  { value: 'Couple', label: { ko: 'Couple', en: 'Couple' } },
  { value: 'Team', label: { ko: 'Team', en: 'Team' } },
];

const PROFILE_FIELDS: {
  key: string;
  label: { ko: string; en: string };
  placeholder?: { ko: string; en: string };
  type?: 'text' | 'email' | 'date' | 'tel' | 'whatsapp' | 'select';
  options?: { value: string; label: { ko: string; en: string } }[];
  required?: boolean;
}[] = [
  { key: '부문', label: { ko: '부문', en: 'Category' }, type: 'select', options: CATEGORY_OPTIONS, placeholder: { ko: '부문 선택', en: 'Select category' } },
  { key: '장르', label: { ko: '장르', en: 'Genre' }, type: 'select', options: GENRE_OPTIONS, placeholder: { ko: '장르 선택', en: 'Select genre' } },
  { key: 'Division', label: { ko: '구분', en: 'Division' }, type: 'select', options: DIVISION_OPTIONS, placeholder: { ko: '구분 선택', en: 'Select division' } },
  // '연락처'(WhatsApp)와 '이메일'은 BASIC 섹션으로 이동 — 아래 렌더에서 직접 처리.
  // '접수일'은 폼에 노출하지 않고 등록 시 자동으로 오늘 날짜로 저장된다(meta 초기값).
  { key: 'X', label: { ko: '인스타 (@)', en: 'Instagram (@)' }, placeholder: { ko: '@your_id', en: '@your_id' } },
];


const T = {
  basic: { ko: 'Basic', en: 'Basic' },
  profile: { ko: 'Profile', en: 'Profile' },
  uploadPhoto: { ko: '사진 업로드', en: 'Upload Photo' },
  uploading: { ko: '업로드 중…', en: 'Uploading…' },
  photoHint: {
    ko: '얼굴이 잘 보이는 사진을 올려주세요 · JPEG / PNG / WebP',
    en: 'Please upload a photo with your face clearly visible · JPEG / PNG / WebP',
  },
  noPhoto: { ko: '사진 없음', en: 'No photo' },
  numLabel: { ko: '참가 번호 (자동 부여)', en: 'Entry Number (auto)' },
  roleLabel: { ko: '역할 (Role)', en: 'Role' },
  firstNameLabel: { ko: '이름 (First name · 필수)', en: 'First name (required)' },
  firstNamePlaceholder: { ko: '이름', en: 'First name' },
  lastNameLabel: { ko: '성 (Last name · 필수)', en: 'Last name (required)' },
  lastNamePlaceholder: { ko: '성', en: 'Last name' },
  repLabel: { ko: '국가 (필수)', en: 'Country (required)' },
  repPlaceholder: { ko: '국가 선택', en: 'Select country' },
  submit: { ko: '신청하기', en: 'Submit Entry' },
  submitting: { ko: '제출 중…', en: 'Submitting…' },
  errTeam: { ko: '이름(First name)을 입력해주세요.', en: 'Please enter a first name.' },
  errLastName: { ko: '성(Last name)을 입력해주세요.', en: 'Please enter a last name.' },
  errRep: { ko: '국가를 입력해주세요.', en: 'Please enter a country.' },
  errEmail: { ko: '이메일을 입력해주세요.', en: 'Please enter an email.' },
  errEmailFormat: { ko: '올바른 이메일 형식이 아닙니다.', en: 'Please enter a valid email.' },
  errPhone: { ko: '연락처(WhatsApp)를 입력해주세요.', en: 'Please enter your WhatsApp number.' },
  errDuplicate: {
    ko: '이미 등록된 연락처 또는 이메일입니다. 기존에 보내드린 확인 이메일을 확인해주세요.',
    en: 'This number or email is already registered. Please check the confirmation email we sent you earlier.',
  },
  errFileSize: { ko: '파일이 너무 큽니다 (최대 5MB).', en: 'File too large (max 5MB).' },
  errFileType: { ko: '이미지 파일만 업로드 가능합니다 (jpeg/png/webp/gif).', en: 'Only image files allowed (jpeg/png/webp/gif).' },
  errNet: { ko: '네트워크 오류', en: 'Network error' },
  errPhoto: { ko: '사진 업로드 실패', en: 'Photo upload failed' },
  errSubmit: { ko: '신청 실패', en: 'Submission failed' },
} as const;

function t(key: keyof typeof T, lang: Lang): string {
  return T[key][lang];
}

interface Draft {
  first_name: string;
  last_name: string;
  representative: string;
  role: ParticipantRole;
  photo_url: string;
  meta: Record<string, string>;
}

const todayIso = () => {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export function JoinForm({
  contestId,
  suggestedNum,
}: {
  contestId: string;
  suggestedNum: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [draft, setDraft] = useState<Draft>({
    first_name: '',
    last_name: '',
    representative: '',
    role: 'leader',
    photo_url: '',
    meta: { 접수일: todayIso() },
  });
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function setMeta(k: string, v: string) {
    setDraft((d) => ({ ...d, meta: { ...d.meta, [k]: v } }));
  }

  async function uploadPhoto(file: File) {
    setError(null);
    if (!/^image\//.test(file.type)) {
      setError(t('errFileType', lang));
      return;
    }
    // 메모리 보호용 상한 — 이보다 큰 원본은 거부(브라우저 디코딩 부담).
    if (file.size > 40 * 1024 * 1024) {
      setError(t('errFileSize', lang));
      return;
    }
    setPhotoBusy(true);
    try {
      // 큰 사진도 받기 위해 업로드 전 클라이언트에서 리사이즈·압축한다.
      // GIF(애니메이션)는 압축 시 깨질 수 있어 원본을 그대로 사용.
      let toUpload = file;
      if (file.type !== 'image/gif') {
        try {
          toUpload = await compressImage(file, { maxDim: 1600, targetBytes: 3 * 1024 * 1024 });
        } catch {
          toUpload = file; // 압축 실패 시 원본으로 시도
        }
      }
      // 압축 후에도 서버 한도(5MB)를 넘으면 거부 — 보통 GIF/특수 케이스.
      if (toUpload.size > 5 * 1024 * 1024) {
        setError(t('errFileSize', lang));
        return;
      }
      if (!/^image\/(jpeg|png|webp|gif)$/.test(toUpload.type)) {
        setError(t('errFileType', lang));
        return;
      }
      const fd = new FormData();
      fd.append('file', toUpload);
      const res = await fetch(`/api/join/${encodeURIComponent(contestId)}/photo`, {
        method: 'POST',
        body: fd,
      });
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
    if (!draft.first_name.trim()) { setError(t('errTeam', lang)); return; }
    if (!draft.last_name.trim()) { setError(t('errLastName', lang)); return; }
    if (!draft.representative.trim()) { setError(t('errRep', lang)); return; }
    // 연락처(WhatsApp) 필수 — 국가코드 외에 숫자 5자리 이상 입력해야 통과.
    const phoneDigits = (draft.meta['연락처'] ?? '').replace(/\D/g, '');
    if (phoneDigits.length < 5) { setError(t('errPhone', lang)); return; }
    const email = (draft.meta['이메일'] ?? '').trim();
    if (!email) { setError(t('errEmail', lang)); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(t('errEmailFormat', lang)); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/join/${encodeURIComponent(contestId)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: draft.first_name.trim(),
          last_name: draft.last_name.trim(),
          representative: draft.representative.trim(),
          role: draft.role,
          photo_url: draft.photo_url,
          meta: draft.meta,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.data) {
        // 중복 등록(409) — 저장하지 않고 기존 확인 메일을 안내한다.
        if (j.error === 'DUPLICATE') { setError(t('errDuplicate', lang)); return; }
        if (j.error === 'PHONE_REQUIRED') { setError(t('errPhone', lang)); return; }
        setError(j.error ?? `${t('errSubmit', lang)} (${res.status})`);
        return;
      }
      const assignedNum = (j.data.num as string) ?? suggestedNum;
      // 메일 결과를 query 로 전달 — done 페이지에서 발송 상태 표시.
      // sent=1 / sent=0&reason=... 형태.
      const params = new URLSearchParams({ num: assignedNum });
      const emailRes = j.email as { sent?: boolean; reason?: string } | undefined;
      if (emailRes) {
        if (emailRes.sent) {
          params.set('mail', '1');
          if (draft.meta['이메일']) params.set('to', draft.meta['이메일']);
        } else if (emailRes.reason) {
          params.set('mail', '0');
          params.set('reason', emailRes.reason);
        }
      }
      router.push(`/join/${encodeURIComponent(contestId)}/done?${params.toString()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errNet', lang));
    } finally {
      setBusy(false);
    }
  }

  const photoPreview = draft.photo_url ? normalizePhotoUrl(draft.photo_url) : '';

  return (
    <div className="jnj-stack-6">
      {/* Language toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <LangToggle lang={lang} onChange={setLang} />
      </div>

      {/* BASIC */}
      <section>
        <h2 className="jnj-section-title">{t('basic', lang)}</h2>
        <div className="jnj-card jnj-stack-4">
          {/* Photo */}
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

          <Field label={t('roleLabel', lang)}>
            <select
              className="jnj-input jnj-select"
              value={draft.role}
              onChange={(e) => setField('role', e.target.value as ParticipantRole)}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>

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

          <Field label={lang === 'ko' ? '연락처 (필수)' : 'WhatsApp Number (required)'}>
            <WhatsAppInput
              value={draft.meta['연락처'] ?? ''}
              onChange={(v) => setMeta('연락처', v)}
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

          {/* '이메일'은 PROFILE 에서 BASIC 으로 이동 — 확인 메일 수신 주소임을 안내. */}
          <Field label={lang === 'ko' ? '이메일 (필수)' : 'Email (required)'}>
            <input
              type="email"
              className="jnj-input"
              value={draft.meta['이메일'] ?? ''}
              onChange={(e) => setMeta('이메일', e.target.value)}
              placeholder="name@example.com"
              maxLength={2048}
            />
            <p className="jnj-small">
              {lang === 'ko'
                ? '확인 메일을 받으실 주소입니다.'
                : 'Where you will receive your confirmation mail'}
            </p>
          </Field>
        </div>
      </section>

      {/* PROFILE */}
      <section>
        <h2 className="jnj-section-title">{t('profile', lang)}</h2>
        <div className="jnj-card jnj-stack-4">
          {PROFILE_FIELDS.map((f) => (
            <Field key={f.key} label={f.label[lang]}>
              {f.type === 'whatsapp' ? (
                <WhatsAppInput
                  value={draft.meta[f.key] ?? ''}
                  onChange={(v) => setMeta(f.key, v)}
                  placeholder={f.placeholder ? f.placeholder[lang] : ''}
                  selectLabel={lang === 'ko' ? '국가 선택' : 'Select'}
                  defaultDial=""
                />
              ) : f.type === 'select' && f.options ? (
                <select
                  className="jnj-input jnj-select"
                  value={draft.meta[f.key] ?? ''}
                  onChange={(e) => setMeta(f.key, e.target.value)}
                >
                  <option value="">{f.placeholder ? f.placeholder[lang] : ''}</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label[lang]}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type ?? 'text'}
                  className="jnj-input"
                  value={draft.meta[f.key] ?? ''}
                  onChange={(e) => setMeta(f.key, e.target.value)}
                  placeholder={f.placeholder ? f.placeholder[lang] : ''}
                  maxLength={2048}
                />
              )}
            </Field>
          ))}
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

      {/* Submit (sticky bottom) */}
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
