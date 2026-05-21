// /join/[contestId] — 참가 신청 폼 (BASIC + PROFILE).
// 서버 컴포넌트에서 대회 정보 + 다음 번호를 미리 계산한 뒤 클라이언트 폼에 전달.
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getContest, listParticipants } from '@/lib/db/queries';
import { nextParticipantNum } from '@/lib/participants/next-num';
import { JoinForm } from './JoinForm';
import { TopNav } from '../_components/TopNav';

export const dynamic = 'force-dynamic';

// 헤더 상단 우측 QR — 같은 페이지(/join/[contestId]) 절대 URL 을 인코딩.
// 운영자가 화면을 띄워두면 참가자가 자기 폰으로 스캔해 셀프 등록.
function buildQrSrc(url: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${encodeURIComponent(url)}`;
}

export default async function JoinFormPage({
  params,
}: {
  params: Promise<{ contestId: string }>;
}) {
  const { contestId } = await params;
  const contest = await getContest(contestId);
  if (!contest) notFound();
  if (contest.status === 'archived' || contest.status === 'done') {
    return (
      <main style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>
        <TopNav />
        <div className="jnj-card" style={{ marginTop: 16, textAlign: 'center', padding: 28 }}>
          <p className="jnj-h2" style={{ marginBottom: 8 }}>Registration closed.</p>
          <p className="jnj-caption">This competition is no longer accepting entries.</p>
        </div>
      </main>
    );
  }

  const existing = await listParticipants(contestId);
  const suggestedNum = nextParticipantNum(existing);

  // 같은 페이지 절대 URL (스캔 시 동일 폼 오픈)
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const absUrl = `${proto}://${host}/join/${encodeURIComponent(contestId)}`;

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--jnj-white)',
        color: 'var(--jnj-black)',
        padding: '20px 20px 96px',
      }}
    >
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <TopNav homeHref="/join" />

        <div
          style={{
            marginTop: 8,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="jnj-mono"
              style={{ fontSize: 12, color: 'var(--jnj-grey-500)', marginBottom: 4 }}
            >
              {contest.id}
            </div>
            <h1
              className="jnj-display"
              style={{ fontSize: 'clamp(28px, 9vw, 44px)', lineHeight: 1.0 }}
            >
              {contest.name}
            </h1>
            {(contest.period_start || contest.period_end) && (
              <p
                className="jnj-caption"
                style={{ marginTop: 8, color: 'var(--jnj-grey-500)' }}
              >
                {contest.period_start} ~ {contest.period_end ?? ''}
              </p>
            )}
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
              border: '1px solid var(--jnj-grey-200)',
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

        <JoinForm contestId={contestId} suggestedNum={suggestedNum} />
      </div>
    </main>
  );
}
