// /ojudge/[contestId] — 온라인 심사위원 등록 폼 (JOIN 앱과 동일 디자인).
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getContest } from '@/lib/db/queries';
import { contestTheme, joinRootProps } from '@/lib/join/theme';
import { OnlineJudgeForm } from './OnlineJudgeForm';
import { TopNav } from '../../join/_components/TopNav';

export const dynamic = 'force-dynamic';

function buildQrSrc(url: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${encodeURIComponent(url)}`;
}

export default async function OJudgeFormPage({
  params,
}: {
  params: Promise<{ contestId: string }>;
}) {
  const { contestId } = await params;
  const contest = await getContest(contestId);
  if (!contest) notFound();
  const theme = contestTheme(contest);
  const root = joinRootProps(theme);

  // archived/done 대회는 등록 마감.
  if (contest.status === 'archived' || contest.status === 'done') {
    return (
      <main
        className={root.className}
        style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto', minHeight: '100dvh', ...root.style }}
      >
        <TopNav variant={root.mode === 'dark' ? 'dark' : 'light'} trophyHref="/ojudge/competitions" />
        <div
          className="jnj-card"
          style={{ marginTop: 24, textAlign: 'center', padding: 32, background: 'var(--jnj-surface-2)', border: '1px solid var(--jnj-border)' }}
        >
          <p className="jnj-mono" style={{ fontSize: 12, color: 'var(--jnj-text-muted)', marginBottom: 8, letterSpacing: '0.08em' }}>
            REGISTRATION CLOSED
          </p>
          <p className="jnj-h2" style={{ marginBottom: 8 }}>{contest.name}</p>
          <p className="jnj-caption" style={{ color: 'var(--jnj-text-muted)' }}>대회가 종료되어 등록을 받지 않습니다.</p>
        </div>
      </main>
    );
  }

  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const absUrl = `${proto}://${host}/ojudge/${encodeURIComponent(contestId)}`;

  return (
    <main className={root.className} style={{ minHeight: '100dvh', padding: '20px 20px 96px', ...root.style }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <TopNav variant={root.mode === 'dark' ? 'dark' : 'light'} trophyHref="/ojudge/competitions" />

        <div style={{ marginTop: 8, marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="jnj-mono jnj-small" style={{ color: 'var(--jnj-text-muted)', letterSpacing: '0.08em', marginBottom: 6 }}>
              ONLINE JUDGE
            </p>
            <h1 className="jnj-display" style={{ fontSize: 'clamp(28px, 9vw, 44px)', lineHeight: 1.0 }}>
              {contest.name}
            </h1>
          </div>
          <a
            href={absUrl}
            title={absUrl}
            aria-label="이 페이지의 QR 코드"
            style={{
              flexShrink: 0,
              width: 112,
              height: 112,
              background: 'var(--jnj-white)',
              border: '1px solid var(--jnj-border)',
              borderRadius: 12,
              padding: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={buildQrSrc(absUrl, 200)}
              alt={`QR for ${contest.id}`}
              width={96}
              height={96}
              loading="eager"
              referrerPolicy="no-referrer"
              style={{ display: 'block', width: '100%', height: '100%' }}
            />
          </a>
        </div>

        <OnlineJudgeForm contestId={contestId} />
      </div>
    </main>
  );
}
