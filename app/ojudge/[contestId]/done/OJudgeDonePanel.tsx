'use client';

// 관객 심사위원 등록 완료 본문 — EN/KO 토글. 색상은 <main> 테마 토큰 상속.
import { useState } from 'react';
import Link from 'next/link';
import { LangToggle, type Lang } from '../../../join/_components/form-widgets';

export function OJudgeDonePanel({
  contestId,
  num,
  judgeNo,
  name,
  contestName,
  alsoEnrolled,
}: {
  contestId: string;
  /** 이 대회 안의 등록 순번. 관리자 명단 정렬용이라 화면에선 보조 표기. */
  num: string;
  /** 전역 심사위원 번호 — 어느 대회에서든 이 번호로 로그인한다. */
  judgeNo: string;
  name: string;
  contestName: string;
  /** 이번 등록으로 함께 참여가 잡힌 같은 페스티벌의 다른 대회들. */
  alsoEnrolled: { id: string; name: string }[];
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
          {lang === 'en' ? 'YOUR AUDIENCE JUDGE SIGN-UP HAS BEEN RECEIVED.' : '관객 심사위원 등록이 접수되었습니다.'}
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
        <p className="jnj-display" style={{ fontSize: 'clamp(48px, 15vw, 76px)', lineHeight: 1.0, marginTop: 8, marginBottom: 0, color: 'var(--jnj-text)' }}>
          No. {judgeNo || num || '—'}
        </p>
        <p className="jnj-small" style={{ marginTop: 8, marginBottom: 0, color: 'var(--jnj-text-muted)' }}>
          {lang === 'en'
            ? 'One number for every competition. Use it to sign in anywhere.'
            : '모든 대회에서 쓰는 번호입니다. 어느 대회든 이 번호로 로그인하세요.'}
        </p>
        {name && (
          <p className="jnj-caption" style={{ marginTop: 12, color: 'var(--jnj-text-muted)' }}>
            {name}
            {contestName ? ` · ${contestName}` : ''}
          </p>
        )}
      </div>

      {/* 함께 등록된 대회 — 한 번 등록하면 같은 페스티벌 대회 전체에 심사위원으로 잡힌다.
          이걸 안 보여주면 다른 대회에 가서 또 등록하려는 문제가 그대로 남는다. */}
      {alsoEnrolled.length > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: '16px 20px',
            border: '1px solid var(--jnj-border)',
            borderRadius: 16,
            background: 'var(--jnj-surface-2)',
          }}
        >
          <p className="jnj-mono" style={{ fontSize: 11, color: 'var(--jnj-text-muted)', letterSpacing: '0.1em', fontWeight: 600, margin: 0 }}>
            {lang === 'en' ? 'ALSO REGISTERED FOR' : '함께 등록된 대회'}
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 6 }}>
            {alsoEnrolled.map((c) => (
              <li key={c.id} style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--jnj-text)' }}>
                {c.name}
              </li>
            ))}
          </ul>
          <p className="jnj-small" style={{ marginTop: 10, marginBottom: 0, color: 'var(--jnj-text-muted)' }}>
            {lang === 'en'
              ? 'No need to register again — just sign in.'
              : '다시 등록하실 필요 없습니다 — 바로 로그인하시면 됩니다.'}
          </p>
        </div>
      )}

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
              관객 채점 접속 시 사용됩니다.
            </>
          )}
        </p>
      </div>

      <div style={{ flex: 1, minHeight: 24 }} />

      {/* 등록 다음 걸음은 '채점하러 가기' 다 — 바로 위에서 안내한 4자리 비밀번호를 쓰는 곳으로 보낸다.
          대회 목록은 되돌아가는 길이라 아래에 보조로 남긴다. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link href="/ovote/competitions" className="jnj-btn jnj-btn-primary jnj-btn-full jnj-btn-lg">
          {lang === 'en' ? 'Go to Audience Vote' : '관객 채점 하러 가기'}
        </Link>
        <Link href="/ojudge/competitions" className="jnj-btn jnj-btn-secondary jnj-btn-full jnj-btn-lg">
          {lang === 'en' ? 'Back to Competitions' : '대회 목록으로'}
        </Link>
      </div>
    </div>
  );
}
