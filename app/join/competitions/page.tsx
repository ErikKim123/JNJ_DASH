// /join/competitions
//   ?group 없음 → 그룹 폴더 목록 (JLCL / PSLF / Other …)
//   ?group=KEY  → 해당 그룹에 속한 대회 카드 목록
// archived/done 은 자동 제외(목록에 안 보임). live 도 카드는 보이되 클릭 비활성.
import Link from 'next/link';
import { headers } from 'next/headers';
import { listContests } from '@/lib/db/queries';
import type { ContestRow } from '@/lib/db/types';
import { pickJoinTheme, joinRootProps, DEFAULT_JOIN_THEME } from '@/lib/join/theme';
import { TopNav } from '../_components/TopNav';

export const dynamic = 'force-dynamic';

const OTHER_GROUP_KEY = '__other__';
const OTHER_GROUP_LABEL = 'Other';

function buildQrSrc(url: string, size = 120): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${encodeURIComponent(url)}`;
}

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
    background: 'var(--jnj-surface)',
    borderColor: 'var(--jnj-border)',
    color: 'var(--jnj-text)',
    padding: 20,
  };
  if (!isOpen) {
    return (
      <div
        className="jnj-card"
        aria-disabled="true"
        style={{ ...sharedStyle, cursor: 'not-allowed', opacity: 0.55 }}
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

// 그룹 폴더 카드 — 그룹명 + 해당 그룹의 대회 수 + 그룹 링크 QR
function GroupFolderCard({
  groupKey,
  groupLabel,
  count,
  origin,
}: {
  groupKey: string;
  groupLabel: string;
  count: number;
  origin: string;
}) {
  const groupUrl = `${origin}/join/competitions?group=${encodeURIComponent(groupKey)}`;
  return (
    <Link
      href={`/join/competitions?group=${encodeURIComponent(groupKey)}`}
      className="jnj-card jnj-card-clickable"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        background: 'var(--jnj-surface)',
        borderColor: 'var(--jnj-border)',
        color: 'var(--jnj-text)',
        padding: '24px 20px',
        textDecoration: 'none',
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 56,
          height: 44,
          borderRadius: 6,
          background: 'linear-gradient(135deg, var(--jnj-grey-700), var(--jnj-grey-800))',
          border: '1px solid var(--jnj-grey-700)',
          position: 'relative',
        }}
      >
        {/* 폴더 탭 — 단순 SVG 라인 아트로 폴더 형태 */}
        <span
          style={{
            position: 'absolute',
            top: -4,
            left: 6,
            width: 18,
            height: 6,
            background: 'var(--jnj-grey-700)',
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
            borderTop: '1px solid var(--jnj-grey-700)',
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="jnj-h2" style={{ marginBottom: 4, lineHeight: 1.2 }}>
          {groupLabel}
        </div>
        <div className="jnj-caption" style={{ color: 'var(--jnj-text-muted)' }}>
          {count} {count === 1 ? 'competition' : 'competitions'}
        </div>
      </div>
      <div
        title={groupUrl}
        style={{
          flexShrink: 0,
          width: 72,
          height: 72,
          background: 'var(--jnj-white)',
          borderRadius: 8,
          padding: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={buildQrSrc(groupUrl, 120)}
          alt={`QR for ${groupLabel}`}
          width={62}
          height={62}
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          fontSize: 24,
          color: 'var(--jnj-text-muted)',
          paddingRight: 4,
        }}
      >
        ›
      </span>
    </Link>
  );
}

interface PageProps {
  searchParams: Promise<{ group?: string }>;
}

export default async function CompetitionsPage({ searchParams }: PageProps) {
  const { group } = await searchParams;
  const selectedGroup = group ?? null;

  const all = await listContests().catch(() => []);
  const contests = all.filter((c) => c.status !== 'archived');

  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const origin = `${proto}://${host}`;

  // 그룹 키 정규화 헬퍼 — 빈 문자열은 OTHER_GROUP_KEY 로 통일.
  const keyOf = (c: ContestRow) => (c.group_name && c.group_name.trim()) || OTHER_GROUP_KEY;
  const labelOf = (k: string) => (k === OTHER_GROUP_KEY ? OTHER_GROUP_LABEL : k);

  // 톤앤매너 — 그룹 선택 시에만 그 그룹의 테마를 따른다.
  // 그룹 밖(전체 그룹 목록)은 기본 테마 고정 — 특정 그룹 색이 전체로 새지 않게.
  const theme = selectedGroup
    ? pickJoinTheme(contests.filter((c) => keyOf(c) === selectedGroup))
    : DEFAULT_JOIN_THEME;
  const root = joinRootProps(theme);

  // 트로피 → 그룹 안이면 그 그룹 목록(현재 화면), 그룹 밖이면 전체 그룹 목록.
  const trophyHref = selectedGroup
    ? `/join/competitions?group=${encodeURIComponent(selectedGroup)}`
    : '/join/competitions';

  return (
    <main
      style={{
        minHeight: '100dvh',
        padding: '20px 20px 48px',
        ...root.style,
      }}
      className={root.className}
    >
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <TopNav variant={root.mode === 'dark' ? 'dark' : 'light'} trophyHref={trophyHref} />

        {selectedGroup === null
          ? renderGroupList(contests, keyOf, labelOf, origin)
          : renderContestList(
              contests.filter((c) => keyOf(c) === selectedGroup),
              selectedGroup,
              labelOf(selectedGroup),
              origin,
            )}
      </div>
    </main>
  );
}

