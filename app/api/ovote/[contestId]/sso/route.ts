// POST /api/ovote/[contestId]/sso
//   WOLF 회원 바로 입장 — 등록 폼도 PIN 도 없이 채점 화면으로.
//
//   WOLF(worldoflatinfestivals.com) 의 J&J 페이지에서 '심사하러 가기' 를 누르면 WOLF 가
//   회원 정보를 서명한 토큰을 만들어 /ovote/{대회}?t=… 로 보낸다. 그 토큰을 여기서 검증하고,
//   계정을 찾거나 만들고, 이 대회 참여를 붙인 뒤 /login 과 똑같은 모양으로 돌려준다.
//   → 화면은 로그인 성공과 완전히 같은 길을 탄다(세션 저장 → 라운드).
//
//   PIN 은 토큰에 없다. 링크가 새면 그 사람 이름으로 채점할 수 있게 되기 때문이다.
//   새 계정의 PIN 은 여기서 만든다 — 본인은 WOLF 버튼으로 들어오므로 쓸 일이 없지만,
//   PIN 이 빈 계정을 만들어 두면 나머지 코드가 기대하는 모양에서 벗어난다.
//
// 공개 엔드포인트(미들웨어 대상 아님) — 열쇠는 오직 서명이다.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { getContest } from '@/lib/db/queries';
import { fullName, normalizeNameFields } from '@/lib/participants/name';
import { ensureEnrollment, findAccount } from '@/lib/audience/account';
import { verifyJnjSsoToken } from '@/lib/audience/sso';
import type { AudienceJudgeRow } from '@/lib/db/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({ token: z.string().min(1).max(4096) });

interface RouteCtx { params: Promise<{ contestId: string }> }

/** 새 계정용 4자리 PIN. 본인에게 알려주지 않는다 — 들어오는 길이 WOLF 버튼이기 때문. */
function randomPin(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;

  const secret = process.env.JNJ_SSO_SECRET;
  // 비밀키가 없으면 검증할 방법이 없다. WOLF 는 이 경우 애초에 등록 폼으로 보내지만,
  // 한쪽만 키가 빠진 상태로 배포될 수 있으므로 여기서도 분명히 거절한다.
  if (!secret) return NextResponse.json({ error: 'SSO_DISABLED' }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION' }, { status: 400 });

  const result = verifyJnjSsoToken(parsed.data.token, secret, contestId);
  // 만료는 흔한 일이다(버튼 누르고 한참 뒤). 화면이 다시 누르라고 안내할 수 있게 구분해 준다.
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.reason === 'EXPIRED' ? 410 : 401 });
  }
  const p = result.payload;

  let contest;
  try {
    contest = await getContest(contestId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'DB_ERR' }, { status: 500 });
  }
  if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });
  if (contest.status === 'archived' || contest.status === 'done') {
    return NextResponse.json({ error: 'CONTEST_CLOSED', status: contest.status }, { status: 403 });
  }

  const sb = getSupabaseAdmin();
  const name = normalizeNameFields({ team_name: p.name });
  const profile = {
    first_name: name.first_name,
    last_name: name.last_name,
    name: name.team_name,
    representative: (p.country ?? '').trim(),
    email: p.email.trim(),
    phone: (p.phone ?? '').trim(),
    photo_url: (p.photoUrl ?? '').trim(),
  };

  let account: AudienceJudgeRow | null;
  try {
    // 이메일로만 찾는다. 연락처는 가족·커플이 공유하는 일이 있어, 그걸로 찾으면
    // 남의 계정에 붙을 수 있다 — 여기서는 WOLF 가 보증한 이메일이 유일한 열쇠다.
    account = await findAccount(sb, { email: profile.email });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'DB_ERR' }, { status: 500 });
  }

  try {
    if (account) {
      // 이미 있는 계정 — PIN 은 건드리지 않는다(직접 등록해 쓰던 PIN 을 뺏으면 안 된다).
      // 사진·연락처는 WOLF 에 비어 있을 수 있으므로 있을 때만 덮는다.
      const patch = {
        ...profile,
        phone: profile.phone || account.phone,
        photo_url: profile.photo_url || account.photo_url,
        representative: profile.representative || account.representative,
      };
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
        .insert({ ...profile, pin: randomPin() })
        .select('*')
        .single();
      if (error) {
        // 같은 이메일로 동시에 들어온 요청이 먼저 만든 경우 — 그 계정으로 이어간다.
        if (error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 });
        account = await findAccount(sb, { email: profile.email });
        if (!account) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        account = data as AudienceJudgeRow;
      }
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'DB_ERR' }, { status: 500 });
  }

  let row;
  try {
    row = await ensureEnrollment(sb, contest.id, account);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'DB_ERR' }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: 'ENROLL_FAILED' }, { status: 500 });

  // /login 과 같은 모양 — 화면이 로그인과 같은 코드로 세션을 세운다.
  const display = fullName(row.first_name, row.last_name) || row.name || row.email || `#${row.display_order}`;
  return NextResponse.json({
    data: { judgeId: row.id, name: display, displayOrder: row.display_order, judgeNo: account.judge_no },
  });
}
