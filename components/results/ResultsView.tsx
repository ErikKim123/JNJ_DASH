'use client';

// 공개 결과 화면 — CHAMPION(시상대) / RESULTS(라운드별 표) 두 장.
//
// 탭을 나눈 이유: 대부분의 사람은 '누가 1등이야?' 만 보고 나가고, 참가자와 코치는
// 자기 번호를 라운드별로 되짚어 본다. 한 장에 다 쌓으면 앞의 사람은 스크롤을
// 많이 하고 뒤의 사람은 찾기 어렵다.
import { useRef, useState } from 'react';
import { SaveImageButton, EXPORT_HIDE } from './SaveImageButton';
import type {
  PublicResults,
  PublicFinalRow,
  PublicParticipantRow,
  PublicQualifierRow,
  PublicRoundBlock,
} from '@/lib/results/public';

type Tab = 'champion' | 'results';

function fmt(n: number | null, dp = 2): string {
  if (n == null) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(dp);
}

function dateRange(start: string | null, end: string | null): string {
  if (!start && !end) return '';
  if (start && end && start !== end) return `${start} — ${end}`;
  return (start ?? end) as string;
}

/** 시상대 카드 한 장. 1위는 크게, 메달 색으로 등수를 먼저 읽게 한다. */
function PodiumCard({ row }: { row: PublicFinalRow }) {
  const rank = row.rank ?? 0;
  return (
    <div className={`res-card res-podium-rank${rank} ${rank === 1 ? 'res-card-1' : ''}`}>
      {row.photoUrl ? (
        // 참가자 사진은 Supabase Storage 의 공개 URL — next/image 최적화 대상이 아니라 img 로 둔다.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="res-photo" src={row.photoUrl} alt={row.name} loading="lazy" />
      ) : (
        <div className="res-photo-empty" aria-hidden>{row.name.slice(0, 1).toUpperCase()}</div>
      )}
      <div className={`res-medal res-medal-${rank}`}>{rank || '—'}</div>
      <div className="res-card-body">
        <p className="res-card-name">{row.name}</p>
        <p className="res-card-meta">
          {row.country ? `${row.country} · ` : ''}NO {row.num}
        </p>
        <div className="res-card-score">
          <div>
            <span className="res-score-k">TOTAL</span>
            <span className="res-score-v">{fmt(row.total)}</span>
          </div>
          <div>
            <span className="res-score-k">AVG</span>
            <span className="res-score-v">{fmt(row.average)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Podium({ title, rows }: { title: string; rows: PublicFinalRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h2 className="res-podium-title">{title}</h2>
      <div className="res-podium" style={{ marginTop: 'var(--jnj-space-4)' }}>
        {rows.map((r) => <PodiumCard key={r.num} row={r} />)}
      </div>
    </div>
  );
}

function Dancer({ name, country, photoUrl }: { name: string; country: string; photoUrl: string }) {
  return (
    <div className="res-dancer">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="res-avatar" src={photoUrl} alt="" loading="lazy" />
      ) : (
        <span className="res-avatar" aria-hidden />
      )}
      <span className="res-dancer-name">
        {name}
        {country ? <span className="res-country"> · {country}</span> : null}
      </span>
    </div>
  );
}

function FinalTable({ title, rows }: { title: string; rows: PublicFinalRow[] }) {
  return (
    <div>
      <p className="res-col-title">{title}</p>
      {rows.length === 0 ? (
        <p className="res-empty">No results.</p>
      ) : (
        <div className="res-table-wrap">
          <table className="res-table">
            <thead>
              <tr>
                <th>RANK</th><th>NO</th><th>DANCER</th>
                <th style={{ textAlign: 'right' }}>TOTAL</th>
                <th style={{ textAlign: 'right' }}>AVG</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.num}>
                  <td className={`res-rank ${r.rank != null && r.rank <= 3 ? 'res-rank-medal' : ''}`}>
                    {r.rank ?? '—'}
                  </td>
                  <td className="res-num">{r.num}</td>
                  <td><Dancer name={r.name} country={r.country} photoUrl={r.photoUrl} /></td>
                  <td className="res-total">{fmt(r.total)}</td>
                  <td className="res-avg">{fmt(r.average)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QualifierTable({ title, rows }: { title: string; rows: PublicQualifierRow[] }) {
  return (
    <div>
      <p className="res-col-title">{title}</p>
      {rows.length === 0 ? (
        <p className="res-empty">No results.</p>
      ) : (
        <div className="res-table-wrap">
          <table className="res-table">
            <thead>
              <tr>
                <th>NO</th><th>DANCER</th>
                <th style={{ textAlign: 'right' }}>#</th>
                <th style={{ textAlign: 'right' }}>RESULT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.num}>
                  <td className="res-num">{r.num}</td>
                  <td><Dancer name={r.name} country={r.country} photoUrl={r.photoUrl} /></td>
                  <td className="res-avg">{r.votes || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={r.passed ? 'res-pass' : 'res-out'}>{r.passed ? 'PASSED' : '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** 참가자 명단 표 — 순위가 없는 라운드이므로 번호와 댄서만 싣는다. */
function ParticipantTable({ title, rows }: { title: string; rows: PublicParticipantRow[] }) {
  return (
    <div>
      <p className="res-col-title">{title} <span className="res-count">{rows.length}</span></p>
      {rows.length === 0 ? (
        <p className="res-empty">No entries.</p>
      ) : (
        <div className="res-table-wrap">
          <table className="res-table">
            <thead>
              <tr><th>NO</th><th>DANCER</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.num}>
                  <td className="res-num">{r.num}</td>
                  <td><Dancer name={r.name} country={r.country} photoUrl={r.photoUrl} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** 라운드 한 덩어리 — 리더/팔로워를 나란히. 표가 비면 통째로 숨긴다. */
function RoundSection<T>({
  title,
  block,
  render,
}: {
  title: string;
  block: PublicRoundBlock<T>;
  render: (title: string, rows: T[]) => React.ReactNode;
}) {
  if (block.leaders.length === 0 && block.followers.length === 0) return null;
  return (
    <section className="res-section">
      <h2 className="res-section-title">{title}</h2>
      <div className="res-cols">
        {render('LEADERS', block.leaders)}
        {render('FOLLOWERS', block.followers)}
      </div>
    </section>
  );
}

export function ResultsView({ data }: { data: PublicResults }) {
  // 시상대가 비어 있으면(순위 미입력) 표부터 보여 준다 — 빈 시상대가 첫 화면이면
  // '결과가 없는 대회' 로 읽힌다.
  const hasPodium = data.podium.leaders.length > 0 || data.podium.followers.length > 0;
  const [tab, setTab] = useState<Tab>(hasPodium ? 'champion' : 'results');

  const period = dateRange(data.periodStart, data.periodEnd);

  // 이미지로 뜨는 범위 — 머리말부터 아래 내용까지 한 덩어리.
  // 지금 열려 있는 탭만 그려져 있으므로, 버튼 하나가 두 화면을 각각 담아낸다.
  const captureRef = useRef<HTMLElement | null>(null);

  return (
    <main className="res-page" ref={captureRef}>
      <header className="res-head">
        {data.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="res-head-icon" src={data.iconUrl} alt="" />
        ) : null}
        <h1 className="res-title jnj-display">{data.header}</h1>
        {data.tagline ? <p className="res-sub jnj-body">{data.tagline}</p> : null}
        <p className="res-sub jnj-small" style={{ letterSpacing: '0.08em' }}>
          {[data.hostOrg, period].filter(Boolean).join(' · ')}
        </p>
      </header>

      {/* 탭 줄은 그림에 담지 않는다 — 눌리지 않는 버튼이 찍혀 봐야 읽는 사람을 헷갈리게 한다. */}
      <div className="res-toolbar" {...{ [EXPORT_HIDE]: '' }}>
        <div className="res-tabs" role="tablist" aria-label="Results sections">
          <button
            type="button" role="tab" className="res-tab"
            aria-selected={tab === 'champion'}
            onClick={() => setTab('champion')}
          >
            CHAMPION
          </button>
          <button
            type="button" role="tab" className="res-tab"
            aria-selected={tab === 'results'}
            onClick={() => setTab('results')}
          >
            RESULTS
          </button>
        </div>
        <SaveImageButton
          targetRef={captureRef}
          fileName={`${data.contestId}-${tab}`}
        />
      </div>

      {tab === 'champion' ? (
        hasPodium ? (
          <div className="res-podium-band">
            <Podium title="LEADERS" rows={data.podium.leaders} />
            <Podium title="FOLLOWERS" rows={data.podium.followers} />
          </div>
        ) : (
          <p className="res-empty" style={{ textAlign: 'center' }}>Champions have not been announced yet.</p>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--jnj-space-7)' }}>
          <RoundSection
            title="FINALS"
            block={data.final}
            render={(t, rows) => <FinalTable key={t} title={t} rows={rows} />}
          />
          <RoundSection
            title="SEMI-FINALS"
            block={data.semi}
            render={(t, rows) => <QualifierTable key={t} title={t} rows={rows} />}
          />
          <RoundSection
            title="PRELIMS"
            block={data.prelim}
            render={(t, rows) => <QualifierTable key={t} title={t} rows={rows} />}
          />
          <RoundSection
            title="PARTICIPANTS"
            block={data.participants}
            render={(t, rows) => <ParticipantTable key={t} title={t} rows={rows} />}
          />
        </div>
      )}

      <footer className="res-foot">
        {data.publishedAt
          ? `Published ${new Date(data.publishedAt).toLocaleString()}`
          : 'Official results'}
      </footer>
    </main>
  );
}
