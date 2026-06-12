'use client';

// 신청 완료 확인 화면 본문 — EN/KO 토글(기본 EN).
// 색상은 페이지 <main> 의 테마 토큰(var(--jnj-*))을 상속한다.
import { useState } from 'react';
import Link from 'next/link';

type Lang = 'en' | 'ko';

// 참가비 결제 페이지 링크.
const PAYMENT_URL = 'https://phuquocsummerlatinfest.com/jj-competition-battle-2026';

export function DonePanel({
  contestId,
  num,
  contestName,
  period,
  backHref,
  snsUrl,
  snsEnabled,
}: {
  contestId: string;
  num: string;
  contestName: string;
  period: string;
  backHref: string;
  snsUrl: string;
  snsEnabled: boolean;
}) {
  const [lang, setLang] = useState<Lang>('en');
  // 활성(토글 ON) + 유효 URL 일 때만 버튼 노출. 비활성이면 섹션 자체를 숨김.
  const showSns = snsEnabled && /^https?:\/\//i.test(snsUrl);

  return (
    <div
      style={{
        maxWidth: 480,
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
      }}
    >
      {/* 헤더: 코드 + 언어 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="jnj-mono jnj-small" style={{ color: 'var(--jnj-text-muted)' }}>
          JNJ / {contestId}
        </div>
        <LangToggle lang={lang} onChange={setLang} />
      </div>

      <div style={{ flex: 1 }} />

      {/* 성공 배지 */}
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
        <span>{lang === 'en' ? 'Entry Confirmed' : '등록 완료'}</span>
      </div>

      <div>
        <h1
          className="jnj-display"
          style={{ fontSize: 'clamp(36px, 11vw, 56px)', marginTop: 4, marginBottom: 4, lineHeight: 1.0 }}
        >
          {lang === 'en' ? (
            <>Your entry is<br />confirmed.</>
          ) : (
            <>참가 신청이<br />완료되었습니다.</>
          )}
        </h1>
        <p
          className="jnj-mono"
          style={{ marginTop: 12, fontSize: 13, color: 'var(--jnj-text-muted)', letterSpacing: '0.08em' }}
        >
          {lang === 'en' ? 'YOUR REGISTRATION HAS BEEN RECEIVED.' : '신청이 정상 접수되었습니다.'}
        </p>
        {/* 결제/그룹채팅 안내 — EN/KO 토글과 무관하게 영어로만 표시. */}
        <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: 'var(--jnj-text-muted)' }}>
          Your confirmation e-mail has been sent by <strong>bandnara123@gmail.com</strong>.
          Please join the Whatsapp group chat and make your payments
          <br />
          for J&amp;J (if you haven&apos;t already) through the links in the e-mail.
        </p>
      </div>

      {/* 참가 번호 카드 */}
      <div
        style={{
          marginTop: 28,
          padding: '20px 24px',
          border: '1px solid var(--jnj-border)',
          borderRadius: 16,
          background: 'var(--jnj-surface-2)',
        }}
      >
        <p
          className="jnj-mono"
          style={{ fontSize: 11, color: 'var(--jnj-text-muted)', letterSpacing: '0.1em', fontWeight: 600, margin: 0 }}
        >
          {lang === 'en' ? 'PARTICIPANT NUMBER' : '참가 번호'}
        </p>
        <p
          className="jnj-display"
          style={{ fontSize: 'clamp(56px, 18vw, 88px)', lineHeight: 1.0, marginTop: 8, marginBottom: 0, color: 'var(--jnj-text)' }}
        >
          No. {num || '—'}
        </p>
        {contestName && (
          <p className="jnj-caption" style={{ marginTop: 12, color: 'var(--jnj-text-muted)' }}>
            {contestName}
            {period ? ` · ${period}` : ''}
          </p>
        )}
      </div>

      {/* 안내 메시지 */}
      <div style={{ marginTop: 20 }}>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--jnj-text)', margin: 0 }}>
          {lang === 'en' ? (
            <>
              Please arrive <strong>30 minutes before</strong> the contest starts.
              <br />
              Tell the staff your <strong>participant number</strong> at check-in.
            </>
          ) : (
            <>
              <strong>대회 시작 30분 전</strong>에 도착해 주세요.
              <br />
              체크인 시 위 <strong>참가 번호</strong>를 알려주시면 됩니다.
            </>
          )}
        </p>
      </div>

      {/* 참가비 결제 버튼 */}
      <div style={{ marginTop: 24 }}>
        <a
          href={PAYMENT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="jnj-btn jnj-btn-primary jnj-btn-full jnj-btn-lg"
        >
          <PaymentIcon />
          {lang === 'en' ? 'Make Your Payment' : '참가비 결제하기'}
        </a>
      </div>

      {/* SNS 방 참여 — 활성(토글 ON + URL) 일 때만 노출, 비활성이면 완전 숨김 */}
      {showSns && (
        <div style={{ marginTop: 24 }}>
          <p
            className="jnj-mono"
            style={{ fontSize: 11, color: 'var(--jnj-text-muted)', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8 }}
          >
            {lang === 'en' ? 'COMMUNITY' : 'SNS 방'}
          </p>
          <a
            href={snsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="jnj-btn jnj-btn-primary jnj-btn-full jnj-btn-lg"
          >
            <SnsIcon />
            {lang === 'en' ? 'Join the Group Chat for more info' : '자세한 안내는 그룹 채팅 참여'}
          </a>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 24 }} />

      <Link href={backHref} className="jnj-btn jnj-btn-secondary jnj-btn-full jnj-btn-lg">
        {lang === 'en' ? 'Back to Competitions' : '대회 목록으로'}
      </Link>
    </div>
  );
}

function PaymentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function SnsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
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
    color: 'var(--jnj-text-muted)',
    transition: 'all 200ms',
  };
  const activeBtn: React.CSSProperties = {
    ...baseBtn,
    color: 'var(--jnj-text)',
    background: 'var(--jnj-surface)',
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
        background: 'var(--jnj-track)',
        border: '1px solid var(--jnj-border)',
        borderRadius: 9999,
      }}
    >
      <button type="button" onClick={() => onChange('en')} aria-pressed={lang === 'en'} style={lang === 'en' ? activeBtn : baseBtn}>
        EN
      </button>
      <button type="button" onClick={() => onChange('ko')} aria-pressed={lang === 'ko'} style={lang === 'ko' ? activeBtn : baseBtn}>
        KO
      </button>
    </div>
  );
}
