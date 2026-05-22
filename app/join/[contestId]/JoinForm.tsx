'use client';

// 참가자 신청 폼 — BASIC + PROFILE.
// 사진 업로드는 /api/join/[contestId]/photo, 제출은 /api/join/[contestId]/submit.
// 제출 성공 시 /join/[contestId]/done?num={번호} 로 이동.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ParticipantRole } from '@/lib/db/types';
import { normalizePhotoUrl } from '@/lib/photo';

type Lang = 'ko' | 'en';

const ROLE_OPTIONS: { value: ParticipantRole; label: string }[] = [
  { value: 'leader', label: 'Leader' },
  { value: 'follower', label: 'Follower' },
  { value: 'helper_leader', label: 'Helper (Leader)' },
  { value: 'helper_follower', label: 'Helper (Follower)' },
];

const PROFILE_FIELDS: {
  key: string;
  label: { ko: string; en: string };
  placeholder?: { ko: string; en: string };
  type?: 'text' | 'email' | 'date' | 'tel';
}[] = [
  { key: '부문', label: { ko: '부문', en: 'Category' }, placeholder: { ko: '예: 소셜댄스', en: 'e.g. Social Dance' } },
  { key: '장르', label: { ko: '장르', en: 'Genre' }, placeholder: { ko: '예: 바차타', en: 'e.g. Bachata' } },
  { key: '연락처', label: { ko: '연락처', en: 'Phone' }, placeholder: { ko: '010-0000-0000', en: '010-0000-0000' }, type: 'tel' },
  { key: '이메일', label: { ko: '이메일', en: 'Email' }, placeholder: { ko: 'name@example.com', en: 'name@example.com' }, type: 'email' },
  { key: 'Nationality', label: { ko: '국적', en: 'Nationality' }, placeholder: { ko: 'Korea', en: 'Korea' } },
  { key: '접수일', label: { ko: '접수일', en: 'Submitted Date' }, type: 'date' },
  { key: '사진원본', label: { ko: '사진원본 URL', en: 'Original Photo URL' }, placeholder: { ko: 'Google Drive 공유 링크 (선택)', en: 'Google Drive share link (optional)' } },
  { key: 'X', label: { ko: '인스타 (@)', en: 'Instagram (@)' }, placeholder: { ko: '@your_id', en: '@your_id' } },
];

const T = {
  basic: { ko: 'Basic', en: 'Basic' },
  profile: { ko: 'Profile', en: 'Profile' },
  uploadPhoto: { ko: '사진 업로드', en: 'Upload Photo' },
  uploading: { ko: '업로드 중…', en: 'Uploading…' },
  photoHint: { ko: 'JPEG / PNG / WebP · 최대 5MB', en: 'JPEG / PNG / WebP · max 5MB' },
  noPhoto: { ko: '사진 없음', en: 'No photo' },
  numLabel: { ko: '참가 번호 (자동 부여)', en: 'Entry Number (auto)' },
  roleLabel: { ko: '역할 (Role)', en: 'Role' },
  teamLabel: { ko: '팀명 (필수)', en: 'Team Name (required)' },
  teamPlaceholder: { ko: '팀명', en: 'Team name' },
  repLabel: { ko: '대표자 (필수)', en: 'Representative (required)' },
  repPlaceholder: { ko: '대표자 이름', en: 'Representative name' },
  submit: { ko: '신청하기', en: 'Submit Entry' },
  submitting: { ko: '제출 중…', en: 'Submitting…' },
  errTeam: { ko: '팀명을 입력해주세요.', en: 'Please enter a team name.' },
  errRep: { ko: '대표자를 입력해주세요.', en: 'Please enter a representative.' },
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
  team_name: string;
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
  const [lang, setLang] = useState<Lang>('ko');
  const [draft, setDraft] = useState<Draft>({
    team_name: '',
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
    if (file.size > 5 * 1024 * 1024) {
      setError(t('errFileSize', lang));
      return;
    }
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setError(t('errFileType', lang));
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    setPhotoBusy(true);
    try {
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
    if (!draft.team_name.trim()) { setError(t('errTeam', lang)); return; }
    if (!draft.representative.trim()) { setError(t('errRep', lang)); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/join/${encodeURIComponent(contestId)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_name: draft.team_name.trim(),
          representative: draft.representative.trim(),
          role: draft.role,
          photo_url: draft.photo_url,
          meta: draft.meta,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.data) {
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

          <Field label={t('numLabel', lang)}>
            <input
              type="text"
              className="jnj-input"
              value={suggestedNum}
              readOnly
            />
          </Field>

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

          <Field label={t('teamLabel', lang)}>
            <input
              type="text"
              className="jnj-input"
              value={draft.team_name}
              onChange={(e) => setField('team_name', e.target.value)}
              placeholder={t('teamPlaceholder', lang)}
              maxLength={200}
            />
          </Field>

          <Field label={t('repLabel', lang)}>
            <input
              type="text"
              className="jnj-input"
              value={draft.representative}
              onChange={(e) => setField('representative', e.target.value)}
              placeholder={t('repPlaceholder', lang)}
              maxLength={200}
            />
          </Field>
        </div>
      </section>

      {/* PROFILE */}
      <section>
        <h2 className="jnj-section-title">{t('profile', lang)}</h2>
        <div className="jnj-card jnj-stack-4">
          {PROFILE_FIELDS.map((f) => (
            <Field key={f.key} label={f.label[lang]}>
              <input
                type={f.type ?? 'text'}
                className="jnj-input"
                value={draft.meta[f.key] ?? ''}
                onChange={(e) => setMeta(f.key, e.target.value)}
                placeholder={f.placeholder ? f.placeholder[lang] : ''}
                maxLength={2048}
              />
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
            background: '#FFE5E5',
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
          background: 'linear-gradient(to top, var(--jnj-white) 70%, transparent)',
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="jnj-field">
      <span className="jnj-label">{label}</span>
      {children}
    </label>
  );
}

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const baseBtn: React.CSSProperties = {
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.08em',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--jnj-grey-500)',
    transition: 'all 200ms',
  };
  const activeBtn: React.CSSProperties = {
    ...baseBtn,
    color: 'var(--jnj-black)',
    background: 'var(--jnj-white)',
    borderRadius: 9999,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  };
  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: 4,
        background: 'var(--jnj-grey-100)',
        border: '1px solid var(--jnj-grey-200)',
        borderRadius: 9999,
        alignSelf: 'flex-end',
        marginLeft: 'auto',
      }}
    >
      <button
        type="button"
        onClick={() => onChange('ko')}
        aria-pressed={lang === 'ko'}
        style={lang === 'ko' ? activeBtn : baseBtn}
      >
        KO
      </button>
      <button
        type="button"
        onClick={() => onChange('en')}
        aria-pressed={lang === 'en'}
        style={lang === 'en' ? activeBtn : baseBtn}
      >
        EN
      </button>
    </div>
  );
}

function PhotoPreview({ url, emptyLabel = 'No photo' }: { url: string; emptyLabel?: string }) {
  if (!url) {
    return (
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 12,
          background: 'var(--jnj-grey-100)',
          border: '1px dashed var(--jnj-grey-300)',
          color: 'var(--jnj-grey-500)',
          fontSize: 12,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {emptyLabel}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      style={{
        width: 96,
        height: 96,
        borderRadius: 12,
        objectFit: 'cover',
        background: 'var(--jnj-grey-100)',
        flexShrink: 0,
      }}
    />
  );
}
