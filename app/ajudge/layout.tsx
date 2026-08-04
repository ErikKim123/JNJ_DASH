// AI Judge 셸 — 모바일 우선. 스펙 4장.
//
// JOIN 앱과 같은 디자인 시스템(JNJ Mobile Design System)을 쓴다.
// 색·타이포는 전부 join.css 의 토큰(var(--jnj-*))을 통해서만 지정한다.
// 셸에 .dark 를 고정하므로 하위 화면은 테마 분기 없이 토큰만 참조하면 된다.
//
// 로그인 화면은 없다 — 세션이 없으면 middleware 가 /ajudge/auth/enter 로 보내
// 기기 계정을 발급받고 곧바로 돌아온다.
import Link from 'next/link';
import type { ReactNode } from 'react';
import '../join/join.css';

export const metadata = {
  title: 'AI Judge — JNJ Dash',
  description: '잭앤질/소셜댄스 영상의 온비트 지표와 AI 코칭 리포트',
};

/** 하단 탭 높이 + 여유. 본문 하단 패딩과 한 쌍으로 유지한다. */
const BOTTOM_NAV_SPACE = 96;

export default function AJudgeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="jnj-shell dark">
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          padding: `0 20px ${BOTTOM_NAV_SPACE}px`,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            padding: '22px 0 14px',
          }}
        >
          <Link
            href="/ajudge"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              textDecoration: 'none',
            }}
          >
            <span
              className="jnj-display"
              style={{ fontSize: 24, color: 'var(--jnj-text)', lineHeight: 1 }}
            >
              AI JUDGE.
            </span>
            <span className="jnj-mono jnj-small" style={{ color: 'var(--jnj-text-muted)' }}>
              BETA
            </span>
          </Link>
          <Link
            href="/"
            className="jnj-mono jnj-small"
            style={{ color: 'var(--jnj-text-muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            JNJ DASH ↗
          </Link>
        </header>

        <main>{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const itemStyle: React.CSSProperties = {
    padding: '14px 0 18px',
    textAlign: 'center',
    color: 'var(--jnj-text-muted)',
    textDecoration: 'none',
  };

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: '1px solid var(--jnj-border)',
        background: 'var(--jnj-bg)',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
        }}
      >
        <Link href="/ajudge" className="jnj-mono jnj-small" style={itemStyle}>
          <span style={{ display: 'block', fontSize: 16, lineHeight: 1, marginBottom: 6 }}>＋</span>
          분석
        </Link>
        {/* 히스토리는 사이클 3(S7). 라우트가 없는 동안 죽은 링크를 두지 않는다. */}
        <span
          className="jnj-mono jnj-small"
          style={{ ...itemStyle, opacity: 0.45, cursor: 'default' }}
        >
          <span style={{ display: 'block', fontSize: 16, lineHeight: 1, marginBottom: 6 }}>≡</span>
          히스토리 <span style={{ fontSize: 10 }}>준비 중</span>
        </span>
      </div>
    </nav>
  );
}
