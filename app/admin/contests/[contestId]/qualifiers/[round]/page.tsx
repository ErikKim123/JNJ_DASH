import { notFound } from 'next/navigation';
import { getContest, listParticipants, listQualifiersWithLiveVotes } from '@/lib/db/queries';
import { QualifiersPanel } from '@/components/admin/QualifiersPanel';
import { ContestTabs } from '@/components/admin/ContestTabs';
import { PageHeader } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function QualifiersPage({
  params,
}: {
  params: Promise<{ contestId: string; round: string }>;
}) {
  const { contestId, round } = await params;
  if (round !== 'prelim' && round !== 'semi') notFound();
  const contest = await getContest(contestId);
  if (!contest) notFound();

  // judge_votes 의 O 카운트로 라이브 votes 가 채워진 qualifiers.
  // votes > 0 만 노출 — Judging 매트릭스에서 점수 한 표라도 받은 사람만 통과 후보.
  const [allQualifiers, participants] = await Promise.all([
    listQualifiersWithLiveVotes(contestId, round),
    listParticipants(contestId),
  ]);
  const qualifiers = allQualifiers
    .filter((q) => q.votes > 0)
    .sort((a, b) =>
      // 1) display_order asc (운영자 수동 정렬 우선)
      // 2) votes desc
      // 3) participant_num asc
      (a.display_order - b.display_order) ||
      (b.votes - a.votes) ||
      a.participant_num.localeCompare(b.participant_num, undefined, { numeric: true })
    );

  const base = `/admin/contests/${encodeURIComponent(contestId)}`;
  const label = round === 'prelim' ? 'Prelim' : 'Semi';
  const maxPerRole = round === 'prelim' ? contest.prelim_pass_per_role : contest.semi_pass_per_role;

  return (
    <>
      <PageHeader
        title={
          <>
            <span className="font-mono text-xs text-ink2 mr-2">{contest.id}</span>
            {contest.name} · {label} Qualifiers
          </>
        }
        subtitle={`Capacity: ${maxPerRole} per role · Only judging-scored candidates are listed`}
      />
      <ContestTabs contestId={contestId} current={`${base}/qualifiers/${round}`} />
      <QualifiersPanel
        contestId={contestId}
        round={round}
        initial={qualifiers}
        participants={participants}
        maxPerRole={maxPerRole}
      />
    </>
  );
}
