'use client';

// 등록 마감 안내 — EN/KO 토글. 색상은 <main> 테마 토큰 상속.
// 이 화면만 서버 컴포넌트에 한국어가 박혀 있어 해외 관객에게 한국어만 보였다.
// 등록 폼(OnlineJudgeForm) · 완료 화면(OJudgeDonePanel) 과 같은 방식으로 맞춘다(기본 EN).
import { useState } from 'react';
import { LangToggle, type Lang } from '../../join/_components/form-widgets';

const T = {
  closed: { ko: '등록 마감', en: 'REGISTRATION CLOSED' },
  body: {
    ko: '대회가 종료되어 등록을 받지 않습니다.',
    en: 'This competition has ended and registration is closed.',
  },
} as const;

export function RegistrationClosedPanel({ contestName }: { contestName: string }) {
  const [lang, setLang] = useState<Lang>('en');

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <LangToggle lang={lang} onChange={setLang} />
      </div>

      <div
        className="jnj-card"
        style={{
          marginTop: 12,
          textAlign: 'center',
          padding: 32,
          background: 'var(--jnj-surface-2)',
          border: '1px solid var(--jnj-border)',
        }}
      >
        <p
          className="jnj-mono"
          style={{ fontSize: 12, color: 'var(--jnj-text-muted)', marginBottom: 8, letterSpacing: '0.08em' }}
        >
          {T.closed[lang]}
        </p>
        <p className="jnj-h2" style={{ marginBottom: 8 }}>{contestName}</p>
        <p className="jnj-caption" style={{ color: 'var(--jnj-text-muted)' }}>{T.body[lang]}</p>
      </div>
    </>
  );
}
