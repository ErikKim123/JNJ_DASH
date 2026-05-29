// /join/[contestId]/done?num=XXX&mail=1|0&to=&reason= — 신청 완료 확인 화면.
import Link from 'next/link';
import { getContest } from '@/lib/db/queries';
import { contestTheme, joinRootProps } from '@/lib/join/theme';

export const dynamic = 'force-dynamic';

export default async function DonePage({
  params,
  searchParams,
}: {
  params: Promise<{ contestId: string }>;
  searchParams: Promise<{ num?: string; mail?: string; to?: string; reason?: string }>;
}) {
  const { contestId } = await params;
  const { num, mail, to, reason } = await searchParams;
  const contest = await getContest(contestId);
  const theme = contestTheme(contest);
  const root = joinRootProps(theme);

  // 메일 상태 해석
  const mailSent = mail === '1';
  const mailAttempted = mail === '0' || mail === '1';
  const mailReasonLabel = (() => {
    if (!reason) return '';
    if (reason === 'NO_EMAIL') return '이메일 미입력';
    if (reason === 'INVALID_TO') return '이메일 형식 오류';
    if (reason === 'NO_API_KEY') return '메일 서버 미설정';
    if (reason === 'PROVIDER_ERROR') return '발송 서버 오류';
    return reason;
  })();

  return (
    <main
      className={root.className}
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 20px 32px',
        ...root.style,
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
        <div className="jnj-mono jnj-small" style={{ color: 'var(--jnj-text-muted)' }}>
          JNJ / {contest?.id ?? contestId}
        </div>

        <div style={{ flex: 1 }} />

        {/* 성공 배지 */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 9999,
            background: 'rgba(0, 125, 72, 0.10)',
            border: '1px solid rgba(0, 125, 72, 0.30)',
            color: 'var(--jnj-green)',
            fontSize: 13,
            fontWeight: 600,
            alignSelf: 'flex-start',
            marginBottom: 16,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>등록 완료 · Entry Confirmed</span>
        </div>

        <div>
          <h1
            className="jnj-display"
            style={{
              fontSize: 'clamp(36px, 11vw, 56px)',
              marginTop: 4,
              marginBottom: 4,
              lineHeight: 1.0,
            }}
          >
            참가 신청이
            <br />
            완료되었습니다.
          </h1>
          <p
            className="jnj-mono"
            style={{
              marginTop: 12,
              fontSize: 13,
              color: 'var(--jnj-text-muted)',
              letterSpacing: '0.08em',
            }}
          >
            YOUR REGISTRATION HAS BEEN RECEIVED.
          </p>
        </div>

        {/* 참가 번호 카드 */}
        <div
          style={{
            marginTop: 28,
            padding: '20px 24px',
            border: '1px solid var(--jnj-border)',
            borderRadius: 16,
            background: 'var(--jnj-surface-2)',
          }}
        >
          <p
            className="jnj-mono"
            style={{
              fontSize: 11,
              color: 'var(--jnj-text-muted)',
              letterSpacing: '0.1em',
              fontWeight: 600,
              margin: 0,
            }}
          >
            PARTICIPANT NUMBER · 참가 번호
          </p>
          <p
            className="jnj-display"
            style={{
              fontSize: 'clamp(56px, 18vw, 88px)',
              lineHeight: 1.0,
              marginTop: 8,
              marginBottom: 0,
              color: 'var(--jnj-text)',
            }}
          >
            No. {num ?? '—'}
          </p>
          {contest && (
            <p
              className="jnj-caption"
              style={{ marginTop: 12, color: 'var(--jnj-text-muted)' }}
            >
              {contest.name}
              {contest.period_start ? ` · ${contest.period_start} ~ ${contest.period_end ?? ''}` : ''}
            </p>
          )}
        </div>

        {/* 안내 메시지 */}
        <div style={{ marginTop: 20 }}>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.7,
              color: 'var(--jnj-text)',
              margin: 0,
            }}
          >
            <strong>대회 시작 30분 전</strong>에 도착해 주세요.
            <br />
            체크인 시 위 <strong>참가 번호</strong>를 알려주시면 됩니다.
          </p>
        </div>

        {/* 메일 상태 */}
        {mailAttempted && (
          <div
            style={{
              marginTop: 16,
              padding: '12px 16px',
              borderRadius: 12,
              fontSize: 14,
              lineHeight: 1.5,
              border: `1px solid ${mailSent ? 'var(--jnj-border)' : 'rgba(255, 80, 0, 0.30)'}`,
              background: mailSent ? 'var(--jnj-track)' : 'rgba(255, 80, 0, 0.06)',
              color: mailSent ? 'var(--jnj-text-muted)' : 'var(--jnj-orange-flash, #FF5000)',
            }}
          >
            {mailSent ? (
              <>
                ✉ 확인 메일을 <strong>{to ?? '입력하신 주소'}</strong> 로 보냈습니다.
                <br />
                <span style={{ fontSize: 12, color: 'var(--jnj-text-muted)' }}>
                  메일이 보이지 않으면 스팸함도 확인해 주세요.
                </span>
              </>
            ) : (
              <>
                ⚠ 확인 메일이 발송되지 않았습니다 ({mailReasonLabel || '사유 미상'}).
                <br />
                <span style={{ fontSize: 12 }}>
                  운영팀이 별도로 안내 드릴 수 있으니, 위 참가 번호를 보관해 주세요.
                </span>
              </>
            )}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 24 }} />

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
