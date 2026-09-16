// GET  /api/admin/contests/[contestId]/publish-wolf
//   게시 대화상자가 필요한 것 한 벌 — Wolf 에디션·부문 목록 + 이 대회의 시상대 미리보기.
//   editionId/division 을 쿼리로 주면 그 자리에 이미 들어 있는 행 수도 같이 센다.
//
// POST /api/admin/contests/[contestId]/publish-wolf
//   { editionId, division, replace, keys? } → Wolf jnj_winners 에 시상대를 넣는다.
//
// 넣을 항목은 요청 본문의 값이 아니라 여기서 DB 를 다시 읽어 만든다(keys 는 '어느 줄을
// 넣을지' 고르는 데만 쓴다). 화면이 보낸 점수를 그대로 믿으면 미리보기를 띄워 둔 사이
// 결과가 바뀌었을 때 옛 점수가 고객몰로 넘어간다.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getContest } from '@/lib/db/queries';
import {
  buildPodiumEntries,
  countExistingWinners,
  listWolfDivisions,
  listWolfEditions,
  publishWinnersToWolf,
} from '@/lib/wolf/winners';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteCtx { params: Promise<{ contestId: string }> }

export async function GET(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  const contest = await getContest(contestId);
  if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });

  const url = new URL(req.url);
  const editionId = url.searchParams.get('editionId') ?? '';
  const division = url.searchParams.get('division') ?? '';

  const [editions, divisions, entries] = await Promise.all([
    listWolfEditions(),
    listWolfDivisions(),
    buildPodiumEntries(contestId),
  ]);
  const existing = editionId && division ? await countExistingWinners(editionId, division) : 0;

  return NextResponse.json({
    data: { contestName: contest.name, editions, divisions, entries, existing },
  });
}

const PostSchema = z.object({
  editionId: z.string().uuid(),
  division: z.string().min(1).max(100),
  replace: z.boolean().default(true),
  /** 넣을 줄만 고를 때 쓰는 key 목록(`역할-참가번호`). 없으면 시상대 전체. */
  keys: z.array(z.string().max(100)).max(100).optional(),
});

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  const contest = await getContest(contestId);
  if (!contest) return NextResponse.json({ error: 'CONTEST_NOT_FOUND' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION', issues: parsed.error.issues }, { status: 400 });
  }
  const { editionId, division, replace, keys } = parsed.data;

  const all = await buildPodiumEntries(contestId);
  const entries = keys ? all.filter((e) => keys.includes(e.key)) : all;
  if (entries.length === 0) {
    // 지울 것만 있고 넣을 것이 없는 요청은 사고일 가능성이 높다 — 시상대를 비우고 싶다면
    // Wolf 우승자관리에서 지우는 쪽이 의도가 분명하다.
    return NextResponse.json({ error: 'NO_ENTRIES' }, { status: 400 });
  }

  try {
    const res = await publishWinnersToWolf({ editionId, division, entries, replace });
    return NextResponse.json({ data: res });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PUBLISH_FAILED' },
      { status: 500 },
    );
  }
}
