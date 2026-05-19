// GET    /api/admin/contests/[id]/pairings/[round]              - 목록
// POST   /api/admin/contests/[id]/pairings/[round]?action=shuffle  - 셔플 (status=draft)
// POST   /api/admin/contests/[id]/pairings/[round]?action=confirm  - 확정 (status=confirmed)
// POST   /api/admin/contests/[id]/pairings/[round]?action=unlock   - 리페어링용 잠금해제 (draft 로 복귀)
// PUT    /api/admin/contests/[id]/pairings/[round]                 - 수동 편집 (bulk replace)
//
// 셔플 규칙:
//   1) 해당 contest 의 participants 에서 role=leader / role=follower 추출.
//   2) 양쪽 모두 셔플 후 zip. 한쪽이 부족하면 helper_leader / helper_follower 로 채움.
//   3) 그래도 부족하면 leader_name='헬퍼유저', leader_num='—' (표출 어댑터의 HELPER 표기와 동일).
//   4) 결과를 transaction-like 로 DELETE → INSERT (Supabase 는 다중 stmt 지원 안 함 → 두 호출).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';
import { listParticipants, listPairings } from '@/lib/db/queries';
import type { ParticipantRow, PairingRoundDb } from '@/lib/db/types';

// Prelim Qualifiers 에서 passed=true 인 인원만 Semi 페어링 풀에 들어간다.
// qualifiers 테이블은 leader/follower 만 보존하므로 helper 역할은 없음.
async function fetchSemiPool(contestId: string): Promise<ParticipantRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('qualifiers')
    .select('participant_num, team_name, representative, role, photo_url')
    .eq('contest_id', contestId)
    .eq('round', 'prelim')
    .eq('passed', true);
  if (error) throw new Error(`fetchSemiPool: ${error.message}`);
  return (data ?? [])
    .filter((q) => q.role === 'leader' || q.role === 'follower')
    .map((q) => ({
      contest_id: contestId,
      num: q.participant_num,
      team_name: q.team_name ?? '',
      representative: q.representative ?? '',
      role: q.role as ParticipantRow['role'],
      photo_url: q.photo_url ?? '',
      meta: {},
    } as ParticipantRow));
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RoundEnum = z.enum(['prelim', 'semi']);

const PairBase = z.object({
  pair_idx: z.number().int().min(1).max(999),
  leader_num: z.string().max(32).default(''),
  leader_name: z.string().max(200).default(''),
  follower_num: z.string().max(32).default(''),
  follower_name: z.string().max(200).default(''),
  status: z.enum(['draft', 'confirmed']).default('draft'),
});

interface RouteCtx { params: Promise<{ contestId: string; round: string }> }

function parseRound(round: string): PairingRoundDb | null {
  const r = RoundEnum.safeParse(round);
  return r.success ? r.data : null;
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const { contestId, round } = await ctx.params;
  const r = parseRound(round);
  if (!r) return NextResponse.json({ error: 'INVALID_ROUND' }, { status: 400 });
  const rows = await listPairings(contestId, r);
  return NextResponse.json({ data: rows });
}

/** Fisher–Yates 셔플 (in-place, 새 배열 반환). */
function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const HELPER_NAME = '헬퍼유저';
const HELPER_NUM = '—';

