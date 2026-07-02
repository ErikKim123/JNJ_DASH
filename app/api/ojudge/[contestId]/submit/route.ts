// POST /api/ojudge/[contestId]/submit
//
// 공개 온라인 심사위원 셀프 등록 엔드포인트. /admin 미들웨어 대상이 아니라 누구나 호출.
//
// 안전 정책(참가자 join 과 동일 패턴):
//   - Zod strict validate + 필드 길이 제한.
//   - display_order 는 서버가 계산(클라이언트 값 불신, 동시성 충돌 방지).
//   - PIN 은 정확히 4자리 숫자만.
//   - 이메일/연락처 중복은 저장 거부(409 DUPLICATE).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { getContest } from '@/lib/db/queries';
import { normalizeNameFields } from '@/lib/participants/name';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SubmitSchema = z.object({
  first_name: z.string().min(1).max(200),
  last_name: z.string().min(1).max(200),
  representative: z.string().min(1).max(200),
  email: z.string().min(1).max(320),
  phone: z.string().max(64).default(''),
  photo_url: z.string().max(2048).default(''),
  pin: z.string().regex(/^\d{4}$/),
});

interface RouteCtx { params: Promise<{ contestId: string }> }

// 전화번호 비교용 정규화 — 숫자만.
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;

  let contest;
  try {
    contest = await getContest(contestId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'DB_ERR' }, { status: 500 });
  }
  if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });
  // 종료/보관 대회는 등록 불가.
  if (contest.status === 'archived' || contest.status === 'done') {
    return NextResponse.json({ error: 'CONTEST_CLOSED', status: contest.status }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    // PIN 형식 오류는 전용 코드로 구분.
    if (parsed.error.issues.some((i) => i.path[0] === 'pin')) {
      return NextResponse.json({ error: 'PIN_INVALID' }, { status: 400 });
    }
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }

  const email = parsed.data.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'EMAIL_INVALID' }, { status: 400 });
  }
  const phone = parsed.data.phone.trim();
  if (normalizePhone(phone).length < 5) {
    return NextResponse.json({ error: 'PHONE_REQUIRED' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // 중복 등록 차단 — 같은 대회에 이메일/연락처가 이미 있으면 거부.
  const { data: existing, error: exErr } = await sb
    .from('online_judges')
    .select('id, email, phone')
    .eq('contest_id', contestId);
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
  const emailKey = email.toLowerCase();
  const phoneKey = normalizePhone(phone);
  const dup = (existing ?? []).some((r) => {
    const e = (r.email ?? '').trim().toLowerCase();
    const p = normalizePhone(r.phone ?? '');
    return (e !== '' && e === emailKey) || (p !== '' && p === phoneKey);
  });
  if (dup) return NextResponse.json({ error: 'DUPLICATE' }, { status: 409 });

  const name = normalizeNameFields(parsed.data);

  // 다음 display_order — 대회 내 max + 1. 동시성 충돌 시 1회 재시도.
  async function nextOrder(): Promise<number> {
    const { data: maxRow } = await sb
      .from('online_judges')
      .select('display_order')
      .eq('contest_id', contestId)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (maxRow?.display_order ?? 0) + 1;
  }

  const insertRow = (displayOrder: number) => ({
    contest_id: contestId,
    display_order: displayOrder,
    first_name: name.first_name,
    last_name: name.last_name,
    name: name.team_name,
    representative: parsed.data.representative.trim(),
    email,
    phone,
    photo_url: parsed.data.photo_url,
    pin: parsed.data.pin,
  });

  let displayOrder = await nextOrder();
  let { data, error } = await sb.from('online_judges').insert(insertRow(displayOrder)).select('*').single();
  if (error && error.code === '23505') {
    // display_order 충돌 — 다시 계산 후 1회 재시도.
    displayOrder = await nextOrder();
    ({ data, error } = await sb.from('online_judges').insert(insertRow(displayOrder)).select('*').single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}
