// GET /api/admin/contests/[contestId]/participants/export-xlsx
//   참가자 명단을 .xlsx 로 내보낸다 — 모든 정보 + 사진을 셀 이미지로 임베드.
//   사진은 외부 호스트(Google Drive/Supabase 등)라 브라우저 CORS 를 피하려고 서버에서 fetch.
//   엑셀 생성은 SheetJS(이미지 미지원) 대신 exceljs 사용.
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { listParticipants } from '@/lib/db/queries';
import { classifyMetaKey, circledOrdinal, type MetaCategory } from '@/components/admin/participant-meta';
import { resolvePhotoUrl } from '@/lib/photo';
import type { ParticipantRole } from '@/lib/db/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROLE_LABEL: Record<ParticipantRole, string> = {
  leader: 'Leader',
  follower: 'Follower',
  helper_leader: 'Helper (Leader)',
  helper_follower: 'Helper (Follower)',
};

const CAT_RANK: Record<MetaCategory, number> = {
  profile: 0, prelim_vote: 1, final_score: 2, score_agg: 3, pass_flag: 4, rank: 5, other: 6,
};
const PROFILE_ORDER = ['부문', '장르', 'Division', '연락처', '이메일', 'Nationality', '접수일', '사진원본', 'X'];

function metaKeyCompare(a: string, b: string): number {
  const ca = classifyMetaKey(a), cb = classifyMetaKey(b);
  if (CAT_RANK[ca] !== CAT_RANK[cb]) return CAT_RANK[ca] - CAT_RANK[cb];
  if (ca === 'profile') {
    const ai = PROFILE_ORDER.indexOf(a), bi = PROFILE_ORDER.indexOf(b);
    if (ai >= 0 || bi >= 0) { if (ai < 0) return 1; if (bi < 0) return -1; return ai - bi; }
  }
  if (ca === 'prelim_vote' || ca === 'final_score') {
    const d = circledOrdinal(a) - circledOrdinal(b);
    if (d !== 0) return d;
  }
  return a.localeCompare(b);
}

const cellOf = (v: unknown): string =>
  v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);

type ImgExt = 'jpeg' | 'png' | 'gif';

// 사진 한 장을 서버에서 받아 buffer + 확장자 반환. 실패/초과 시 null (이미지 생략).
async function fetchImage(rawUrl: string): Promise<{ buffer: Buffer; ext: ImgExt } | null> {
  if (!rawUrl) return null;
  // Google lh3 CDN 은 썸네일 파라미터로 용량을 줄인다 (원본은 수 MB 가능).
  const url = rawUrl.includes('lh3.googleusercontent.com') ? `${rawUrl}=w240` : rawUrl;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength === 0 || ab.byteLength > 5 * 1024 * 1024) return null;
    const buf = Buffer.from(ab);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    let ext: ImgExt = 'jpeg';
    if (ct.includes('png') || (buf[0] === 0x89 && buf[1] === 0x50)) ext = 'png';
    else if (ct.includes('gif') || (buf[0] === 0x47 && buf[1] === 0x49)) ext = 'gif';
    else if (ct.includes('webp')) return null; // exceljs 는 webp 미지원 → 생략
    return { buffer: buf, ext };
  } catch {
    return null;
  }
}

// 동시성 제한 매핑.
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;

  let rows;
  try {
    rows = await listParticipants(contestId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'DB_ERR' }, { status: 500 });
  }
  rows = [...rows].sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true }));

  // 전체 meta 키 합집합 → 카테고리 순 정렬.
  const metaKeySet = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r.meta ?? {})) metaKeySet.add(k);
  const metaKeys = [...metaKeySet].sort(metaKeyCompare);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Participants');
  const header = ['#', 'PHOTO', 'FIRST NAME', 'LAST NAME', 'ROLE', 'COUNTRY', ...metaKeys, 'CREATED_AT'];
  ws.columns = header.map((h, i) => ({
    header: h,
    width: i === 0 ? 7 : i === 1 ? 14 : i === 2 ? 28 : i === 3 ? 16 : i === 4 ? 16 : i === header.length - 1 ? 22 : 18,
  }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const r of rows) {
    const meta = (r.meta ?? {}) as Record<string, unknown>;
    const row = [
      r.num,
      '', // PHOTO — 이미지로 덮음
      r.first_name ?? r.team_name ?? '',
      r.last_name ?? '',
      ROLE_LABEL[r.role] ?? r.role,
      r.representative,
      ...metaKeys.map((k) => cellOf(meta[k])),
      r.created_at ?? '',
    ];
    const added = ws.addRow(row);
    added.height = 48; // 사진(약 56px)이 들어갈 행 높이
  }

  // 사진을 서버에서 병렬로 받아 PHOTO 셀에 임베드.
  const images = await mapLimit(rows, 8, (r) => fetchImage(resolvePhotoUrl(r)));
  images.forEach((img, idx) => {
    if (!img) return;
    const imageId = wb.addImage({ buffer: img.buffer as unknown as ExcelJS.Buffer, extension: img.ext });
    // PHOTO 는 2번째 열(0-based col=1), 데이터 행은 워크시트 2행부터(0-based row=idx+1).
    ws.addImage(imageId, {
      tl: { col: 1.12, row: idx + 1 + 0.12 } as ExcelJS.Anchor,
      ext: { width: 56, height: 56 },
      editAs: 'oneCell',
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(contestId)}-participants.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
