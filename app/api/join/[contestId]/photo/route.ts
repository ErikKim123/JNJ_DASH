// POST /api/join/[contestId]/photo
//
// 공개 사진 업로드 — 참가자 셀프 등록 시 사용. multipart/form-data 의 file 필드.
// 반환: { url } — Supabase Storage public CDN URL.
//
// /api/admin/contests/[id]/photo-upload 와 본질적으로 동일하지만:
//   - 미들웨어 통과 (admin 인증 불필요)
//   - participantId 받지 않음 (제출 시점에는 아직 row 가 없음)
//   - 동일 버킷 `participant-photos` 의 _pending/ 하위 경로에 저장
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/client';
import { getContest } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const BUCKET = 'participant-photos';

let bucketEnsured = false;
async function ensureBucket(sb: ReturnType<typeof getSupabaseAdmin>): Promise<void> {
  if (bucketEnsured) return;
  const { data: buckets, error } = await sb.storage.listBuckets();
  if (error) throw new Error(`listBuckets: ${error.message}`);
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error: createErr } = await sb.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: [...ALLOWED_MIME],
    });
    if (createErr && !/already exists/i.test(createErr.message)) {
      throw new Error(`createBucket: ${createErr.message}`);
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

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;

  // 존재 + 접수 가능 검증 — 잘못된 contestId 로 스토리지 공간 채우는 것 방지.
  const contest = await getContest(contestId).catch(() => null);
  if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });
  if (contest.status === 'archived' || contest.status === 'done') {
    return NextResponse.json({ error: 'CONTEST_CLOSED' }, { status: 403 });
  }

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'INVALID_FORM' }, { status: 400 }); }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'NO_FILE' }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: 'EMPTY_FILE' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'TOO_LARGE', limit: MAX_BYTES }, { status: 413 });
  if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: 'BAD_TYPE', allowed: [...ALLOWED_MIME] }, { status: 415 });

  const sb = getSupabaseAdmin();
  try { await ensureBucket(sb); } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'BUCKET_ERR' }, { status: 500 });
  }

  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const ext = extFromMime(file.type);
  const path = `${contestId}/_pending/${ts}-${rand}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type,
    upsert: true,
    cacheControl: '3600',
  });
  if (upErr) return NextResponse.json({ error: `upload: ${upErr.message}` }, { status: 500 });

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl });
}
