'use client';

// 온라인 심사위원 등록 완료 본문 — EN/KO 토글. 색상은 <main> 테마 토큰 상속.
import { useState } from 'react';
import Link from 'next/link';
import { LangToggle, type Lang } from '../../../join/_components/form-widgets';

export function OJudgeDonePanel({
  contestId,
  num,
  name,
  contestName,
}: {
  contestId: string;
  num: string;
  name: string;
  contestName: string;
}) {
  const [lang, setLang] = useState<Lang>('en');

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="jnj-mono jnj-small" style={{ color: 'var(--jnj-text-muted)' }}>
          JNJ / {contestId}
        </div>
        <LangToggle lang={lang} onChange={setLang} />
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          borderRadius: 9999,
          background: 'rgba(0, 125, 72, 0.10)',
          border: '1px solid rgba(0, 125, 72, 0.30)',
          color: 'var(--jnj-green)',
          fontSize: 13,
          fontWeight: 600,
          alignSelf: 'flex-start',
          marginBottom: 16,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span>{lang === 'en' ? 'Judge Registered' : '심사위원 등록 완료'}</span>
      </div>

      <div>
        <h1 className="jnj-display" style={{ fontSize: 'clamp(36px, 11vw, 56px)', marginTop: 4, marginBottom: 4, lineHeight: 1.0 }}>
          {lang === 'en' ? (
            <>You&apos;re<br />registered.</>
          ) : (
            <>심사위원 등록이<br />완료되었습니다.</>
          )}
        </h1>
        <p className="jnj-mono" style={{ marginTop: 12, fontSize: 13, color: 'var(--jnj-text-muted)', letterSpacing: '0.08em' }}>
          {lang === 'en' ? 'YOUR ONLINE JUDGE SIGN-UP HAS BEEN RECEIVED.' : '온라인 심사위원 등록이 접수되었습니다.'}
        </p>
      </div>

      {/* 심사위원 번호 카드 */}
      <div
        style={{
          marginTop: 28,
          padding: '20px 24px',
          border: '1px solid var(--jnj-border)',
          borderRadius: 16,
          background: 'var(--jnj-surface-2)',
        }}
      >
        <p className="jnj-mono" style={{ fontSize: 11, color: 'var(--jnj-text-muted)', letterSpacing: '0.1em', fontWeight: 600, margin: 0 }}>
          {lang === 'en' ? 'JUDGE NUMBER' : '심사위원 번호'}
        </p>
        <p className="jnj-display" style={{ fontSize: 'clamp(56px, 18vw, 88px)', lineHeight: 1.0, marginTop: 8, marginBottom: 0, color: 'var(--jnj-text)' }}>
          No. {num || '—'}
        </p>
        {name && (
          <p className="jnj-caption" style={{ marginTop: 12, color: 'var(--jnj-text-muted)' }}>
            {name}
            {contestName ? ` · ${contestName}` : ''}
          </p>
        )}
      </div>

      {/* PIN 안내 */}
      <div style={{ marginTop: 20 }}>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--jnj-text)', margin: 0 }}>
          {lang === 'en' ? (
            <>
              Please <strong>remember your 4-digit password</strong>.
              <br />
              You&apos;ll use it to sign in and score online.
            </>
          ) : (
            <>
              등록하신 <strong>4자리 비밀번호</strong>를 꼭 기억해 주세요.
              <br />
              온라인 채점 접속 시 사용됩니다.
            </>
          )}
        </p>
      </div>

      <div style={{ flex: 1, minHeight: 24 }} />

      <Link href="/ojudge/competitions" className="jnj-btn jnj-btn-secondary jnj-btn-full jnj-btn-lg">
        {lang === 'en' ? 'Back to Competitions' : '대회 목록으로'}
      </Link>
    </div>
  );
}
