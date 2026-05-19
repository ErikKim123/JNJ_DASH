#!/usr/bin/env node
/**
 * 시트 → Supabase DB 일괄 import 스크립트.
 *
 * 사용:
 *   node scripts/import-from-sheets.mjs                  # 전체 대회
 *   node scripts/import-from-sheets.mjs JNJ-001          # 특정 대회만
 *   node scripts/import-from-sheets.mjs --skip-existing  # 이미 DB에 있는 대회 건너뜀
 *
 * 사전 조건:
 *   1) db/migrations/0001_initial.sql 을 Supabase 에 적용 완료
 *   2) .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 존재
 *   3) 대회목록 시트와 대회별 마스터 시트들이 "링크가 있는 모든 사용자: 뷰어" 공유
 *
 * 동작:
 *   - 대회목록 시트(gviz CSV) → contests upsert
 *   - 각 대회 마스터 시트 →
 *       1.대회정보   → contests 필드 보강 (design_template_number 등)
 *       3.참가자     → participants upsert (전체 컬럼은 meta jsonb 로 보존)
 *       3-1.예선랜덤 → pairings(prelim, status='confirmed') upsert
 *       4-1.본선랜덤 → pairings(semi,   status='confirmed') upsert
 *       4.예선통과   → qualifiers(prelim) upsert
 *       5.본선통과   → qualifiers(semi)   upsert
 *       6.결승       → final_results upsert
 *
 *   모든 단계가 idempotent (재실행 안전).
 */
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// ─── env loader (.env.local) ────────────────────────────────────────────
async function loadDotenv() {
  const file = path.join(process.cwd(), '.env.local');
  try {
    const raw = await fs.readFile(file, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

// ─── CSV parser (RFC 4180) ──────────────────────────────────────────────
function parseCsv(csv) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') { field += '"'; i++; continue; }
        inQuotes = false; continue;
      }
      field += ch; continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

async function fetchSheet(spreadsheetId, locator) {
  const url = new URL(
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq`
  );
  url.searchParams.set('tqx', 'out:csv');
  if (locator.gid) url.searchParams.set('gid', locator.gid);
  else if (locator.tabName) url.searchParams.set('sheet', locator.tabName);
  else throw new Error('locator needs gid or tabName');
  const res = await fetch(url, { cache: 'no-store', redirect: 'follow' });
  if (!res.ok) throw new Error(`gviz ${res.status} for ${spreadsheetId} ${JSON.stringify(locator)}`);
  const text = await res.text();
  if (text.startsWith('<') || text.startsWith('/*O_o*/')) {
    throw new Error(`gviz returned non-CSV for ${JSON.stringify(locator)} (시트 공유 또는 탭 이름 확인)`);
  }
  return parseCsv(text);
}

// ─── helpers ────────────────────────────────────────────────────────────
const cell = (row, i) => (row && typeof row[i] === 'string' ? row[i].trim() : '');
const safeInt = (v, d = 0) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const safeNum = (v) => { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

function extractSpreadsheetId(url) {
  if (!url) return null;
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
  return m ? m[1] : null;
}

function parsePeriod(s) {
  if (!s) return { start: null, end: null };
  const parts = s.split('-').map(p => p.trim());
  if (parts.length !== 2) return { start: null, end: null };
  const fmt = (raw) => /^\d{8}$/.test(raw) ? `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}` : null;
  return { start: fmt(parts[0]), end: fmt(parts[1]) };
}

function classifyRole(raw) {
  if (!raw) return null;
  const t = raw.replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/\s+/g, '');
  const hasHelper = t.indexOf('헬퍼') >= 0 || t.indexOf('도우미') >= 0;
  const hasLeader = /리더/.test(t);
  const hasFollower = /팔로워/.test(t);
  if (hasHelper && hasLeader) return 'helper_leader';
  if (hasHelper && hasFollower) return 'helper_follower';
  if (hasLeader) return 'leader';
  if (hasFollower) return 'follower';
  return null;
}

function normalizePhoto(raw) {
  if (!raw) return '';
  let v = raw.trim();
  if (!v) return '';
  const m = v.match(/^=IMAGE\(\s*["']([^"']+)["']/i);
  if (m) v = m[1];
  if (v.includes('drive.google.com')) {
    const fm = v.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ?? v.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fm) return `https://lh3.googleusercontent.com/d/${fm[1]}`;
  }
  if (!/^(https?:\/\/|data:image\/)/i.test(v)) return '';
  return v;
}

// ─── locators (lib/sheets/schema.ts 와 동일) ─────────────────────────────
const LOC = {
  contestInfo:    { gid: '1162828405', tabName: '1.대회정보' },
  judges:         { tabName: '2.심사위원' },
  participants:   { tabName: '3.참가자' },
  prelimPairing:  { gid: '1758057990', tabName: '3-1.예선랜덤' },
  prelimResult:   { tabName: '4.예선통과' },
  semiPairing:    { tabName: '4-1.본선랜덤' },
  semiResult:     { tabName: '5.본선통과' },
  finalResult:    { tabName: '6.결승' },
};

// ─── extractors ─────────────────────────────────────────────────────────
async function extractContestInfo(spreadsheetId) {
  const out = {
    design_template_number: 1,
    prelim_pass_per_role: 10,
    semi_pass_per_role: 5,
    festival_header: '',
    tagline: '',
  };
  try {
    const rows = await fetchSheet(spreadsheetId, LOC.contestInfo);
    for (const r of rows) {
      const label = cell(r, 0);
      const val = cell(r, 1);
      if (!label) continue;
      if (label === '디자인 템플릿 번호') {
        const n = safeInt(val, 1);
        out.design_template_number = n > 0 ? n : 1;
      } else if (label.indexOf('예선 통과 인원') >= 0) {
        const n = safeInt(val, 10);
        out.prelim_pass_per_role = n > 0 ? n : 10;
      } else if (label.indexOf('본선 통과 인원') >= 0) {
        const n = safeInt(val, 5);
        out.semi_pass_per_role = n > 0 ? n : 5;
      } else if (label === '행사명' || label === '대회명' || label === 'Festival Header') {
        if (val) out.festival_header = val;
      } else if (label === '태그라인' || label === 'Tagline') {
        if (val) out.tagline = val;
      }
    }
  } catch (e) {
    console.warn(`  ! 1.대회정보 시트 읽기 실패 — 기본값 사용: ${e.message}`);
  }
  return out;
}

function findHeaderRow(rows, keyword = '참가번호') {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (cell(rows[i], 0).indexOf(keyword) >= 0) return i;
  }
  return 0;
}

