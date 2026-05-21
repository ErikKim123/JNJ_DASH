// POST /api/admin/contests/[contestId]/photo-upload
//
// 참가자 사진을 Supabase Storage 의 `participant-photos` 버킷에 업로드한다.
// multipart/form-data:
//   - file: 이미지 파일 (jpeg/png/webp/gif, ≤ 5MB)
//   - participantId?: 지정 시 업로드 후 participants.photo_url 를 자동 PATCH
//
// 반환: { url, data? }  — url 은 public CDN URL.
//
// 신규 참가자(아직 participantId 가 없는 경우)는 participantId 를 생략하고
// 반환된 url 을 클라이언트에서 newDraft.photo_url 에 채우는 흐름으로 사용.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const BUCKET = 'participant-photos';

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
    // 동시 요청으로 이미 만들어졌으면 무시
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
  if (mime === 'image/gif') return 'gif';
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

  const participantIdRaw = form.get('participantId');
  const participantId = typeof participantIdRaw === 'string' && participantIdRaw.trim()
    ? participantIdRaw.trim()
    : null;

  const sb = getSupabaseAdmin();
  try {
    await ensureBucket(sb);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'BUCKET_ERR' }, { status: 500 });
  }

  // 파일명: contestId/participantId-timestamp.ext (또는 _pending/timestamp-rand.ext)
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const ext = extFromMime(file.type);
  const path = participantId
    ? `${contestId}/${participantId}-${ts}.${ext}`
    : `${contestId}/_pending/${ts}-${rand}.${ext}`;

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

  if (!participantId) {
    return NextResponse.json({ url });
  }

  // 기존 참가자면 photo_url 동기화
  const { data: updated, error: pErr } = await sb
    .from('participants')
    .update({ photo_url: url })
    .eq('id', participantId)
    .eq('contest_id', contestId)
    .select('*')
    .maybeSingle();
  if (pErr) {
    return NextResponse.json({ error: `db update failed: ${pErr.message}`, url }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: 'PARTICIPANT_NOT_FOUND', url }, { status: 404 });
  }
  return NextResponse.json({ url, data: updated });
}
