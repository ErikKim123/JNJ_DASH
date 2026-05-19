#!/usr/bin/env node
/**
 * participants.meta 에서 심사위원 투표를 추출해 judges + judge_votes 로 시드.
 *
 * 인식 규칙:
 *   prelim 라운드 :  meta 키 = "① Oliver" ~ "⑮ ..." (긴 안내 헤더가 첫 글자에 ①…⑮ 포함해도 같이 처리)
 *                   값 = 'O' / 'X'
 *   final  라운드 :  meta 키 = "① Oliver 기본기" / " 연결성" / " 음악성" (3 항목)
 *                   값 = 숫자 점수
 *   semi   라운드 :  meta 헤더가 시트마다 달라 자동 추출 못함 → 운영자가 UI 에서 입력.
 *
 * 사용:
 *   npm run db:seed-judging
 *   node scripts/seed-judging-from-meta.mjs JNJ-001     # 특정 대회만
 *
 * idempotent — 같은 (contest_id, round, display_order) 의 judge 가 이미 있으면 건너뜀.
 *               judge_votes 는 upsert.
 */
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

async function loadDotenv() {
  const raw = await fs.readFile(path.join(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
await loadDotenv();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const onlyId = process.argv.slice(2).find((a) => !a.startsWith('--')) || null;

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮';
function circledIdx(s) {
  if (!s) return null;
  const i = CIRCLED.indexOf(s[0]);
  return i >= 0 ? i + 1 : null;
}
function classifyKey(k) {
  const ord = circledIdx(k);
  if (ord == null) return null;
  // final 점수 항목: 끝이 기본기/연결성/음악성
  const finalM = k.match(/(기본기|연결성|음악성)\s*$/);
  if (finalM) {
    const judgeLabel = k.replace(/\s*(기본기|연결성|음악성)\s*$/, '').trim();
    return { round: 'final', ord, judgeLabel, item: finalM[1] };
  }
  // prelim 통과 투표: 짧은 형태 우선. 긴 안내 헤더도 동일 ord 로 normalize.
  // 짧은 form 만 채택 (length<=30) — 긴 헤더는 중복본이라 무시.
  if (k.length > 30) return null;
  return { round: 'prelim', ord, judgeLabel: k };
}

const { data: contests, error: ce } = await sb.from('contests').select('id,name');
if (ce) throw ce;

for (const c of contests) {
  if (onlyId && c.id !== onlyId) continue;
  console.log(`\n━━━ [${c.id}] ${c.name} ━━━`);

  const { data: parts, error: pe } = await sb
    .from('participants')
    .select('id, num, meta')
    .eq('contest_id', c.id);
  if (pe) { console.error(pe); continue; }
  if (!parts.length) { console.log('  no participants — skip'); continue; }

  // 1) 모든 row 스캔해서 (round, ord) → judgeLabel 결정 (첫 등장 우선)
  const judgeMap = new Map(); // key = `${round}:${ord}` → label
  for (const p of parts) {
    for (const k of Object.keys(p.meta ?? {})) {
      const c = classifyKey(k);
      if (!c) continue;
      const key = `${c.round}:${c.ord}`;
      if (!judgeMap.has(key)) judgeMap.set(key, c.judgeLabel);
    }
  }
  console.log(`  detected judges: prelim ${[...judgeMap.keys()].filter(k=>k.startsWith('prelim:')).length} / final ${[...judgeMap.keys()].filter(k=>k.startsWith('final:')).length}`);

  // 2) judges 테이블에 upsert. 기존에 있으면 그대로 사용.
  const judgesByKey = new Map(); // `${round}:${ord}` → judges.id
  for (const [key, name] of judgeMap.entries()) {
    const [round, ordStr] = key.split(':');
    const ord = Number(ordStr);
    const { data: existing } = await sb
      .from('judges')
      .select('id, name')
      .eq('contest_id', c.id)
      .eq('round', round)
      .eq('display_order', ord)
      .maybeSingle();
    if (existing) { judgesByKey.set(key, existing.id); continue; }
    const { data, error } = await sb
      .from('judges')
      .insert({ contest_id: c.id, round, display_order: ord, name })
      .select('id')
      .single();
    if (error) { console.error(`  judge insert err`, error); continue; }
    judgesByKey.set(key, data.id);
  }

  // 3) judge_votes 시드 — participants 행 스캔하면서 채움
  const voteRows = [];
  const finalScoreAgg = new Map(); // `${judgeId}:${num}` → { basic, conn, mus }
  for (const p of parts) {
    for (const [k, v] of Object.entries(p.meta ?? {})) {
      const cls = classifyKey(k);
      if (!cls) continue;
      const judgeId = judgesByKey.get(`${cls.round}:${cls.ord}`);
      if (!judgeId) continue;

      if (cls.round === 'prelim') {
        const mark = String(v).trim().toUpperCase();
        if (mark === 'O' || mark === 'X') {
          voteRows.push({ judge_id: judgeId, participant_num: p.num, vote_mark: mark });
        }
      } else if (cls.round === 'final') {
        const n = Number(v);
        if (!Number.isFinite(n)) continue;
        const aggKey = `${judgeId}:${p.num}`;
        let cur = finalScoreAgg.get(aggKey);
        if (!cur) { cur = { judge_id: judgeId, participant_num: p.num }; finalScoreAgg.set(aggKey, cur); }
        if (cls.item === '기본기') cur.basic_score = n;
        else if (cls.item === '연결성') cur.connectivity_score = n;
        else if (cls.item === '음악성') cur.musicality_score = n;
      }
    }
  }
  for (const row of finalScoreAgg.values()) voteRows.push(row);

  if (voteRows.length === 0) { console.log('  no votes to seed'); continue; }

  // 청크 upsert
  const CHUNK = 500;
  let upserted = 0;
  for (let i = 0; i < voteRows.length; i += CHUNK) {
    const slice = voteRows.slice(i, i + CHUNK);
    const { error } = await sb.from('judge_votes').upsert(slice, { onConflict: 'judge_id,participant_num' });
    if (error) { console.error(`  vote upsert err`, error); break; }
    upserted += slice.length;
  }
  console.log(`  ✓ votes upserted: ${upserted}`);
}

console.log('\n✓ done');
