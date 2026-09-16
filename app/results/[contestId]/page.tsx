// /results/<대회ID> — 결승 결과 공개 페이지.
//
// 운영자가 [웹게시] 를 켜야 열린다. 꺼져 있으면 404 — '아직 공개 전' 이라는 안내조차
// 내보내지 않는다. 안내를 내보내면 그 자체가 '이 대회가 채점 중' 이라는 정보가 된다.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicResults } from '@/lib/results/public';
import { ResultsView } from '@/components/results/ResultsView';

export const dynamic = 'force-dynamic';

interface Props { params: Promise<{ contestId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { contestId } = await params;
  const data = await getPublicResults(contestId).catch(() => null);
  if (!data) return { title: 'JNJ RESULTS' };
  const title = `${data.contestName} — Results`;
  return {
    title,
    description: data.tagline || `Official results for ${data.contestName}.`,
    // 공개 링크는 카카오톡·인스타 DM 으로 퍼진다. 미리보기에 대회명이 뜨게 해 둔다.
    openGraph: { title, description: data.tagline || data.hostOrg || '', type: 'website' },
  };
}

export default async function ResultsPage({ params }: Props) {
  const { contestId } = await params;
  const data = await getPublicResults(contestId);
  if (!data) notFound();
  return <ResultsView data={data} />;
}
