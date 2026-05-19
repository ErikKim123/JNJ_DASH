// 클라이언트 측 JSON ↔ XLSX 변환 — 백업/복원에서 사용.
//
// 워크북 구성 (10 시트):
//   contest / participants / judges / pairings / qualifiers / final_results
//     → 테이블별 1 시트 (원본 컬럼 그대로)
//   prelim_votes / semi_votes / final_scores
//     → judge_votes 를 라운드별로 분리한 가독성 시트 (judge 이름·참가자 팀명 같은
//        조회 컬럼 추가). 임포트 시 다시 judge_votes JSON 으로 환원.
//   _meta : format/version/exported_at
//
// 셀 값은 모두 문자열 또는 number/boolean. 복잡 객체(jsonb meta, scoring_items 등) 는
// JSON.stringify 로 직렬화. import 시 JSON-like 면 parse 시도.
//
// Backward compat: 옛 백업(judge_votes 단일 시트) 도 import 가능.
import type { WorkBook } from 'xlsx';
import { SCORING_ITEMS } from '@/lib/db/scoring';

// 원본 컬럼 그대로 보존하는 raw 시트
const RAW_SHEETS = [
  'contest',
  'participants',
  'judges',
  'pairings',
  'qualifiers',
  'final_results',
] as const;
type RawSheet = (typeof RAW_SHEETS)[number];

// judge_votes → 라운드별 가독성 시트
const VOTES_SHEETS = ['prelim_votes', 'semi_votes', 'final_scores'] as const;
type VoteSheet = (typeof VOTES_SHEETS)[number];

/** 셀 친화적 직렬화 — 객체/배열은 JSON 문자열, 나머지는 원시값 그대로. */
function rowToCells(row: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v == null) out[k] = '';
    else if (typeof v === 'object') out[k] = JSON.stringify(v);
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else out[k] = String(v);
  }
  return out;
}

/** 역방향 — 문자열이 JSON-like 면 parse 시도. 실패하면 원본 그대로.
 *
 *  빈 셀은 빈 문자열 '' 로 보존 (null 변환 금지).
 *  judges.memo 같은 NOT NULL DEFAULT '' 컬럼이 깨지는 것을 막기 위함이며,
 *  nullable timestamp/numeric 의 '' → null 변환은 서버 측 정규화에서 담당. */