async function extractParticipants(contestId, spreadsheetId) {
  let rows;
  try { rows = await fetchSheet(spreadsheetId, LOC.participants); }
  catch (e) { console.warn(`  ! 3.참가자 시트 읽기 실패: ${e.message}`); return []; }
  if (!rows.length) return [];

  const hi = findHeaderRow(rows);
  const headers = (rows[hi] || []).map(h => String(h ?? '').replace(/^☑\s*/, '').trim());

  const colNum = headers.findIndex(h => h === '참가번호' || h.indexOf('참가번호') >= 0);
  const colTeam = headers.findIndex(h => h === '팀명' || h === '참가자명' || h === '팀명/참가자명');
  const colRep = headers.findIndex(h => h === '대표자' || h === '대표자명');
  const colRole = headers.findIndex(h => h === '역할' || h === '역활');
  const colPhoto = headers.findIndex(h => h === '사진' || h.indexOf('사진') >= 0);

  const out = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const num = cell(r, colNum < 0 ? 0 : colNum);
    if (!num || !/^[A-Za-z0-9_-]+$/.test(num)) continue;
    const role = classifyRole(cell(r, colRole < 0 ? -1 : colRole));
    if (!role) continue;
    const teamName = cell(r, colTeam < 0 ? 2 : colTeam);
    const rep = cell(r, colRep < 0 ? 3 : colRep);
    const photo = normalizePhoto(cell(r, colPhoto < 0 ? 14 : colPhoto));

    // 나머지 셀 전체를 헤더명: 값 으로 meta 저장 (점수/장르 등 운영팀 보조 데이터 보존)
    const meta = {};
    for (let c = 0; c < headers.length; c++) {
      if (c === colNum || c === colTeam || c === colRep || c === colRole || c === colPhoto) continue;
      const h = headers[c];
      if (!h) continue;
      const v = cell(r, c);
      if (v !== '') meta[h] = v;
    }
    out.push({
      contest_id: contestId, num, team_name: teamName, representative: rep,
      role, photo_url: photo, meta,
    });
  }
  return out;
}

