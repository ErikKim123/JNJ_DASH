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

// 카드 컨테이너 — isOpen=true 면 Link, false 면 시각적으로만 표시되는 비활성 카드.
function CardShell({
  isOpen,
  href,
  children,
}: {
  isOpen: boolean;
  href: string;
  children: React.ReactNode;
}) {
  const sharedStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'stretch',
    gap: 16,
    background: 'var(--jnj-grey-900)',
    borderColor: 'var(--jnj-grey-700)',
    color: 'var(--jnj-white)',
    padding: 20,
  };
  if (!isOpen) {
    return (
      <div
        className="jnj-card"
        aria-disabled="true"
        style={{
          ...sharedStyle,
          cursor: 'not-allowed',
          opacity: 0.55,
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="jnj-card jnj-card-clickable"
      style={{ ...sharedStyle, textDecoration: 'none' }}
    >
      {children}
    </Link>
  );
}

export default async function CompetitionsPage() {
  const all = await listContests().catch(() => []);
  // archived 만 숨김. ready 외 상태(live/done)도 카드는 표시하되 클릭 비활성화.
  const contests = all.filter((c) => c.status !== 'archived');

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
              const isOpen = c.status === 'ready';
              const absUrl = `${origin}/join/${encodeURIComponent(c.id)}`;
              // 상태별 짧은 영문 라벨
              const statusLabel =
                c.status === 'ready' ? 'OPEN'
                : c.status === 'live' ? 'IN PROGRESS'
                : c.status === 'done' ? 'CLOSED'
                : c.status.toUpperCase();
              return (
                <li key={c.id}>
                  <CardShell isOpen={isOpen} href={`/join/${encodeURIComponent(c.id)}`}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="jnj-mono"
                        style={{
                          fontSize: 12,
                          color: isOpen ? 'var(--jnj-grey-400)' : 'var(--jnj-grey-600)',
                          marginBottom: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>{c.id}</span>
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 8px',
                            borderRadius: 9999,
                            border: `1px solid ${isOpen ? 'var(--jnj-green)' : 'var(--jnj-grey-700)'}`,
                            color: isOpen ? 'var(--jnj-green)' : 'var(--jnj-grey-500)',
                            background: isOpen ? 'rgba(0, 125, 72, 0.12)' : 'transparent',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div
                        className="jnj-h2"
                        style={{
                          marginBottom: 10,
                          lineHeight: 1.2,
                          color: isOpen ? 'var(--jnj-white)' : 'var(--jnj-grey-500)',
                        }}
                      >
                        {c.name}
                      </div>
                      <div
                        className="jnj-caption"
                        style={{ color: isOpen ? 'var(--jnj-grey-400)' : 'var(--jnj-grey-600)' }}
                      >
                        {c.period_start ? `${c.period_start} ~ ${c.period_end ?? ''}` : 'Date TBD'}
                      </div>
                    </div>
                    <div
                      title={isOpen ? absUrl : `${statusLabel} — Registration unavailable`}
                      aria-disabled={!isOpen}
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
                        opacity: isOpen ? 1 : 0.25,
                        filter: isOpen ? 'none' : 'grayscale(1)',
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
                  </CardShell>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
