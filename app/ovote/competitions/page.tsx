// /ovote/competitions — 관객 심사위원 사용이 켜진 대회 목록. 각 카드는 로그인 화면으로.
import Link from 'next/link';
import { headers } from 'next/headers';
import { listContests } from '@/lib/db/queries';
import { QRCodeImg } from '@/components/vote/QRCode';

export const dynamic = 'force-dynamic';

export default async function OVoteCompetitions() {
  const all = await listContests().catch(() => []);
  // audience_listed = 목록 노출 여부, online_judges_enabled = 관객 채점 기능 자체.
  // 기능이 꺼져 있으면 들어와도 투표가 막히므로 둘 다 만족할 때만 띄운다.
  const contests = all.filter(
    (c) => c.status !== 'archived' && c.audience_listed !== false && c.online_judges_enabled,
  );

  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const origin = `${proto}://${host}`;

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
          No competitions with audience judging enabled.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--jnj-space-3)' }}>
          {contests.map((c) => {
            const absUrl = `${origin}/ovote/${encodeURIComponent(c.id)}`;
            return (
              <li key={c.id}>
                <Link
                  href={`/ovote/${encodeURIComponent(c.id)}`}
                  className="jnj-btn jnj-btn-secondary"
                  style={{
                    width: '100%',
                    padding: 'var(--jnj-space-4) var(--jnj-space-5)',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--jnj-space-4)',
                    height: 'auto',
                  }}
                >
                  <span style={{ letterSpacing: '0.04em', textAlign: 'left', minWidth: 0 }}>{c.name}</span>
                  <span
                    title={absUrl}
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 'var(--jnj-space-2)',
                    }}
                  >
                    <QRCodeImg value={absUrl} size={72} margin={1} alt={`QR · ${c.id}`} style={{ padding: 4 }} />
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
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
