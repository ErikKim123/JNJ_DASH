// POST /api/admin/contests/[contestId]/sponsor-upload
//
// PREP 화면 하단 광고/스폰서 로고를 Supabase Storage 의 `contest-sponsors` 버킷에 업로드.
// multipart/form-data:
//   - file: 이미지 파일 (jpeg/png/webp/gif/svg, ≤ 3MB)
//   - slot: 0~5 (선택). 지정 시 contests.sponsor_logos[slot] 자동 갱신.
//
// 반환: { url, data? } — url 은 public CDN URL.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 3 * 1024 * 1024; // 3MB
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
]);
const BUCKET = 'contest-sponsors';
const MAX_SLOTS = 6;

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
  if (mime === 'image/svg+xml') return 'svg';
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

  const slotRaw = form.get('slot');
  let slot: number | null = null;
  if (typeof slotRaw === 'string' && slotRaw.trim() !== '') {
    const n = Number(slotRaw);
    if (!Number.isInteger(n) || n < 0 || n >= MAX_SLOTS) {
      return NextResponse.json({ error: 'BAD_SLOT' }, { status: 400 });
    }
    slot = n;
  }

  const sb = getSupabaseAdmin();
  try {
    await ensureBucket(sb);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'BUCKET_ERR' }, { status: 500 });
  }

  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const ext = extFromMime(file.type);
  const path = slot !== null
    ? `${contestId}/slot-${slot}-${ts}.${ext}`
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

  if (slot === null) {
    return NextResponse.json({ url });
  }

  // slot 지정 시 contests.sponsor_logos 배열의 해당 인덱스를 갱신 (없으면 길이만큼 채워서 push).
  const { data: cur, error: getErr } = await sb
    .from('contests')
    .select('sponsor_logos')
    .eq('id', contestId)
    .maybeSingle();
  if (getErr) {
    return NextResponse.json({ error: `db read failed: ${getErr.message}`, url }, { status: 500 });
  }
  if (!cur) {
    return NextResponse.json({ error: 'CONTEST_NOT_FOUND', url }, { status: 404 });
  }
  const next: string[] = Array.isArray(cur.sponsor_logos) ? [...cur.sponsor_logos] : [];
  while (next.length <= slot) next.push('');
  next[slot] = url;
  const { data: updated, error: pErr } = await sb
    .from('contests')
    .update({ sponsor_logos: next })
    .eq('id', contestId)
    .select('*')
    .maybeSingle();
  if (pErr) {
    return NextResponse.json({ error: `db update failed: ${pErr.message}`, url }, { status: 500 });
  }
  return NextResponse.json({ url, data: updated });
}
