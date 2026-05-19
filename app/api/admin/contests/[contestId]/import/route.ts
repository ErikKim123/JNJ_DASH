// POST /api/admin/contests/[id]/import
//   /export 로 받은 JSON 을 그대로 다시 적용 (백업 → 복원).
//   PK(id)를 그대로 upsert 하므로 same-environment 복원에 가장 적합.
//   같은 contest_id 에만 적용 가능 (URL의 id 와 body.contest.id 가 일치해야 함).
//
// 처리 순서 (FK 의존성):
//   contests → participants → judges → judge_votes → pairings → qualifiers → final_results
//
// 옵션: ?names_only=1
//   다른 대회의 백업에서 participants/judges 명단만 가져오기 (새 대회 셋업용).
//   - contest.id 일치 검증 건너뜀
//   - contests 자체는 upsert 하지 않음 (대상 대회의 메타 보존)
//   - participants/judges 의 contest_id 를 URL 의 contestId 로 리맵
//   - judge_votes/pairings/qualifiers/final_results 는 건너뜀
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 검증은 최소화 — backup 파일은 신뢰. 핵심 필드만 체크.
const Schema = z.object({
  format: z.literal('jnj-dash-backup').optional(),
  version: z.number().optional(),
  contest: z.object({ id: z.string() }).passthrough(),
  participants: z.array(z.record(z.string(), z.unknown())).optional(),
  judges: z.array(z.record(z.string(), z.unknown())).optional(),
  judge_votes: z.array(z.record(z.string(), z.unknown())).optional(),
  pairings: z.array(z.record(z.string(), z.unknown())).optional(),
  qualifiers: z.array(z.record(z.string(), z.unknown())).optional(),
  final_results: z.array(z.record(z.string(), z.unknown())).optional(),
});

interface RouteCtx { params: Promise<{ contestId: string }> }

const CHUNK = 500;

// ─── 행 정규화 ───────────────────────────────────────────────────────────
// XLSX 변환은 빈 셀을 ''(빈 문자열)로 보존하지만, DB 의 nullable timestamp/numeric
// 컬럼은 ''를 받지 못한다(parse 실패). 이 컬럼들에 한해 '' → null 로 변환.

const NULLABLE_BY_TABLE: Record<string, readonly string[]> = {
  contests: ['period_start', 'period_end', 'legacy_spreadsheet_id'],
  judges: ['max_votes'],
  judge_votes: [
    'vote_mark',
    'basic_score', 'connectivity_score', 'musicality_score',
    'creativity_score', 'crowd_reaction_score', 'showmanship_score',
  ],
  pairings: ['shuffled_at', 'confirmed_at'],
  final_results: ['final_rank', 'total_score', 'average'],
};

function normalizeRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const nullable = NULLABLE_BY_TABLE[table];
  if (!nullable) return row;
  const out: Record<string, unknown> = { ...row };
  for (const col of nullable) {
    if (out[col] === '') out[col] = null;
  }
  return out;
}

function normalizeRows(table: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => normalizeRow(table, r));
}

