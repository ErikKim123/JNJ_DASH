// /join/[contestId]/done?num=XXX — 신청 완료 확인 화면.
import Link from 'next/link';
import { getContest } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export default async function DonePage({
  params,
  searchParams,
}: {
  params: Promise<{ contestId: string }>;
  searchParams: Promise<{ num?: string }>;
}) {
  const { contestId } = await params;
  const { num } = await searchParams;
  const contest = await getContest(contestId);

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--jnj-white)',
        color: 'var(--jnj-black)',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 20px 32px',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        <div className="jnj-mono jnj-small" style={{ color: 'var(--jnj-grey-500)' }}>
          JNJ / {contest?.id ?? contestId}
        </div>

        <div style={{ flex: 1 }} />

        <div>
          <p
            className="jnj-mono"
            style={{ fontSize: 13, color: 'var(--jnj-grey-500)', letterSpacing: '0.08em' }}
          >
            ENTRY CONFIRMED.
          </p>
          <h1
            className="jnj-display"
            style={{
              fontSize: 'clamp(48px, 16vw, 88px)',
              marginTop: 8,
              marginBottom: 16,
              lineHeight: 0.9,
            }}
          >
            No. {num ?? '—'}
          </h1>
          {contest && (
            <p className="jnj-body" style={{ color: 'var(--jnj-grey-500)' }}>
              {contest.name}
            </p>
          )}
          <p className="jnj-caption" style={{ marginTop: 24, color: 'var(--jnj-grey-500)' }}>
            We&apos;ve received your entry. Keep your number for check-in.
          </p>
        </div>

        <div style={{ flex: 1 }} />

        <div className="jnj-stack-3">
          <Link
            href="/join/competitions"
            className="jnj-btn jnj-btn-primary jnj-btn-full jnj-btn-lg"
          >
            Back to Competitions
          </Link>
          <Link
            href="/join"
            className="jnj-btn jnj-btn-secondary jnj-btn-full"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
