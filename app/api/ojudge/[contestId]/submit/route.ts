// POST /api/ojudge/[contestId]/submit
//
// 공개 관객 심사위원 셀프 등록 엔드포인트. /admin 미들웨어 대상이 아니라 누구나 호출.
//
// 0037 이후 동작:
//   · 사람은 audience_judges(통합 계정) 에 한 번만 만들어진다 — 이메일 1개 = 계정 1개.
//   · 등록하면 같은 group_name(같은 페스티벌)의 열린 대회 전체에 참여 행이 함께 생긴다.
//     → 대회마다 사진·이름·PIN 을 다시 입력할 필요가 없다.
//   · 이미 계정이 있으면 PIN 이 열쇠다. 맞으면 프로필을 갱신하고 참여만 붙이고,
//     틀리면 ACCOUNT_EXISTS 로 돌려보낸다(남의 이메일로 계정을 덮어쓰지 못하게).
//
// 안전 정책(참가자 join 과 동일 패턴):
//   - Zod strict validate + 필드 길이 제한.
//   - display_order 는 서버가 계산(클라이언트 값 불신, 동시성 충돌 방지).
//   - PIN 은 정확히 4자리 숫자만.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { getContest } from '@/lib/db/queries';
import { normalizeNameFields } from '@/lib/participants/name';
import { enrollInGroup, findAccount, phoneKey } from '@/lib/audience/account';
import type { AudienceJudgeRow, OnlineJudgeRow } from '@/lib/db/types';

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
  if (phoneKey(phone).length < 5) {
    return NextResponse.json({ error: 'PHONE_REQUIRED' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const name = normalizeNameFields(parsed.data);
  const pin = parsed.data.pin;

  let account: AudienceJudgeRow | null;
  try {
    account = await findAccount(sb, { email, phone });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'DB_ERR' }, { status: 500 });
  }

  const profile = {
    first_name: name.first_name,
    last_name: name.last_name,
    name: name.team_name,
    representative: parsed.data.representative.trim(),
    email,
    phone,
    photo_url: parsed.data.photo_url,
  };

  let linked = false;
  if (account) {
    // 이미 있는 계정 — PIN 이 본인 확인 수단이다.
    if (account.pin !== pin) {
      return NextResponse.json(
        { error: 'ACCOUNT_EXISTS', judge_no: account.judge_no },
        { status: 409 }
      );
    }
    linked = true;
    // 사진을 새로 안 올렸으면 기존 사진을 지우지 않는다.
    const patch = { ...profile, photo_url: profile.photo_url || account.photo_url };
    const { data, error } = await sb
      .from('audience_judges')
      .update(patch)
      .eq('id', account.id)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    account = data as AudienceJudgeRow;
  } else {
    const { data, error } = await sb
      .from('audience_judges')
      .insert({ ...profile, pin })
      .select('*')
      .single();
    if (error) {
      // 동시에 같은 이메일로 들어온 요청이 먼저 만든 경우 — 그 계정으로 이어간다.
      if (error.code === '23505') {
        const raced = await findAccount(sb, { email }).catch(() => null);
        if (!raced) return NextResponse.json({ error: error.message }, { status: 500 });
        if (raced.pin !== pin) {
          return NextResponse.json({ error: 'ACCOUNT_EXISTS', judge_no: raced.judge_no }, { status: 409 });
        }
        account = raced;
        linked = true;
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      account = data as AudienceJudgeRow;
    }
  }

  if (!account) return NextResponse.json({ error: 'ACCOUNT_FAILED' }, { status: 500 });

  // 같은 페스티벌의 열린 대회 전체에 일괄 참여.
  let primary: OnlineJudgeRow | null = null;
  let enrolledContestIds: string[] = [];
  try {
    ({ primary, enrolledContestIds } = await enrollInGroup(sb, contest, account));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'DB_ERR' }, { status: 500 });
  }
  if (!primary) return NextResponse.json({ error: 'ENROLL_FAILED' }, { status: 500 });

  return NextResponse.json(
    {
      data: {
        ...primary,
        judge_no: account.judge_no,
        // 이 사람이 지금 등록으로 참여하게 된 대회 전체(지금 대회 포함).
        enrolled_contest_ids: enrolledContestIds,
        // 기존 계정에 이어 붙인 등록인지 — 완료 화면 문구가 달라진다.
        linked,
      },
    },
    { status: linked ? 200 : 201 }
  );
}
