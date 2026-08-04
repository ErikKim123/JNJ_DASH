// POST /api/ajudge/jobs/[jobId]/song — 원곡 업로드 완료 통보 → 큐 복귀. design §4.2
//
// 워커는 오디오 추출 실패를 failed 로 기록만 하고 큐 복귀는 웹앱이 담당한다.
// (사용자가 원곡을 올려야 재시도가 의미 있기 때문)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAuthServer, createClientServer } from '@/lib/ai-judge/supabase-server';

export const dynamic = 'force-dynamic';

const Body = z.object({ audioPath: z.string().min(1) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const auth = await createAuthServer();
  const { data: userData } = await auth.auth.getUser();
  const user = userData.user;
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
  }

  if (!body.audioPath.startsWith(`${user.id}/${jobId}/`)) {
    return NextResponse.json(
      { error: 'VALIDATION_FAILED', message: '업로드 경로가 올바르지 않습니다.' },
      { status: 400 }
    );
  }

  const supabase = await createClientServer();

  const { data: job } = await supabase
    .from('jobs')
    .select('id, status, error_code')
    .eq('id', jobId)
    .maybeSingle();

  if (!job) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  // 오디오 추출 실패로 멈춘 잡만 원곡으로 재개할 수 있다.
  if (job.status !== 'failed' || job.error_code !== 'AUDIO_EXTRACT_FAILED') {
    return NextResponse.json(
      { error: 'INVALID_STATE', message: '원곡으로 재시도할 수 있는 상태가 아닙니다.' },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from('jobs')
    .update({
      audio_path: body.audioPath,
      status: 'queued',
      error_code: '',
      error_message: '',
      claimed_by: '',
      claimed_at: null,
    })
    .eq('id', jobId);

  if (error) {
    return NextResponse.json({ error: 'INTERNAL', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'queued' });
}
