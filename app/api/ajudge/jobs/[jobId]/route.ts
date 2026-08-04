// GET /api/ajudge/jobs/[jobId] — 분석 대기 화면 폴링용. design §4.2
import { NextResponse } from 'next/server';
import { createAuthServer, createClientServer } from '@/lib/ai-judge/supabase-server';
import { STAGES, stageIndex } from '@/lib/ai-judge/format';
import type { JobSummary } from '@/lib/ai-judge/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const auth = await createAuthServer();
  const { data: userData } = await auth.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const supabase = await createClientServer();

  // RLS 가 소유권을 강제하므로 user_id 조건을 따로 걸지 않아도 남의 잡은 안 나온다.
  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, status, error_code')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'INTERNAL', message: error.message }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  let reportId: string | null = null;
  if (job.status === 'done') {
    const { data: report } = await supabase
      .from('reports')
      .select('id')
      .eq('job_id', jobId)
      .maybeSingle();
    reportId = report?.id ?? null;
  }

  const body: JobSummary = {
    jobId: job.id,
    status: job.status,
    stageIndex: stageIndex(job.status),
    stageCount: STAGES.length,
    errorCode: job.error_code ?? '',
    reportId,
  };
  return NextResponse.json(body);
}
