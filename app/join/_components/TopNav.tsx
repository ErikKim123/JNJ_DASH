// /join 상단 내비게이션 — 뒤로 / 새로고침 / 트로피.
// 원형 아이콘 버튼. variant 로 dark / light 전환. (홈 버튼은 제거됨)
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function TopNav({
  variant = 'light',
  trophyHref,
}: {
  variant?: 'light' | 'dark';
  /** @deprecated 홈 버튼 제거로 미사용. 호출부 호환을 위해 타입만 유지. */
  homeHref?: string;
  trophyHref?: string;
}) {
  const router = useRouter();
  const stroke = variant === 'dark' ? 'var(--jnj-white)' : 'var(--jnj-black)';
  const border = variant === 'dark' ? 'var(--jnj-grey-500)' : 'var(--jnj-grey-300)';
  const hoverBg = variant === 'dark' ? 'var(--jnj-grey-800)' : 'var(--jnj-grey-100)';

  const btnStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 9999,
    border: `1.5px solid ${border}`,
    background: 'transparent',
    color: stroke,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 200ms',
  };

  return (
    <nav style={{ display: 'flex', gap: 10, padding: '12px 0 8px' }}>
      <button
        type="button"
        aria-label="Back"
        onClick={() => router.back()}
        style={btnStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <Icon name="arrow-left" stroke={stroke} />
      </button>
      <button
        type="button"
        aria-label="Refresh"
        onClick={() => router.refresh()}
        style={btnStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <Icon name="refresh" stroke={stroke} />
      </button>
      <Link
        href={trophyHref ?? '/join/competitions'}
        aria-label="Competitions"
        style={{
          ...btnStyle,
          background: variant === 'dark' ? 'var(--jnj-white)' : 'var(--jnj-black)',
          color: variant === 'dark' ? 'var(--jnj-black)' : 'var(--jnj-white)',
          borderColor: variant === 'dark' ? 'var(--jnj-white)' : 'var(--jnj-black)',
          textDecoration: 'none',
        }}
      >
        <Icon name="trophy" stroke={variant === 'dark' ? 'var(--jnj-black)' : 'var(--jnj-white)'} />
      </Link>
    </nav>
  );
}

function Icon({ name, stroke }: { name: 'arrow-left' | 'home' | 'refresh' | 'trophy'; stroke: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'arrow-left':
      return (
        <svg {...common}>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      );
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5z" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" />
        </svg>
      );
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4zM7 6H4a2 2 0 0 0 2 2h1M17 6h3a2 2 0 0 1-2 2h-1" />
        </svg>
      );
  }
}
