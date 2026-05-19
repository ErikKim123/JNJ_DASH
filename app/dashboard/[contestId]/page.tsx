// Design Ref: §7.1 — Dashboard 진입점 (Server Component). meta는 서버에서 미리 fetch.
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getContestMeta, getContestSummary } from '@/lib/db/adapter';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DEFAULT_TEMPLATE_ID } from '@/lib/templates/registry';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ contestId: string }>;
}

export default async function DashboardPage({ params }: PageProps) {
  const { contestId } = await params;

  let meta: Awaited<ReturnType<typeof getContestMeta>>;
  let summary: Awaited<ReturnType<typeof getContestSummary>>;
  try {
    [meta, summary] = await Promise.all([getContestMeta(contestId), getContestSummary(contestId)]);
  } catch (e) {
    return (
      <ErrorScreen
        title="대회 정보를 불러오지 못했습니다"
        message={e instanceof Error ? e.message : String(e)}
      />
    );
  }

  if (!meta || !summary) notFound();

  // Design §12 OQ2 — designTemplateNumber 비어있거나 매핑 안 된 번호는 1번 폴백
  const templateId = summary.designTemplateNumber > 0 ? summary.designTemplateNumber : DEFAULT_TEMPLATE_ID;

  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-ink2">대시보드 로딩 중…</div>}>
      <DashboardShell meta={meta} templateId={templateId} />
    </Suspense>
  );
}

function ErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-3">{title}</h1>
      <pre className="text-xs font-mono text-ink2 bg-panel border border-border rounded p-4 whitespace-pre-wrap">
        {message}
      </pre>
      <p className="text-xs text-ink2 mt-3">
        Supabase 연결을 확인하세요 (로컬: .env.local · Vercel: Project Settings → Environment Variables).
      </p>
    </main>
  );
}