function cellsToRow(cells: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cells)) {
    if (v == null) { out[k] = ''; continue; }
    if (typeof v === 'string') {
      const s = v.trim();
      if (s === '') { out[k] = ''; continue; }
      if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
        try { out[k] = JSON.parse(s); continue; } catch { /* fall through */ }
      }
      // TRUE/FALSE 문자열 → boolean
      if (s === 'true' || s === 'TRUE') { out[k] = true; continue; }
      if (s === 'false' || s === 'FALSE') { out[k] = false; continue; }
      out[k] = v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ─── judge_votes 분리/병합 ────────────────────────────────────────────────

type JudgeRow = {
  id: string;
  round: 'prelim' | 'semi' | 'final';
  display_order: number;
  name: string;
};
type ParticipantRow = {
  num: string;
  team_name?: string | null;
  role?: string | null;
};
type VoteRow = {
  id?: string | null;
  judge_id: string;
  participant_num: string;
  vote_mark?: 'O' | 'X' | null;
  basic_score?: number | null;
  connectivity_score?: number | null;
  musicality_score?: number | null;
  creativity_score?: number | null;
  crowd_reaction_score?: number | null;
  showmanship_score?: number | null;
};

function buildJudgeIndex(judges: JudgeRow[]): {
  byId: Map<string, JudgeRow>;
  byRoundOrder: Map<string, JudgeRow>; // `${round}:${order}` → judge
  byRoundName: Map<string, JudgeRow>;  // `${round}:${name.toLowerCase()}` → judge
} {
  const byId = new Map<string, JudgeRow>();
  const byRoundOrder = new Map<string, JudgeRow>();
  const byRoundName = new Map<string, JudgeRow>();
  for (const j of judges) {
    byId.set(j.id, j);
    byRoundOrder.set(`${j.round}:${j.display_order}`, j);
    byRoundName.set(`${j.round}:${(j.name ?? '').trim().toLowerCase()}`, j);
  }
  return { byId, byRoundOrder, byRoundName };
}

function buildParticipantIndex(parts: ParticipantRow[]): Map<string, ParticipantRow> {
  const m = new Map<string, ParticipantRow>();
  for (const p of parts) if (p?.num != null) m.set(String(p.num), p);
  return m;
}

/** votes 를 라운드별로 분류. 라운드 판별: judge.round 로 결정. */
function splitVotesByRound(
  votes: VoteRow[],
  judgesById: Map<string, JudgeRow>,
): Record<VoteSheet, VoteRow[]> {
  const out: Record<VoteSheet, VoteRow[]> = {
    prelim_votes: [], semi_votes: [], final_scores: [],
  };
  for (const v of votes) {
    const j = judgesById.get(v.judge_id);
    if (!j) continue; // 고아 vote — judge 가 없으면 어디 라운드인지 판단 불가, drop
    if (j.round === 'prelim') out.prelim_votes.push(v);
    else if (j.round === 'semi') out.semi_votes.push(v);
    else if (j.round === 'final') out.final_scores.push(v);
  }
  return out;
}

/** prelim/semi 가독성 행 — O/X 마크 시트. */
function voteToMarkSheetRow(
  v: VoteRow,
  judge: JudgeRow,
  participant: ParticipantRow | undefined,
): Record<string, unknown> {
  return {
    judge_no: judge.display_order,
    judge_name: judge.name,
    participant_num: v.participant_num,
    team_name: participant?.team_name ?? '',
    role: participant?.role ?? '',
    mark: v.vote_mark ?? '',
    // 라운드트립용 식별자 (운영자는 건드릴 필요 없음)
    _vote_id: v.id ?? '',
    _judge_id: v.judge_id,
  };
}

/** final 가독성 행 — 6 항목 점수 시트. 컬럼은 SCORING_ITEMS 의 key 명 사용. */
function voteToScoreSheetRow(
  v: VoteRow,
  judge: JudgeRow,
  participant: ParticipantRow | undefined,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    judge_no: judge.display_order,
    judge_name: judge.name,
    participant_num: v.participant_num,
    team_name: participant?.team_name ?? '',
    role: participant?.role ?? '',
  };
  for (const item of SCORING_ITEMS) {
    const val = v[item.column];
    base[item.key] = val == null ? '' : val;
  }
  base._vote_id = v.id ?? '';
  base._judge_id = v.judge_id;
  return base;
}

/** prelim/semi 가독성 시트 행 → VoteRow 환원. */
function markSheetRowToVote(
  row: Record<string, unknown>,
  judgeLookup: ReturnType<typeof buildJudgeIndex>,
  round: 'prelim' | 'semi',
): VoteRow | null {
  const participantNum = row.participant_num != null ? String(row.participant_num).trim() : '';
  if (!participantNum) return null;

  // judge_id 우선순위:
  //   1) _judge_id (옛 백업 또는 운영자가 보존한 UUID)
  //   2) (round, judge_no)
  //   3) (round, judge_name)
  const explicitId = row._judge_id != null ? String(row._judge_id).trim() : '';
  let judge = explicitId ? judgeLookup.byId.get(explicitId) : undefined;
  if (!judge && row.judge_no != null && row.judge_no !== '') {
    const ord = Number(row.judge_no);
    if (Number.isFinite(ord)) judge = judgeLookup.byRoundOrder.get(`${round}:${ord}`);
  }
  if (!judge && row.judge_name != null) {
    const nm = String(row.judge_name).trim().toLowerCase();
    if (nm) judge = judgeLookup.byRoundName.get(`${round}:${nm}`);
  }
  if (!judge) return null;

  const markRaw = row.mark != null ? String(row.mark).trim().toUpperCase() : '';
  const mark = markRaw === 'O' || markRaw === 'X' ? markRaw as 'O' | 'X' : null;

  const out: VoteRow = {
    judge_id: judge.id,
    participant_num: participantNum,
    vote_mark: mark,
  };
  if (row._vote_id && String(row._vote_id).trim()) out.id = String(row._vote_id).trim();
  return out;
}

