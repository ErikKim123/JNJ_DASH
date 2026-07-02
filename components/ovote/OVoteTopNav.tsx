'use client';

// 온라인 VOTE 앱 상단 메뉴 — VOTE 앱(NavBar + JudgeBadge)과 동일한 디자인.
//   좌측: 이전 / 홈 / 갱신 / 대회목록(트로피) 원형 아이콘 버튼
//   우측: 로그인한 온라인 심사위원 배지(이름 + 번호) + 로그아웃
import * as React from 'react';
import { useRouter } from 'next/navigation';

export function OVoteTopNav({
  back,
  competitionsHref = '/ovote/competitions',
  loading = false,
  onRefresh,
  judgeName,
  judgeNo,
  onLogout,
}: {
  back?: string;
  competitionsHref?: string;
  loading?: boolean;
  onRefresh?: () => void;
  judgeName?: string;
  judgeNo?: number;
  onLogout?: () => void;
}): React.ReactElement {
  const router = useRouter();
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--jnj-space-3)',
        flexWrap: 'wrap',
      }}
    >
      <nav aria-label="Page navigation" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--jnj-space-2)' }}>
        <IconButton label="Back" disabled={!back} onClick={() => back && router.push(back)} icon={<BackIcon />} />
        <IconButton label="Home" onClick={() => router.push('/ovote')} icon={<HomeIcon />} />
        <IconButton
          label="Refresh"
          loading={loading}
          disabled={loading || !onRefresh}
          onClick={() => onRefresh?.()}
          icon={<RefreshIcon spinning={loading} />}
        />
        <IconButton label="Competitions" onClick={() => router.push(competitionsHref)} icon={<TrophyIcon />} />
      </nav>

      {judgeName && <JudgeBadge name={judgeName} no={judgeNo} onLogout={onLogout} />}
    </header>
  );
}

function JudgeBadge({ name, no, onLogout }: { name: string; no?: number; onLogout?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--jnj-space-3)',
        padding: 'var(--jnj-space-2) var(--jnj-space-4)',
        borderRadius: 'var(--jnj-radius-pill)',
        background: 'var(--jnj-grey-100)',
        fontFamily: 'var(--jnj-font-text-medium)',
        fontSize: 'var(--jnj-size-link-sm)',
      }}
    >
      <span aria-label="Judge" title="Judge" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--jnj-text-secondary)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="m9 14 2 2 4-4" />
        </svg>
      </span>
      <span style={{ color: 'var(--jnj-text-primary)' }}>{name}</span>
      {no != null && (
        <span
          style={{
            padding: '2px var(--jnj-space-2)',
            borderRadius: 'var(--jnj-radius-pill)',
            background: 'var(--jnj-grey-200)',
            color: 'var(--jnj-text-primary)',
            fontSize: 'var(--jnj-size-small)',
            letterSpacing: '0.04em',
          }}
        >
          #{no}
        </span>
      )}
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          aria-label="Logout"
          title="Logout"
          style={{
            appearance: 'none', background: 'transparent', border: 'none', padding: 0,
            marginLeft: 'var(--jnj-space-1)', color: 'var(--jnj-text-secondary)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function IconButton({
  label, icon, onClick, loading = false, disabled = false,
}: {
  label: string; icon: React.ReactNode; onClick: () => void; loading?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        appearance: 'none',
        cursor: disabled ? (loading ? 'wait' : 'not-allowed') : 'pointer',
        background: 'transparent',
        color: 'var(--jnj-text-primary)',
        borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--jnj-grey-300)',
        borderRadius: '999px', width: 36, height: 36,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        opacity: disabled && !loading ? 0.5 : 1,
        transition: 'var(--jnj-transition)',
      }}
    >
      {icon}
      <style>{`@keyframes jnj-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animation: spinning ? 'jnj-spin 1s linear infinite' : 'none' }}>
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h2a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3" /><path d="M7 5H5a2 2 0 0 0-2 2v1a3 3 0 0 0 3 3" />
    </svg>
  );
}
