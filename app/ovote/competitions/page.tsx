// /ovote/competitions — 온라인 심사위원 사용이 켜진 대회 목록. 각 카드는 로그인 화면으로.
import Link from 'next/link';
import { listContests } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export default async function OVoteCompetitions() {
  const all = await listContests().catch(() => []);
  const contests = all.filter((c) => c.status !== 'archived' && c.online_judges_enabled);

  return (
    <main
      style={{
        minHeight: '100dvh',
        padding: 'var(--jnj-space-7) var(--jnj-space-5) var(--jnj-space-10)',
        maxWidth: 720,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--jnj-space-6)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--jnj-space-2)' }}>
        <Link
          href="/ovote"
          className="jnj-small"
          style={{ color: 'var(--jnj-text-secondary)', textDecoration: 'none', letterSpacing: '0.06em' }}
        >
          ← Home
        </Link>
        <h1 className="jnj-display" style={{ fontSize: 'clamp(40px, 10vw, 72px)', margin: 0 }}>
          COMPETITIONS
        </h1>
        <p className="jnj-body" style={{ color: 'var(--jnj-text-secondary)', margin: 0 }}>
          Select your competition to log in.
        </p>
      </header>

      {contests.length === 0 ? (
        <p className="jnj-body" style={{ color: 'var(--jnj-text-secondary)' }}>
          No competitions with online judging enabled.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--jnj-space-3)' }}>
          {contests.map((c) => (
            <li key={c.id}>
              <Link
                href={`/ovote/${encodeURIComponent(c.id)}`}
                className="jnj-btn jnj-btn-secondary"
                style={{
                  width: '100%',
                  padding: 'var(--jnj-space-4) var(--jnj-space-6)',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ letterSpacing: '0.04em' }}>{c.name}</span>
                <span
                  style={{
                    fontFamily: 'var(--jnj-font-text)',
                    fontWeight: 400,
                    fontSize: 'var(--jnj-size-small)',
                    opacity: 0.7,
                  }}
                >
                  {c.id}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
