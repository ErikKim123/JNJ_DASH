// /join/competitions — 진행 중인 대회 목록. archived/done 은 자동 제외.
import Link from 'next/link';
import { headers } from 'next/headers';
import { listContests } from '@/lib/db/queries';
import { TopNav } from '../_components/TopNav';

export const dynamic = 'force-dynamic';

// 카드 우측 QR 이미지 URL — api.qrserver.com 무료 엔드포인트.
// data 는 폼 페이지 절대 URL. 모바일 카메라가 스캔하면 바로 폼으로 이동.
function buildQrSrc(url: string, size = 120): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${encodeURIComponent(url)}`;
}

export default async function CompetitionsPage() {
  const all = await listContests().catch(() => []);
  // 종료된 대회는 참가 신청 불가 — 목록에서 제외.
  const contests = all.filter((c) => c.status !== 'archived' && c.status !== 'done');

  // 절대 URL 계산: x-forwarded-* 가 우선 (프록시/Vercel 환경), 없으면 host 헤더.
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const origin = `${proto}://${host}`;

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--jnj-black)',
        color: 'var(--jnj-white)',
        padding: '20px 20px 48px',
      }}
      className="dark"
    >
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <TopNav variant="dark" homeHref="/join" />

        <h1
          className="jnj-display"
          style={{ fontSize: 'clamp(40px, 12vw, 56px)', marginTop: 12, marginBottom: 8 }}
        >
          Competitions
        </h1>
        <p className="jnj-caption" style={{ color: 'var(--jnj-grey-300)', marginBottom: 24 }}>
          Select a competition to join.
        </p>

        {contests.length === 0 ? (
          <div
            className="jnj-card"
            style={{
              background: 'var(--jnj-grey-900)',
              borderColor: 'var(--jnj-grey-700)',
              padding: 28,
              textAlign: 'center',
            }}
          >
            <p className="jnj-h3" style={{ marginBottom: 8 }}>No competitions open.</p>
            <p className="jnj-caption" style={{ color: 'var(--jnj-grey-400)' }}>
              Check back soon.
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
            {contests.map((c) => {
              const absUrl = `${origin}/join/${encodeURIComponent(c.id)}`;
              return (
                <li key={c.id}>
                  <Link
                    href={`/join/${encodeURIComponent(c.id)}`}
                    className="jnj-card jnj-card-clickable"
                    style={{
                      display: 'flex',
                      alignItems: 'stretch',
                      gap: 16,
                      background: 'var(--jnj-grey-900)',
                      borderColor: 'var(--jnj-grey-700)',
                      color: 'var(--jnj-white)',
                      textDecoration: 'none',
                      padding: 20,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="jnj-mono"
                        style={{ fontSize: 12, color: 'var(--jnj-grey-400)', marginBottom: 8 }}
                      >
                        {c.id}
                      </div>
                      <div className="jnj-h2" style={{ marginBottom: 10, lineHeight: 1.2 }}>
                        {c.name}
                      </div>
                      <div className="jnj-caption" style={{ color: 'var(--jnj-grey-400)' }}>
                        {c.period_start ? `${c.period_start} ~ ${c.period_end ?? ''}` : 'Date TBD'}
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