// ── 그룹 폴더 리스트 ──────────────────────────────────────────────────
function renderGroupList(
  contests: ContestRow[],
  keyOf: (c: ContestRow) => string,
  labelOf: (k: string) => string,
  origin: string,
) {
  // 그룹별 카운트 집계. 정렬: Other 는 항상 맨 마지막, 나머지는 알파벳/한글 순.
  const counts = new Map<string, number>();
  for (const c of contests) {
    const k = keyOf(c);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const groupKeys = [...counts.keys()].sort((a, b) => {
    if (a === OTHER_GROUP_KEY) return 1;
    if (b === OTHER_GROUP_KEY) return -1;
    return a.localeCompare(b);
  });

  return (
    <>
      <h1
        className="jnj-display"
        style={{ fontSize: 'clamp(40px, 12vw, 56px)', marginTop: 12, marginBottom: 8 }}
      >
        Competitions
      </h1>
      <p className="jnj-caption" style={{ color: 'var(--jnj-text-muted)', marginBottom: 24 }}>
        Select a group folder.
      </p>

      {groupKeys.length === 0 ? (
        <div
          className="jnj-card"
          style={{
            background: 'var(--jnj-surface)',
            borderColor: 'var(--jnj-border)',
            padding: 28,
            textAlign: 'center',
          }}
        >
          <p className="jnj-h3" style={{ marginBottom: 8 }}>No competitions open.</p>
          <p className="jnj-caption" style={{ color: 'var(--jnj-text-muted)' }}>
            Check back soon.
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
          {groupKeys.map((k) => (
            <li key={k}>
              <GroupFolderCard groupKey={k} groupLabel={labelOf(k)} count={counts.get(k) ?? 0} origin={origin} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ── 그룹 내 대회 카드 리스트 ──────────────────────────────────────────
function renderContestList(
  contests: ContestRow[],
  groupKey: string,
  groupLabel: string,
  origin: string,
) {
  const groupUrl = `${origin}/join/competitions?group=${encodeURIComponent(groupKey)}`;
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            className="jnj-display"
            style={{ fontSize: 'clamp(36px, 11vw, 52px)', marginTop: 12, marginBottom: 8 }}
          >
            {groupLabel}
          </h1>
          <p className="jnj-caption" style={{ color: 'var(--jnj-text-muted)', margin: 0 }}>
            Select a competition to join.
          </p>
        </div>
        <div
          title={groupUrl}
          style={{
            flexShrink: 0,
            width: 120,
            height: 120,
            background: 'var(--jnj-white)',
            borderRadius: 10,
            padding: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 12,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={buildQrSrc(groupUrl, 200)}
            alt={`QR for ${groupLabel}`}
            width={104}
            height={104}
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
        </div>
      </div>

      {contests.length === 0 ? (
        <div
          className="jnj-card"
          style={{
            background: 'var(--jnj-surface)',
            borderColor: 'var(--jnj-border)',
            padding: 28,
            textAlign: 'center',
          }}
        >
          <p className="jnj-h3" style={{ marginBottom: 8 }}>No competitions in this group.</p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
          {contests.map((c) => {
            const isOpen = c.status === 'ready';
            const absUrl = `${origin}/join/${encodeURIComponent(c.id)}`;
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
                        color: 'var(--jnj-text-muted)',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          padding: '2px 8px',
                          borderRadius: 9999,
                          border: `1px solid ${isOpen ? 'var(--jnj-green)' : 'var(--jnj-border)'}`,
                          color: isOpen ? 'var(--jnj-green)' : 'var(--jnj-text-muted)',
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
                        marginBottom: 0,
                        lineHeight: 1.2,
                        color: isOpen ? 'var(--jnj-text)' : 'var(--jnj-text-muted)',
                      }}
                    >
                      {c.name}
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
    </>
  );
}
