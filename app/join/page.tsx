// /join — JNJ JOIN. 참가자 등록 모바일 앱 진입점.
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function JoinLandingPage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 20px 32px',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div className="jnj-mono jnj-small" style={{ color: 'var(--jnj-grey-500)' }}>
        JNJ / 2026
      </div>

      <div style={{ flex: 1 }} />

      <div>
        <h1
          className="jnj-display"
          style={{
            fontSize: 'clamp(64px, 22vw, 96px)',
            color: 'var(--jnj-black)',
            margin: 0,
          }}
        >
          JNJ
          <br />
          JOIN.
        </h1>
        <p
          className="jnj-mono"
          style={{
            fontSize: 'clamp(15px, 4.2vw, 18px)',
            fontWeight: 700,
            marginTop: 20,
            color: 'var(--jnj-black)',
            letterSpacing: '0.04em',
            lineHeight: 1.3,
          }}
        >
          REGISTER FOR YOUR COMPETITION.
        </p>
      </div>

      <div style={{ flex: 1 }} />

      <Link
        href="/join/competitions"
        className="jnj-btn jnj-btn-primary jnj-btn-full jnj-btn-lg"
      >
        View Competitions
      </Link>
      <p
        className="jnj-caption jnj-text-center"
        style={{ marginTop: 12, color: 'var(--jnj-grey-500)' }}
      >
        Select an active competition
      </p>
    </main>
  );
}