async function extractPairings(contestId, spreadsheetId, round) {
  const loc = round === 'prelim' ? LOC.prelimPairing : LOC.semiPairing;
  let rows;
  try { rows = await fetchSheet(spreadsheetId, loc); }
  catch (e) { console.warn(`  ! ${round} 페어링 시트 읽기 실패: ${e.message}`); return []; }
  if (!rows.length) return [];
  // 첫 행 헤더 가정 (lib/sheets/schema.ts: PAIRING_HAS_HEADER = true)
  const body = rows.slice(1);
  const out = [];
  for (let i = 0; i < body.length; i++) {
    const r = body[i];
    const pairIdx = safeInt(cell(r, 0), i + 1);
    const leaderNum = cell(r, 1);
    const leaderName = cell(r, 2);
    const followerNum = cell(r, 4);
    const followerName = cell(r, 5);
    if (!leaderName && !followerName) continue;
    out.push({
      contest_id: contestId, round, pair_idx: pairIdx,
      leader_num: leaderNum, leader_name: leaderName,
      follower_num: followerNum, follower_name: followerName,
      // 시트에 있던 페어링은 이미 운영진이 확정한 것으로 간주.
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    });
  }
  return out;
}

async function extractQualifiers(contestId, spreadsheetId, round) {
  const loc = round === 'prelim' ? LOC.prelimResult : LOC.semiResult;
  let rows;
  try { rows = await fetchSheet(spreadsheetId, loc); }
  catch (e) { console.warn(`  ! ${round} 통과자 시트 읽기 실패: ${e.message}`); return []; }
  if (!rows.length) return [];
  const body = rows.slice(1); // QUALIFIER_HAS_HEADER
  // 컬럼 매핑 (lib/sheets/schema.ts: DEFAULT_QUALIFIER_COLUMNS)
  // A num | B photo | C teamName | D rep | I role | J passed
  const out = [];
  for (const r of body) {
    const num = cell(r, 0);
    const team = cell(r, 2);
    const roleRaw = cell(r, 8);
    if (!num || !team || !roleRaw) continue;
    const role = classifyRole(roleRaw);
    if (!role) continue;
    const passed = (cell(r, 9) || '').toUpperCase() === 'TRUE';
    out.push({
      contest_id: contestId, round, participant_num: num,
      team_name: team, representative: cell(r, 3),
      role, photo_url: normalizePhoto(cell(r, 1)),
      passed, votes: 0, display_order: 0,
    });
  }
  return out;
}

// 시트 "대상" 값 → judge_target_role enum
function classifyJudgeTarget(raw) {
  const t = String(raw ?? '').replace(/\s+/g, '').toLowerCase();
  if (t.indexOf('리더') >= 0 || t === 'leader') return 'leader';
  if (t.indexOf('팔로워') >= 0 || t === 'follower') return 'follower';
  return 'both'; // "모두" / 빈 값 / 기타
}

async function extractJudges(contestId, spreadsheetId) {
  let rows;
  try { rows = await fetchSheet(spreadsheetId, LOC.judges); }
  catch (e) { console.warn(`  ! 2.심사위원 시트 읽기 실패: ${e.message}`); return []; }
  if (!rows || rows.length < 2) return [];

  // 헤더 행 탐지 — 첫 셀에 "번호" 포함
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (cell(rows[i], 0).indexOf('번호') >= 0) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return [];

  const headers = (rows[headerIdx] || []).map((h) => String(h ?? '').trim());
  const find = (...keywords) => headers.findIndex((h) => keywords.some((k) => h.indexOf(k) >= 0));
  const colNo       = find('번호');
  const colName     = find('심사위원명');
  const colAlias    = find('활동명', '메인');
  const colSpec     = find('전문 장르', '장르');
  const colCareer   = find('주요 경력', '경력');
  const colPhone    = find('연락처', '전화');
  const colEmail    = find('이메일');
  const colMemo     = find('비고');
  const colMaxPre   = find('예선투표', '예선 투표');
  const colMaxSemi  = find('본선투표', '본선 투표');
  const colTarget   = find('대상');

  // 한 시트 row → judges 라운드별 3개 row 생성. 시트의 max_prelim_votes / max_semi_votes 를
  // 각 라운드 max_votes 로 매핑. final 은 max_votes=null.
  const out = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const order = safeInt(cell(r, colNo < 0 ? 0 : colNo), 0);
    const name = cell(r, colName < 0 ? 1 : colName);
    if (!order || !name) continue;
    const alias = colAlias  < 0 ? '' : cell(r, colAlias);
    const specialty = colSpec < 0 ? '' : cell(r, colSpec);
    const career = colCareer < 0 ? '' : cell(r, colCareer);
    const phone = colPhone < 0 ? '' : cell(r, colPhone);
    const email = colEmail < 0 ? '' : cell(r, colEmail);
    const memo  = colMemo  < 0 ? '' : cell(r, colMemo);
    const maxPre  = colMaxPre  < 0 ? null : safeInt(cell(r, colMaxPre), null);
    const maxSemi = colMaxSemi < 0 ? null : safeInt(cell(r, colMaxSemi), null);
    const target = classifyJudgeTarget(colTarget < 0 ? '' : cell(r, colTarget));

    const base = {
      contest_id: contestId,
      display_order: order,
      name,
      alias,
      specialty,
      career,
      phone,
      email,
      memo,
      target_role: target,
    };
    out.push({ ...base, round: 'prelim', max_votes: maxPre });
    out.push({ ...base, round: 'semi',   max_votes: maxSemi });
    out.push({ ...base, round: 'final',  max_votes: null });
  }
  return out;
}

