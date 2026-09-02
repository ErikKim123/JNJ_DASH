// /ovote — 관객 심사위원 VOTE 앱 진입점 (VOTE 앱과 동일 디자인).
import Link from 'next/link';

export default function OVoteHome() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: 'var(--jnj-black)',
        color: 'var(--jnj-white)',
        padding: 'var(--jnj-space-8) var(--jnj-space-6)',
      }}
    >
      <header
        style={{
          fontFamily: 'var(--jnj-font-text-medium)',
          fontSize: 'var(--jnj-size-small)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--jnj-grey-400)',
        }}
      >
        JNJ / 2026
      </header>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--jnj-space-6)' }}>
        <h1
          style={{
            fontFamily: 'var(--jnj-font-display)',
            fontSize: 'clamp(56px, 16vw, 140px)',
            fontWeight: 500,
            lineHeight: 0.9,
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            margin: 0,
            color: 'var(--jnj-white)',
          }}
        >
          AUDIENCE
          <br />
          VOTE.
        </h1>
        <p
          style={{
            fontFamily: 'var(--jnj-font-text-medium)',
            fontSize: 'var(--jnj-size-h3)',
            lineHeight: 1.5,
            color: 'var(--jnj-grey-300)',
            margin: 0,
            maxWidth: 480,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}
        >
          Audience judges — log in and score the final.
        </p>
      </section>

      <footer style={{ display: 'flex', flexDirection: 'column', gap: 'var(--jnj-space-3)' }}>
        <Link
          href="/ovote/competitions"
          className="jnj-btn jnj-btn-inverse"
          style={{ width: '100%', padding: 'var(--jnj-space-4) var(--jnj-space-6)' }}
        >
          View Competitions
        </Link>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--jnj-font-text)',
            fontSize: 'var(--jnj-size-small)',
            color: 'var(--jnj-grey-500)',
            textAlign: 'center',
          }}
        >
          Select your competition
        </p>

        {/* 아직 심사위원 등록을 안 한 관객은 채점에 들어올 수 없다 — 등록 앱으로 보낸다.
            색은 이 페이지가 쓰는 토큰 그대로라 라이트/다크 어느 쪽이든 따라온다. */}
        <Link
          href="/ojudge"
          style={{
            marginTop: 'var(--jnj-space-2)',
            fontFamily: 'var(--jnj-font-text)',
            fontSize: 'var(--jnj-size-small)',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          <span style={{ color: 'var(--jnj-grey-500)' }}>Not registered yet? </span>
          <span style={{ color: 'var(--jnj-white)', textDecoration: 'underline' }}>
            Register as an Audience Judge →
          </span>
        </Link>
      </footer>
    </main>
  );
}
