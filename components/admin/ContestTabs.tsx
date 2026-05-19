'use client';

// 대회 상세 페이지들의 공통 탭.
// LocaleProvider 안에서 동작하도록 client 컴포넌트로 전환 — 영/한 라벨 자동 전환.
import { Tabs } from './ui';
import { useT } from '@/lib/i18n/LocaleContext';

export function ContestTabs({ contestId, current }: { contestId: string; current: string }) {
  const t = useT();
  const base = `/admin/contests/${encodeURIComponent(contestId)}`;
  return (
    <Tabs
      current={current}
      items={[
        { href: base,                       label: t('tab.contestInfo') },
        { href: `${base}/judges`,           label: t('tab.judges') },
        { href: `${base}/participants`,     label: t('tab.participants') },
        { href: `${base}/pairings/prelim`,  label: t('tab.prelimPairing') },
        { href: `${base}/judging/prelim`,   label: t('tab.prelimJudging') },
        { href: `${base}/qualifiers/prelim`,label: t('tab.prelimQualifiers') },
        { href: `${base}/pairings/semi`,    label: t('tab.semiPairing') },
        { href: `${base}/judging/semi`,     label: t('tab.semiJudging') },
        { href: `${base}/qualifiers/semi`,  label: t('tab.semiQualifiers') },
        { href: `${base}/judging/final`,    label: t('tab.finalJudging') },
        { href: `${base}/finals`,           label: t('tab.finalResults') },
      ]}
    />
  );
}