async function extractFinalResults(contestId, spreadsheetId) {
  let rows;
  try { rows = await fetchSheet(spreadsheetId, LOC.finalResult); }
  catch (e) { console.warn(`  ! 6.결승 시트 읽기 실패: ${e.message}`); return []; }
  if (!rows.length) return [];
  const body = rows.slice(1); // FINAL_RESULT_HAS_HEADER
  // A num | B photo | C teamName | I totalScore | J average | K finalRank
  const leaderRe = /리더\s*(\d+)/;
  const followerRe = /팔로워\s*(\d+)/;
  const out = [];
  for (const r of body) {
    const num = cell(r, 0);
    const team = cell(r, 2);
    const rankRaw = cell(r, 10);
    if (!num || !team || !rankRaw) continue;
    let role = null, rank = null;
    const lm = rankRaw.match(leaderRe);
    const fm = rankRaw.match(followerRe);
    if (lm) { role = 'leader'; rank = safeInt(lm[1], null); }
    else if (fm) { role = 'follower'; rank = safeInt(fm[1], null); }
    else continue;
    out.push({
      contest_id: contestId, participant_num: num,
      team_name: team, role, final_rank: rank,
      total_score: safeNum(cell(r, 8)),
      average: safeNum(cell(r, 9)),
      photo_url: normalizePhoto(cell(r, 1)),
    });
  }
  return out;
}

// ─── chunked upsert (Supabase 권장 1k 이내) ─────────────────────────────
async function chunkedUpsert(supabase, table, rows, onConflict) {
  if (!rows.length) return { inserted: 0 };
  const CHUNK = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).upsert(slice, { onConflict, ignoreDuplicates: false });
    if (error) throw new Error(`${table} upsert 실패: ${error.message}`);
    total += slice.length;
  }
  return { inserted: total };
}

