// POST /api/admin/contests/[contestId]/background-upload
//
// 대회별 커스텀 배경 이미지를 Supabase Storage 의 `contest-backgrounds` 버킷에 업로드.
// multipart/form-data:
//   - file: 이미지 파일 (jpeg/png/webp, ≤ 8MB)
//
// 업로드 후 contests.background_image 를 자동 갱신.
// 반환: { url, data? }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BUCKET = 'contest-backgrounds';

let bucketEnsured = false;

async function ensureBucket(sb: ReturnType<typeof getSupabaseAdmin>): Promise<void> {
  if (bucketEnsured) return;
  const { data: buckets, error } = await sb.storage.listBuckets();
  if (error) throw new Error(`listBuckets failed: ${error.message}`);
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error: createErr } = await sb.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: [...ALLOWED_MIME],
    });
    if (createErr && !/already exists/i.test(createErr.message)) {
      throw new Error(`createBucket failed: ${createErr.message}`);
    }
  }
  bucketEnsured = true;
}

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'bin';
}

interface RouteCtx {
  params: Promise<{ contestId: string }>;
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'INVALID_FORM' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'NO_FILE' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'EMPTY_FILE' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'TOO_LARGE', limit: MAX_BYTES }, { status: 413 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'BAD_TYPE', allowed: [...ALLOWED_MIME] }, { status: 415 });
  }

  const sb = getSupabaseAdmin();
  try {
    await ensureBucket(sb);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'BUCKET_ERR' }, { status: 500 });
  }

  const ts = Date.now();
  const ext = extFromMime(file.type);
  const path = `${contestId}/bg-${ts}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type,
    upsert: true,
    cacheControl: '3600',
  });
  if (upErr) {
    return NextResponse.json({ error: `upload failed: ${upErr.message}` }, { status: 500 });
  }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  // contests.background_image 동기화
  const { data: updated, error: pErr } = await sb
    .from('contests')
    .update({ background_image: url })
    .eq('id', contestId)
    .select('*')
    .maybeSingle();
  if (pErr) {
    return NextResponse.json({ error: `db update failed: ${pErr.message}`, url }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: 'CONTEST_NOT_FOUND', url }, { status: 404 });
  }
  return NextResponse.json({ url, data: updated });
}
