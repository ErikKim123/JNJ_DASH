// POST /api/admin/contests/[contestId]/video-upload-url
//
// 심사위원 소개 영상을 Supabase Storage(`judge-videos` 버킷)에 "브라우저에서 직접"
// 올리기 위한 서명된 업로드 URL/토큰을 발급한다.
//
// 왜 직접 업로드인가: Vercel 서버리스 함수는 요청 본문이 ~4.5MB 로 제한되어 큰 영상을
// 우리 API 라우트로 통과시킬 수 없다. 그래서 서버는 (service_role 로) 업로드용 서명
// 토큰만 발급하고, 실제 파일 바이트는 브라우저가 Supabase 로 직접 PUT 한다.
//
// body(JSON): { filename: string }   — 확장자 추출용
// 반환: { bucket, path, token, publicUrl }
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'judge-videos';
// 버킷 자체 한도(넉넉히). 단, 실제 업로드 최대 크기는 Supabase 프로젝트 전역
// 파일 크기 한도(대시보드 Settings → Storage)에도 종속된다.
const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const ALLOWED_MIME = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'video/x-matroska',
  'video/ogg',
];
const ALLOWED_EXT = new Set(['mp4', 'webm', 'mov', 'm4v', 'mkv', 'ogg', 'ogv']);

let bucketEnsured = false;

async function ensureBucket(sb: ReturnType<typeof getSupabaseAdmin>): Promise<void> {
  if (bucketEnsured) return;
  const { data: buckets, error } = await sb.storage.listBuckets();
  if (error) throw new Error(`listBuckets failed: ${error.message}`);
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error: createErr } = await sb.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ALLOWED_MIME,
    });
    if (createErr && !/already exists/i.test(createErr.message)) {
      throw new Error(`createBucket failed: ${createErr.message}`);
    }
  }
  bucketEnsured = true;
}

interface RouteCtx {
  params: Promise<{ contestId: string }>;
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;

  let body: { filename?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const filename = typeof body.filename === 'string' ? body.filename : 'video.mp4';
  const m = /\.([a-z0-9]+)$/i.exec(filename.trim());
  const ext = (m ? m[1] : 'mp4').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: 'BAD_TYPE', allowed: [...ALLOWED_EXT] },
      { status: 415 },
    );
  }

  const sb = getSupabaseAdmin();
  try {
    await ensureBucket(sb);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'BUCKET_ERR' },
      { status: 500 },
    );
  }

  const path = `${contestId}/judges-${Date.now()}.${ext}`;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json(
      { error: `sign failed: ${error?.message ?? 'unknown'}` },
      { status: 500 },
    );
  }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({
    bucket: BUCKET,
    path: data.path,
    token: data.token,
    publicUrl: pub.publicUrl,
  });
}
