// POST /api/ajudge/uploads — Storage signed upload URL 발급. design §4.2
//
// 파일은 서버를 거치지 않고 브라우저가 Storage 로 직접 올린다(500MB 영상).
// 경로는 서버가 결정한다 — 사용자 입력 파일명을 경로에 쓰지 않는다(경로 조작 방지).
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createAuthServer, createClientServer, MEDIA_BUCKET } from '@/lib/ai-judge/supabase-server';

export const dynamic = 'force-dynamic';

const MAX_MB = Number(process.env.NEXT_PUBLIC_AI_JUDGE_MAX_MB ?? '500');

const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime']);
const SONG_TYPES = new Set([
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac',
]);

const Body = z.object({
  kind: z.enum(['video', 'song']),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  // song 업로드는 기존 job 에 붙는다.
  jobId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const auth = await createAuthServer();
  const { data: userData } = await auth.auth.getUser();
  const user = userData.user;
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: 'VALIDATION_FAILED', message: '요청 형식이 올바르지 않습니다.' },
      { status: 400 }
    );
  }

  const allowed = body.kind === 'video' ? VIDEO_TYPES : SONG_TYPES;
  if (!allowed.has(body.contentType)) {
    return NextResponse.json(
      {
        error: 'VALIDATION_FAILED',
        message:
          body.kind === 'video'
            ? 'mp4 또는 mov 파일만 올릴 수 있습니다.'
            : 'mp3, wav, m4a 파일만 올릴 수 있습니다.',
      },
      { status: 400 }
    );
  }

  if (body.sizeBytes > MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      {
        error: 'FILE_TOO_LARGE',
        message: `${MAX_MB}MB 이내로 올려 주세요. (3분 이내 영상)`,
      },
      { status: 400 }
    );
  }

  // jobId 는 서버가 발급한다. 아직 jobs 행은 만들지 않는다(업로드 완료 후 생성).
  const jobId = body.jobId ?? randomUUID();
  const filename = body.kind === 'video'
    ? `video.${body.contentType === 'video/quicktime' ? 'mov' : 'mp4'}`
    : 'song';
  const path = `${user.id}/${jobId}/${filename}`;

  const supabase = await createClientServer();
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    return NextResponse.json(
      { error: 'INTERNAL', message: error?.message ?? '업로드 URL 발급에 실패했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ jobId, path: data.path, token: data.token });
}
