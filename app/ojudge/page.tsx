// /ojudge — JNJ JUDGE. 관객 심사위원 셀프 등록 앱 진입점 (JOIN 앱과 동일 디자인).
import Link from 'next/link';
import { joinRootProps, DEFAULT_JOIN_THEME } from '@/lib/join/theme';

export const dynamic = 'force-dynamic';

export default function OJudgeLandingPage() {
  const root = joinRootProps(DEFAULT_JOIN_THEME);

  return (
    <main
      className={root.className}
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 20px 32px',
        maxWidth: 480,
        margin: '0 auto',
        ...root.style,
      }}
    >
      <div className="jnj-mono jnj-small" style={{ color: 'var(--jnj-text-muted)' }}>
        JNJ / 2026
      </div>

      <div style={{ flex: 1 }} />

      <div>
        <h1
          className="jnj-display"
          style={{ fontSize: 'clamp(56px, 20vw, 92px)', color: 'var(--jnj-text)', margin: 0 }}
        >
          JNJ
          <br />
          AUDIENCE
          <br />
          JUDGE
        </h1>
        <p
          className="jnj-mono"
          style={{
            fontSize: 'clamp(15px, 4.2vw, 18px)',
            fontWeight: 700,
            marginTop: 20,
            color: 'var(--jnj-text)',
            letterSpacing: '0.04em',
            lineHeight: 1.3,
          }}
        >
          REGISTER AS AN AUDIENCE JUDGE.
        </p>
      </div>

      <div style={{ flex: 1 }} />

      <Link href="/ojudge/competitions" className="jnj-btn jnj-btn-primary jnj-btn-full jnj-btn-lg">
        View Competitions
      </Link>
      <p className="jnj-caption jnj-text-center" style={{ marginTop: 12, color: 'var(--jnj-text-muted)' }}>
        Select an active competition
      </p>

      {/* 이미 등록을 마친 관객은 여기가 아니라 채점 앱으로 가야 한다.
          두 앱이 서로를 모르면 현장에서 QR/주소를 따로 안내해야 하므로 서로 오갈 길을 열어둔다. */}
      <Link
        href="/ovote"
        className="jnj-small jnj-text-center"
        style={{ display: 'block', marginTop: 20, textDecoration: 'none' }}
      >
        <span style={{ color: 'var(--jnj-text-muted)' }}>Already registered? </span>
        <span style={{ color: 'var(--jnj-text)', textDecoration: 'underline' }}>Go to Audience Vote →</span>
      </Link>
    </main>
  );
}
