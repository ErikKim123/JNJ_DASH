// /ojudge/competitions — 온라인 심사위원 등록 가능한 대회 목록.
// JOIN 앱과 동일 디자인. archived 는 숨김. 각 카드는 /ojudge/[id] 등록 폼으로 이동.
import Link from 'next/link';
import { headers } from 'next/headers';
import { listContests } from '@/lib/db/queries';
import { pickJoinTheme, joinRootProps } from '@/lib/join/theme';
import { TopNav } from '../../join/_components/TopNav';

export const dynamic = 'force-dynamic';

function buildQrSrc(url: string, size = 120): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${encodeURIComponent(url)}`;
}

export default async function OJudgeCompetitionsPage() {
  const all = await listContests().catch(() => []);
  const contests = all.filter((c) => c.status !== 'archived');

  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const origin = `${proto}://${host}`;

  const theme = pickJoinTheme(contests);
  const root = joinRootProps(theme);

  return (
    <main className={root.className} style={{ minHeight: '100dvh', padding: '20px 20px 48px', ...root.style }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <TopNav variant={root.mode === 'dark' ? 'dark' : 'light'} trophyHref="/ojudge/competitions" />

        <h1 className="jnj-display" style={{ fontSize: 'clamp(40px, 12vw, 56px)', marginTop: 12, marginBottom: 8 }}>
          Judge Sign-up
        </h1>
        <p className="jnj-caption" style={{ color: 'var(--jnj-text-muted)', marginBottom: 24 }}>
          Select a competition to register as an online judge.
        </p>

        {contests.length === 0 ? (
          <div
            className="jnj-card"
            style={{ background: 'var(--jnj-surface)', borderColor: 'var(--jnj-border)', padding: 28, textAlign: 'center' }}
          >
            <p className="jnj-h3" style={{ marginBottom: 8 }}>No competitions open.</p>
            <p className="jnj-caption" style={{ color: 'var(--jnj-text-muted)' }}>Check back soon.</p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
            {contests.map((c) => {
              const absUrl = `${origin}/ojudge/${encodeURIComponent(c.id)}`;
              return (
                <li key={c.id}>
                  <Link
                    href={`/ojudge/${encodeURIComponent(c.id)}`}
                    className="jnj-card jnj-card-clickable"
                    style={{
                      display: 'flex',
                      alignItems: 'stretch',
                      gap: 16,
                      background: 'var(--jnj-surface)',
                      borderColor: 'var(--jnj-border)',
                      color: 'var(--jnj-text)',
                      padding: 20,
                      textDecoration: 'none',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="jnj-mono"
                        style={{ fontSize: 12, color: 'var(--jnj-text-muted)', marginBottom: 8 }}
                      >
                        {c.id}
                      </div>
                      <div className="jnj-h2" style={{ marginBottom: 0, lineHeight: 1.2 }}>
                        {c.name}
                      </div>
                    </div>
                    <div
                      title={absUrl}
                      style={{
                        flexShrink: 0,
                        alignSelf: 'center',
                        width: 96,
                        height: 96,
                        background: 'var(--jnj-white)',
                        borderRadius: 8,
                        padding: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={buildQrSrc(absUrl, 120)}
                        alt={`QR for ${c.id}`}
                        width={84}
                        height={84}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        style={{ display: 'block', width: '100%', height: '100%' }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
