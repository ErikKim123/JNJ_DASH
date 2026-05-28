// POST /api/admin/contests/[contestId]/judge-photo-upload
//
// 심사위원 사진을 Supabase Storage 의 `participant-photos` 버킷에 업로드한다.
// 참가자 사진과 같은 버킷을 재사용하되 경로 prefix 로 분리: `${contestId}/judges/...`
//
// multipart/form-data:
//   - file: 이미지 파일 (jpeg/png/webp/gif, ≤ 5MB)
//   - judgeId?: 지정 시 같은 (contest_id, display_order) 의 3 라운드 row 모두 photo_url 동기화 (mirror)
//
// 반환: { url, group? }  — url 은 public CDN URL, group 은 mirror 결과 row.
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

  const judgeIdRaw = form.get('judgeId');
  const judgeId =
    typeof judgeIdRaw === 'string' && judgeIdRaw.trim() ? judgeIdRaw.trim() : null;

  const sb = getSupabaseAdmin();
  try {
    await ensureBucket(sb);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'BUCKET_ERR' }, { status: 500 });
  }

  // 경로: contestId/judges/{displayOrder|_pending}-{ts}-{rand}.ext
  // judgeId 가 있으면 display_order 를 조회해서 안정적 prefix 생성.
  let prefix = '_pending';
  let displayOrder: number | null = null;
  if (judgeId) {
    const { data: jrow, error: je } = await sb
      .from('judges')
      .select('display_order')
      .eq('id', judgeId)
      .eq('contest_id', contestId)
      .maybeSingle();
    if (je) {
      return NextResponse.json({ error: je.message }, { status: 500 });
    }
    if (!jrow) {
      return NextResponse.json({ error: 'JUDGE_NOT_FOUND' }, { status: 404 });
    }
    displayOrder = jrow.display_order;
    prefix = String(jrow.display_order);
  }

  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const ext = extFromMime(file.type);
  const path = `${contestId}/judges/${prefix}-${ts}-${rand}.${ext}`;

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

  if (!judgeId || displayOrder == null) {
    return NextResponse.json({ url });
  }

  // mirror: 같은 (contest_id, display_order) 의 3 라운드 row 모두 photo_url 동기화
  const { data: group, error: uErr } = await sb
    .from('judges')
    .update({ photo_url: url })
    .eq('contest_id', contestId)
    .eq('display_order', displayOrder)
    .select('*');
  if (uErr) {
    return NextResponse.json({ error: `db update failed: ${uErr.message}`, url }, { status: 500 });
  }
  return NextResponse.json({ url, group });
}