/** final 가독성 시트 행 → VoteRow 환원. */
function scoreSheetRowToVote(
  row: Record<string, unknown>,
  judgeLookup: ReturnType<typeof buildJudgeIndex>,
): VoteRow | null {
  const participantNum = row.participant_num != null ? String(row.participant_num).trim() : '';
  if (!participantNum) return null;

  const explicitId = row._judge_id != null ? String(row._judge_id).trim() : '';
  let judge = explicitId ? judgeLookup.byId.get(explicitId) : undefined;
  if (!judge && row.judge_no != null && row.judge_no !== '') {
    const ord = Number(row.judge_no);
    if (Number.isFinite(ord)) judge = judgeLookup.byRoundOrder.get(`final:${ord}`);
  }
  if (!judge && row.judge_name != null) {
    const nm = String(row.judge_name).trim().toLowerCase();
    if (nm) judge = judgeLookup.byRoundName.get(`final:${nm}`);
  }
  if (!judge) return null;

  const out: VoteRow = {
    judge_id: judge.id,
    participant_num: participantNum,
  };
  for (const item of SCORING_ITEMS) {
    const raw = row[item.key];
    if (raw == null || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n)) (out as Record<string, unknown>)[item.column] = n;
  }
  if (row._vote_id && String(row._vote_id).trim()) out.id = String(row._vote_id).trim();
  return out;
}

// ─── EXPORT (JSON → XLSX) ─────────────────────────────────────────────────

