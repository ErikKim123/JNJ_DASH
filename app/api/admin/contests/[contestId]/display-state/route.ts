// PUT /api/admin/contests/[contestId]/display-state   { round?, step?, follow?, cmd? }
//   MC 모바일이 표출 포인터(현재 라운드/스텝), "MC 따라가기" 원격 스위치,
//   그리고 1회성 원격 명령(조회/영상 재생)을 기록.
//   미들웨어(admin 세션)로 보호됨.
//   프로젝터(대시보드)는 공개 GET /api/contests/[id]/display-state 로 이 값을 폴링한다.
//   - round/step 은 함께 보낸다(둘 다 있거나 둘 다 없거나).
//   - follow 만 보내면 포인터는 그대로 두고 따라가기 스위치만 토글한다.
//   - cmd 만 보내면 포인터/스위치는 그대로 두고 명령만 발행한다.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { ROUND_KEYS, STEP_KEYS } from '@/lib/sheets/types';
import { DISPLAY_COMMANDS } from '@/lib/display/commands';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z
  .object({
    round: z.enum(ROUND_KEYS as unknown as [string, ...string[]]).optional(),
    step: z.enum(STEP_KEYS as unknown as [string, ...string[]]).optional(),
    follow: z.boolean().optional(),
    cmd: z.enum(DISPLAY_COMMANDS as unknown as [string, ...string[]]).optional(),
  })
  .refine((b) => (b.round === undefined) === (b.step === undefined), {
    message: 'round 와 step 은 함께 보내야 합니다',
  })
  .refine((b) => b.round !== undefined || b.follow !== undefined || b.cmd !== undefined, {
    message: '변경할 값이 없습니다',
  });

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function PUT(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  if (parsed.data.round !== undefined) {
    patch.display_round = parsed.data.round;
    patch.display_step = parsed.data.step;
    patch.display_updated_at = now;
  }
  if (parsed.data.follow !== undefined) {
    patch.display_follow = parsed.data.follow;
    // 같은 값을 다시 눌러도 시각이 갱신되어 프로젝터가 재적용한다.
    patch.display_follow_at = now;
  }
  if (parsed.data.cmd !== undefined) {
    patch.display_cmd = parsed.data.cmd;
    // 같은 명령을 연달아 눌러도 시각이 갱신되어 프로젝터가 매번 다시 실행한다.
    patch.display_cmd_at = now;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('contests')
    .update(patch)
    .eq('id', contestId)
    .select('display_round, display_step, display_updated_at, display_follow, display_follow_at, display_cmd, display_cmd_at')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({
    data: {
      round: data.display_round,
      step: data.display_step,
      updatedAt: data.display_updated_at,
      follow: data.display_follow,
      followAt: data.display_follow_at,
      cmd: data.display_cmd,
      cmdAt: data.display_cmd_at,
    },
  });
}