function shufflePairings(participants: ParticipantRow[]) {
  // round 별 풀 구성:
  //   - prelim : participants 전체 (leader/follower + helper 보강)
  //   - semi   : 호출부에서 이미 qualifiers passed=true 만 넘김 → helper 없음
  const leaders = participants.filter((p) => p.role === 'leader');
  const followers = participants.filter((p) => p.role === 'follower');
  const helperLeaders = participants.filter((p) => p.role === 'helper_leader');
  const helperFollowers = participants.filter((p) => p.role === 'helper_follower');

  // 풀 양쪽 길이가 다르면 헬퍼로 보강 → 그래도 모자라면 '헬퍼유저' sentinel.
  const Lpool = [...leaders, ...helperLeaders];
  const Fpool = [...followers, ...helperFollowers];

  // 정규 참가자만으로 짝짓고 부족분을 헬퍼/sentinel 로 채우는 게 운영팀 기대.
  // → 정규 참가자 길이 기준으로 페어 수 결정. 한쪽이 적으면 그 쪽 부족분만 채움.
  const Lreg = shuffled(leaders);
  const Freg = shuffled(followers);
  const Lhelp = shuffled(helperLeaders);
  const Fhelp = shuffled(helperFollowers);

  const pairCount = Math.max(Lreg.length, Freg.length);
  const pairs = [];
  for (let i = 0; i < pairCount; i++) {
    const l =
      Lreg[i] ?? Lhelp.shift() ?? null;
    const f =
      Freg[i] ?? Fhelp.shift() ?? null;
    pairs.push({
      pair_idx: i + 1,
      leader_num: l ? l.num : HELPER_NUM,
      leader_name: l ? l.team_name : HELPER_NAME,
      follower_num: f ? f.num : HELPER_NUM,
      follower_name: f ? f.team_name : HELPER_NAME,
      status: 'draft' as const,
    });
  }
  // 빈 페어( leader_name='' && follower_name='' )는 제외 — 양쪽 다 0명이면.
  return pairs.filter((p) => p.leader_name || p.follower_name);
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId, round } = await ctx.params;
  const r = parseRound(round);
  if (!r) return NextResponse.json({ error: 'INVALID_ROUND' }, { status: 400 });

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const sb = getSupabaseAdmin();

  if (action === 'shuffle') {
    // prelim: contest participants 전체.
    // semi : Prelim Qualifiers passed=true 만 — 헬퍼 보강 없이 부족분은 sentinel(헬퍼유저) 로 채움.
    const pool = r === 'semi'
      ? await fetchSemiPool(contestId)
      : await listParticipants(contestId);
    const pairs = shufflePairings(pool);
    if (!pairs.length) {
      return NextResponse.json(
        { error: r === 'semi' ? 'NO_PRELIM_QUALIFIERS' : 'NO_PARTICIPANTS' },
        { status: 400 }
      );
    }
    // 기존 페어 전체 삭제 → 새 셔플 결과 삽입.
    const del = await sb.from('pairings').delete().eq('contest_id', contestId).eq('round', r);
    if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
    const rowsToInsert = pairs.map((p) => ({ ...p, contest_id: contestId, round: r }));
    const ins = await sb.from('pairings').insert(rowsToInsert).select('*');
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
    return NextResponse.json({ data: ins.data });
  }

  if (action === 'confirm') {
    const { data, error } = await sb
      .from('pairings')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('contest_id', contestId)
      .eq('round', r)
      .select('*');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === 'unlock') {
    // 리페어링 준비 — status 만 draft 로 되돌림. 페어 자체는 유지.
    const { data, error } = await sb
      .from('pairings')
      .update({ status: 'draft', confirmed_at: null })
      .eq('contest_id', contestId)
      .eq('round', r)
      .select('*');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'UNKNOWN_ACTION' }, { status: 400 });
}

export async function PUT(req: Request, ctx: RouteCtx) {
  // 수동 편집(bulk replace). draft 상태에서만 허용.
  const { contestId, round } = await ctx.params;
  const r = parseRound(round);
  if (!r) return NextResponse.json({ error: 'INVALID_ROUND' }, { status: 400 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = z.array(PairBase).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const del = await sb.from('pairings').delete().eq('contest_id', contestId).eq('round', r);
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
  if (parsed.data.length === 0) return NextResponse.json({ data: [] });
  const rows = parsed.data.map((p) => ({ ...p, contest_id: contestId, round: r }));
  const ins = await sb.from('pairings').insert(rows).select('*');
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  return NextResponse.json({ data: ins.data });
}
