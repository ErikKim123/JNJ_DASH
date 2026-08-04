// POST /api/ajudge/jobs — 업로드 완료 후 분석 잡을 큐에 넣는다. design §4.2
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAuthServer, createClientServer, MEDIA_BUCKET } from '@/lib/ai-judge/supabase-server';

export const dynamic = 'force-dynamic';

const Body = z.object({
  jobId: z.string().uuid(),
  videoPath: z.string().min(1),
  role: z.enum(['leader', 'follower', 'couple']),
  leaderSide: z.enum(['', 'left', 'right']).default(''),
  songTitle: z.string().max(200).default(''),
  contestId: z.string().max(64).nullable().default(null),
});

export async function POST(req: Request) {
  const auth = await createAuthServer();
  const { data: userData } = await auth.auth.getUser();
  const user = userData.user;
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: 'VALIDATION_FAILED', message: '요청 형식이 올바르지 않습니다.' },
      { status: 400 }
    );
  }

  // 커플 모드는 리더 위치가 있어야 싱크로 시차의 부호를 해석할 수 있다(Plan Q5).
  if (body.role === 'couple' && !body.leaderSide) {
    return NextResponse.json(
      { error: 'VALIDATION_FAILED', message: '커플 모드는 리더 위치를 선택해 주세요.' },
      { status: 400 }
    );
  }

  // 업로드 경로가 본인 소유인지 확인 — RLS 로도 막히지만 명확한 에러를 위해 선검사.
  if (!body.videoPath.startsWith(`${user.id}/${body.jobId}/`)) {
    return NextResponse.json(
      { error: 'VALIDATION_FAILED', message: '업로드 경로가 올바르지 않습니다.' },
      { status: 400 }
    );
  }

  const supabase = await createClientServer();

  // 객체가 실제로 올라왔는지 확인한다(업로드 중단 시 워커가 헛돌지 않게).
  const dir = `${user.id}/${body.jobId}`;
  const { data: listed } = await supabase.storage.from(MEDIA_BUCKET).list(dir);
  const name = body.videoPath.slice(dir.length + 1);
  if (!listed?.some((o) => o.name === name)) {
    return NextResponse.json(
      { error: 'UPLOAD_NOT_FOUND', message: '업로드된 영상을 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  const { error } = await supabase.from('jobs').insert({
    id: body.jobId,
    user_id: user.id,
    video_path: body.videoPath,
    role: body.role,
    leader_side: body.leaderSide,
    song_title: body.songTitle,
    contest_id: body.contestId,
    status: 'queued',
  });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'JOB_ALREADY_EXISTS' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'INTERNAL', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ jobId: body.jobId, status: 'queued' }, { status: 201 });
}
