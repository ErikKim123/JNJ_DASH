// POST /api/ovote/[contestId]/login
//   온라인 심사위원 로그인 — 등록 번호(또는 이메일) + 4자리 PIN 검증.
//   성공 시 { judgeId, name, displayOrder } 반환(클라이언트가 세션 보관).
// 공개 엔드포인트(미들웨어 대상 아님). VOTE 앱처럼 별도 세션 쿠키 없이 클라 저장.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { fullName } from '@/lib/participants/name';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  identifier: z.string().min(1).max(320), // 등록 번호(display_order) 또는 이메일
  pin: z.string().regex(/^\d{4}$/),
});

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === 'pin')) {
      return NextResponse.json({ error: 'PIN_INVALID' }, { status: 400 });
    }
    return NextResponse.json({ error: 'VALIDATION' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const id = parsed.data.identifier.trim();
  const asNumber = /^\d+$/.test(id) ? Number(id) : null;

  let query = sb
    .from('online_judges')
    .select('id, display_order, first_name, last_name, name, email, pin')
    .eq('contest_id', contestId);
  query = asNumber != null ? query.eq('display_order', asNumber) : query.ilike('email', id);

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // 존재하지 않거나 PIN 불일치 — 동일 메시지(계정 존재 여부 노출 방지).
  if (!data || data.pin !== parsed.data.pin) {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  }

  const name = fullName(data.first_name, data.last_name) || data.name || data.email || `#${data.display_order}`;
  return NextResponse.json({
    data: { judgeId: data.id, name, displayOrder: data.display_order },
  });
}
