// Design Ref: §11.2 — HOME 대회 카드. designTemplateNumber 비어있으면 ⚠️ 뱃지.
import Link from 'next/link';
import type { ContestSummary } from '@/lib/sheets/types';

// API 응답에서 spreadsheetId가 제거된 형태
export type ContestCardData = Omit<ContestSummary, 'spreadsheetId'>;

export function ContestCard({ contest }: { contest: ContestCardData }) {
  const period =
    contest.startDate && contest.endDate
      ? `${contest.startDate} ~ ${contest.endDate}`
      : contest.startDate ?? '';

  // Plan §12 OQ2 — designTemplateNumber 비어있는 경우 1로 폴백, 단 시각적으로 경고
  const hasExplicitTemplate = Number.isInteger(contest.designTemplateNumber) && contest.designTemplateNumber > 0;

  return (
    <Link
      href={`/dashboard/${encodeURIComponent(contest.contestId)}`}
      className="block rounded-xl border border-border bg-panel p-6 hover:border-accent2 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-mono text-ink2 tracking-widest uppercase mb-1">
            {contest.contestId}
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-ink mb-1 truncate">
            {contest.name}
          </h2>
          {period ? (
            <p className="text-xs text-ink2 font-mono">{period}</p>
          ) : null}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          {hasExplicitTemplate ? (
            <span className="text-[10px] font-mono px-2 py-1 rounded bg-accent text-[#1A1612] font-semibold tracking-wider">
              TPL · {contest.designTemplateNumber}
            </span>
          ) : (
            <span
              title="디자인 템플릿 번호가 비어있습니다. 기본 템플릿(1번)으로 표출됩니다."
              className="text-[10px] font-mono px-2 py-1 rounded bg-border text-danger font-semibold tracking-wider"
            >
              ⚠ TPL · 1 (default)
            </span>
          )}
          {contest.status ? (
            <span className="text-[10px] font-mono text-ink2 uppercase tracking-widest">
              {contest.status}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