// ─── main ───────────────────────────────────────────────────────────────
async function main() {
  await loadDotenv();
  const args = process.argv.slice(2);
  const skipExisting = args.includes('--skip-existing');
  const onlyId = args.find(a => !a.startsWith('--')) || null;

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const CONTEST_LIST_ID = process.env.CONTEST_LIST_SHEET_ID || '1bRclkuN8fuSfhoSrRUEtBjPPx6TePofxojE72qHV6iU';
  const CONTEST_LIST_GID = process.env.CONTEST_LIST_SHEET_GID || '2102151233';

  console.log(`▶ 대회목록 시트 로드: ${CONTEST_LIST_ID} (gid=${CONTEST_LIST_GID})`);
  const listRows = await fetchSheet(CONTEST_LIST_ID, { gid: CONTEST_LIST_GID });
  const contests = [];
  for (const r of listRows.slice(1)) { // 헤더 1행 스킵
    const contestSeq = cell(r, 0);
    const name = cell(r, 1);
    const period = cell(r, 2);
    const hostOrg = cell(r, 3);
    const fileSlug = cell(r, 7);
    const masterUrl = cell(r, 8);
    if (!name || !masterUrl) continue;
    const spreadsheetId = extractSpreadsheetId(masterUrl);
    if (!spreadsheetId) continue;
    const contestId = fileSlug || contestSeq;
    if (!contestId) continue;
    const { start, end } = parsePeriod(period);
    contests.push({
      id: contestId, name, host_org: hostOrg,
      period_start: start, period_end: end,
      legacy_spreadsheet_id: spreadsheetId,
    });
  }
  console.log(`✓ ${contests.length}개 대회 발견: ${contests.map(c => c.id).join(', ')}`);

  const targets = onlyId ? contests.filter(c => c.id === onlyId) : contests;
  if (onlyId && !targets.length) {
    console.error(`✗ contestId="${onlyId}" 를 대회목록에서 못 찾음.`);
    process.exit(1);
  }

  for (const c of targets) {
    console.log(`\n━━━ [${c.id}] ${c.name} ━━━`);

    if (skipExisting) {
      const { data: existing } = await supabase
        .from('contests').select('id').eq('id', c.id).maybeSingle();
      if (existing) { console.log('  → 이미 존재 (--skip-existing) — 건너뜀'); continue; }
    }

    // 1.대회정보 시트에서 보강
    const info = await extractContestInfo(c.legacy_spreadsheet_id);
    const row = {
      id: c.id,
      name: c.name,
      host_org: c.host_org,
      period_start: c.period_start,
      period_end: c.period_end,
      legacy_spreadsheet_id: c.legacy_spreadsheet_id,
      design_template_number: info.design_template_number,
      prelim_pass_per_role: info.prelim_pass_per_role,
      semi_pass_per_role: info.semi_pass_per_role,
      festival_header: info.festival_header || c.name,
      tagline: info.tagline,
      status: 'ready',
    };
    {
      const { error } = await supabase.from('contests').upsert(row, { onConflict: 'id' });
      if (error) throw new Error(`contests upsert 실패 (${c.id}): ${error.message}`);
      console.log(`  ✓ contests upsert (template=${info.design_template_number}, prelim=${info.prelim_pass_per_role}, semi=${info.semi_pass_per_role})`);
    }

    // participants
    const participants = await extractParticipants(c.id, c.legacy_spreadsheet_id);
    const pRes = await chunkedUpsert(supabase, 'participants', participants, 'contest_id,num');
    console.log(`  ✓ participants: ${pRes.inserted}건`);

    // pairings — prelim
    const pairPrelim = await extractPairings(c.id, c.legacy_spreadsheet_id, 'prelim');
    const ppRes = await chunkedUpsert(supabase, 'pairings', pairPrelim, 'contest_id,round,pair_idx');
    console.log(`  ✓ pairings prelim: ${ppRes.inserted}건 (confirmed)`);

    // pairings — semi
    const pairSemi = await extractPairings(c.id, c.legacy_spreadsheet_id, 'semi');
    const psRes = await chunkedUpsert(supabase, 'pairings', pairSemi, 'contest_id,round,pair_idx');
    console.log(`  ✓ pairings semi: ${psRes.inserted}건 (confirmed)`);

    // qualifiers — prelim
    const qPrelim = await extractQualifiers(c.id, c.legacy_spreadsheet_id, 'prelim');
    const qpRes = await chunkedUpsert(supabase, 'qualifiers', qPrelim, 'contest_id,round,participant_num');
    console.log(`  ✓ qualifiers prelim: ${qpRes.inserted}건`);

    // qualifiers — semi
    const qSemi = await extractQualifiers(c.id, c.legacy_spreadsheet_id, 'semi');
    const qsRes = await chunkedUpsert(supabase, 'qualifiers', qSemi, 'contest_id,round,participant_num');
    console.log(`  ✓ qualifiers semi: ${qsRes.inserted}건`);

    // final_results
    const finals = await extractFinalResults(c.id, c.legacy_spreadsheet_id);
    const fRes = await chunkedUpsert(supabase, 'final_results', finals, 'contest_id,role,participant_num');
    console.log(`  ✓ final_results: ${fRes.inserted}건`);

    // judges (2.심사위원 → 라운드별 3개 row)
    const judges = await extractJudges(c.id, c.legacy_spreadsheet_id);
    const jRes = await chunkedUpsert(supabase, 'judges', judges, 'contest_id,round,display_order');
    console.log(`  ✓ judges: ${jRes.inserted}건 (prelim/semi/final 라운드별)`);
  }

  console.log('\n✓ 전체 import 완료.');
}

main().catch(e => {
  console.error('\n✗ import 실패:', e.message);
  process.exit(1);
});