async function chunkedUpsert(
  sb: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string
): Promise<number> {
  if (!rows.length) return 0;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await sb.from(table).upsert(slice, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    total += slice.length;
  }
  return total;
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { contestId } = await ctx.params;
  const url = new URL(req.url);
  const namesOnly = url.searchParams.get('names_only') === '1';

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BACKUP_FORMAT', issues: parsed.error.issues }, { status: 400 });
  }
  // names_only 모드 외에는 contest.id 일치 강제 (대상 대회의 메타 보호)
  if (!namesOnly && parsed.data.contest.id !== contestId) {
    return NextResponse.json({
      error: 'CONTEST_ID_MISMATCH',
      detail: `URL id="${contestId}" but backup contest.id="${parsed.data.contest.id}"`,
    }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const counts: Record<string, number> = {};

  // 모든 자식 테이블 행의 contest_id 를 URL 의 contestId 로 강제 리맵.
  // 운영자가 백업 JSON 의 안쪽 contest_id 를 일부만 편집해 누락했을 때 발생하는
  // "잘못된 대회로 데이터가 들어가버리는" 문제를 방지하기 위한 방어 로직.
  function remapContestId(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    return rows.map((r) => ({ ...r, contest_id: contestId }));
  }

  // 다른 대회에서 가져오는 경우(=원본 contest.id 와 URL 이 다름) participants/judges
  // 의 UUID 가 원본 대회 행과 충돌하면 upsert by id 가 원본을 갱신해서 데이터가
  // "복사"가 아니라 "이동"되어버린다. 그래서 cross-contest 일 때만 id 를 제거해
  // unique 키 onConflict 로 새 행이 INSERT 되도록 한다.
  const crossContest = parsed.data.contest.id !== contestId;
  function stripIdForCrossContest(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    if (!crossContest) return rows;
    return rows.map((r) => {
      const { id: _id, ...rest } = r;
      void _id;
      return rest;
    });
  }

  try {
    // 1) contests — names_only 면 대상 대회 메타 보존 위해 건너뜀
    if (!namesOnly) {
      const contestRow = normalizeRow('contests', parsed.data.contest as Record<string, unknown>);
      const { error: ce } = await sb
        .from('contests')
        .upsert(contestRow, { onConflict: 'id' });
      if (ce) throw new Error(`contests: ${ce.message}`);
      counts.contests = 1;
    } else {
      counts.contests = 0;
    }

    // 2) participants — same-contest 면 PK id, cross-contest 면 (contest_id, num) 기준
    counts.participants = await chunkedUpsert(
      sb, 'participants',
      stripIdForCrossContest(remapContestId(normalizeRows('participants', parsed.data.participants ?? []))),
      crossContest ? 'contest_id,num' : 'id',
    );

    // 3) judges — same-contest 면 PK id, cross-contest 면 (contest_id, round, display_order) 기준
    counts.judges = await chunkedUpsert(
      sb, 'judges',
      stripIdForCrossContest(remapContestId(normalizeRows('judges', parsed.data.judges ?? []))),
      crossContest ? 'contest_id,round,display_order' : 'id',
    );

    // names_only 모드는 명단까지만. 투표/페어링/자격자/결승 결과는 건너뜀.
    if (namesOnly) {
      counts.judge_votes = 0;
      counts.pairings = 0;
      counts.qualifiers = 0;
      counts.final_results = 0;
      return NextResponse.json({ data: { applied: true, mode: 'names_only', counts } });
    }

    // 4) judge_votes — (judge_id, participant_num) 기준 upsert.
    //    id 는 server-generated 라 클라이언트 가독성 시트(prelim_votes 등) 에서 환원 시
    //    누락될 수 있음. unique 키로 upsert 하고 페이로드의 id 필드는 제거해 충돌 회피.
    const rawVotes = (parsed.data.judge_votes ?? []) as Record<string, unknown>[];
    const stripped = rawVotes.map((v) => {
      const { id: _id, ...rest } = v;
      void _id;
      return rest;
    });
    counts.judge_votes = await chunkedUpsert(
      sb, 'judge_votes',
      normalizeRows('judge_votes', stripped),
      'judge_id,participant_num',
    );

    // 5) pairings
    counts.pairings = await chunkedUpsert(
      sb, 'pairings',
      remapContestId(normalizeRows('pairings', parsed.data.pairings ?? [])),
      'id',
    );

    // 6) qualifiers
    counts.qualifiers = await chunkedUpsert(
      sb, 'qualifiers',
      remapContestId(normalizeRows('qualifiers', parsed.data.qualifiers ?? [])),
      'id',
    );

    // 7) final_results
    counts.final_results = await chunkedUpsert(
      sb, 'final_results',
      remapContestId(normalizeRows('final_results', parsed.data.final_results ?? [])),
      'id',
    );
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'IMPORT_FAILED',
      partial: counts,
    }, { status: 500 });
  }

  return NextResponse.json({ data: { applied: true, counts } });
}