export async function jsonBackupToXlsx(backup: Record<string, unknown>): Promise<Blob> {
  // dynamic import — 초기 번들 크기 영향 최소화
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  // 1) 원본 raw 시트들
  for (const name of RAW_SHEETS) {
    const raw = backup[name];
    let rows: Record<string, unknown>[];
    if (name === 'contest') {
      rows = raw && typeof raw === 'object' ? [raw as Record<string, unknown>] : [];
    } else if (Array.isArray(raw)) {
      rows = raw as Record<string, unknown>[];
    } else {
      rows = [];
    }
    const cellRows = rows.map(rowToCells);
    const ws = XLSX.utils.json_to_sheet(cellRows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  // 2) judge_votes 를 3 라운드 가독성 시트로 분리
  const judges = Array.isArray(backup.judges) ? backup.judges as JudgeRow[] : [];
  const participants = Array.isArray(backup.participants)
    ? backup.participants as ParticipantRow[]
    : [];
  const votes = Array.isArray(backup.judge_votes) ? backup.judge_votes as VoteRow[] : [];
  const { byId } = buildJudgeIndex(judges);
  const partIdx = buildParticipantIndex(participants);
  const split = splitVotesByRound(votes, byId);

  for (const sheetName of VOTES_SHEETS) {
    const rows = split[sheetName];
    // judge_no, participant_num 으로 정렬 — 운영자가 매트릭스 보듯 읽기 좋게
    rows.sort((a, b) => {
      const ja = byId.get(a.judge_id);
      const jb = byId.get(b.judge_id);
      const oa = ja?.display_order ?? 999;
      const ob = jb?.display_order ?? 999;
      if (oa !== ob) return oa - ob;
      return String(a.participant_num).localeCompare(String(b.participant_num), undefined, { numeric: true });
    });

    const cellRows = rows
      .map((v) => {
        const j = byId.get(v.judge_id);
        if (!j) return null;
        const p = partIdx.get(String(v.participant_num));
        return sheetName === 'final_scores'
          ? voteToScoreSheetRow(v, j, p)
          : voteToMarkSheetRow(v, j, p);
      })
      .filter((r): r is Record<string, unknown> => r !== null)
      .map(rowToCells);
    const ws = XLSX.utils.json_to_sheet(cellRows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // 3) metadata 시트
  const metaRows = [
    { key: 'format', value: String(backup.format ?? 'jnj-dash-backup') },
    { key: 'version', value: String(backup.version ?? 1) },
    { key: 'exported_at', value: String(backup.exported_at ?? new Date().toISOString()) },
  ];
  const metaWs = XLSX.utils.json_to_sheet(metaRows);
  XLSX.utils.book_append_sheet(wb, metaWs, '_meta');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ─── IMPORT (XLSX → JSON) ─────────────────────────────────────────────────

export async function xlsxFileToJsonBackup(file: File): Promise<Record<string, unknown>> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb: WorkBook = XLSX.read(buf, { type: 'array' });

  // _meta 시트
  let format = 'jnj-dash-backup';
  let version = 1;
  let exported_at = new Date().toISOString();
  const metaSheet = wb.Sheets['_meta'];
  if (metaSheet) {
    const rows = XLSX.utils.sheet_to_json<{ key?: string; value?: string }>(metaSheet);
    for (const r of rows) {
      if (r.key === 'format' && r.value) format = String(r.value);
      else if (r.key === 'version' && r.value) version = Number(r.value) || 1;
      else if (r.key === 'exported_at' && r.value) exported_at = String(r.value);
    }
  }

  function readSheet(name: string): Record<string, unknown>[] {
    const ws = wb.Sheets[name];
    if (!ws) return [];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    return rawRows.map(cellsToRow);
  }

  const contestRows = readSheet('contest');
  const participants = readSheet('participants');
  const judges = readSheet('judges');

  // judge_votes 환원 우선순위:
  //   1) 가독성 시트(prelim_votes / semi_votes / final_scores) 가 하나라도 있으면 거기서 환원
  //   2) 없으면 옛 형식의 judge_votes 단일 시트 사용 (backward compat)
  const hasReadable =
    wb.Sheets['prelim_votes'] || wb.Sheets['semi_votes'] || wb.Sheets['final_scores'];

  let judgeVotes: Record<string, unknown>[];
  if (hasReadable) {
    // judges 시트에서 lookup index 구성
    const judgeRows = judges as JudgeRow[];
    const lookup = buildJudgeIndex(judgeRows);

    const reconstructed: VoteRow[] = [];
    for (const row of readSheet('prelim_votes')) {
      const v = markSheetRowToVote(row, lookup, 'prelim');
      if (v) reconstructed.push(v);
    }
    for (const row of readSheet('semi_votes')) {
      const v = markSheetRowToVote(row, lookup, 'semi');
      if (v) reconstructed.push(v);
    }
    for (const row of readSheet('final_scores')) {
      const v = scoreSheetRowToVote(row, lookup);
      if (v) reconstructed.push(v);
    }
    // 같은 (judge_id, participant_num) 가 중복으로 들어오면 마지막 것이 유효 (운영자가 수정한 행 우선)
    const dedup = new Map<string, VoteRow>();
    for (const v of reconstructed) {
      dedup.set(`${v.judge_id}:${v.participant_num}`, v);
    }
    judgeVotes = [...dedup.values()] as Record<string, unknown>[];
  } else {
    judgeVotes = readSheet('judge_votes');
  }

  const out: Record<string, unknown> = {
    format,
    version,
    exported_at,
    contest: contestRows[0] ?? {},
    participants,
    judges,
    judge_votes: judgeVotes,
    pairings: readSheet('pairings'),
    qualifiers: readSheet('qualifiers'),
    final_results: readSheet('final_results'),
  };
  return out;
}
