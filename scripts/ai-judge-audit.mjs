#!/usr/bin/env node
/**
 * AI Judge 절대 원칙 자체 감사 — design §9.4 / docs/rubric.md §1.2
 *
 * 사용: node scripts/ai-judge-audit.mjs
 *
 * 검사 대상: app/ajudge/, components/ai-judge/, lib/ai-judge/, worker/,
 *            db/migrations/0032_ai_judge.sql
 *
 * P1. AI 는 Timing 에만 점수를 부여한다
 *     → Timing 외 축의 점수 식별자 금지
 *     → COMMENTS_SCHEMA 에 number/integer 금지 (segment_index 예외)
 * P2. 모든 결과에 confidence 를 포함하고, low 면 지표를 숨긴다
 *     → confidence 산출은 worker/confidence.py 한 곳에서만
 * P3. 순위·합격/불합격 판정 로직을 만들지 않는다
 *     → rank / pass / winner / total_score 등 식별자 금지
 *
 * 위반이 있으면 exit 1.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const TARGETS = [
  'app/ajudge',
  'components/ai-judge',
  'lib/ai-judge',
  'worker',
  'db/migrations/0032_ai_judge.sql',
];

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.py', '.sql']);

// 스캔에서 제외 — 가상환경/캐시/모델/샘플/테스트 픽스처
const SKIP_DIRS = new Set([
  '.venv', '__pycache__', 'node_modules', '.pytest_cache',
  'models', 'samples', 'out', '.pip-tmp', '.pip-cache',
]);

// 테스트 파일은 금칙어를 "검사하기 위해" 담고 있으므로 제외한다.
const isTestFile = (p) => /(^|[\\/])tests?[\\/]|test_.*\.(py|ts)$|\.test\.(ts|tsx|js)$/.test(p);

/** P3 — 순위·합불 식별자. 단어 경계로 매칭해 오탐을 줄인다. */
const P3_PATTERNS = [
  /\brank(ing)?\b/i,
  /\bis_?pass(ed)?\b/i,
  /\bpass_?fail\b/i,
  /\bqualified\b/i,
  /\bwinner\b/i,
  /\btotal_?score\b/i,
  /\bfinal_?score\b/i,
  /\bplacement\b/i,
];

/** P1 — Timing 외 축의 점수 식별자. */
const P1_PATTERNS = [
  /\btechnique_?score\b/i,
  /\bteamwork_?score\b/i,
  /\bmusicality_?score\b/i,
  /\bsync_?score\b/i,
  /\bactivity_?score\b/i,
];

/** 주석/문서 문장에서의 언급은 위반이 아니다(원칙을 설명하는 문장이 많다). */
function stripComments(text, ext) {
  if (ext === '.py') {
    return text
      .replace(/"""[\s\S]*?"""/g, '')
      .replace(/'''[\s\S]*?'''/g, '')
      .replace(/^[ \t]*#.*$/gm, '')
      .replace(/[ \t]#.*$/gm, '');
  }
  if (ext === '.sql') {
    return text.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  }
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/[ \t]\/\/.*$/gm, '');
}

async function* walk(target) {
  const abs = path.join(ROOT, target);
  let st;
  try {
    st = await fs.stat(abs);
  } catch {
    return; // 아직 만들지 않은 디렉터리(사이클 2에서 생성) — 통과
  }
  if (st.isFile()) {
    yield abs;
    return;
  }
  const entries = await fs.readdir(abs, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(path.join(target, e.name));
    } else if (CODE_EXT.has(path.extname(e.name))) {
      yield path.join(abs, e.name);
    }
  }
}

const violations = [];
const notes = [];

function scan(rel, text, ext) {
  const code = stripComments(text, ext);
  const lines = code.split(/\r?\n/);

  lines.forEach((line, i) => {
    for (const re of P3_PATTERNS) {
      if (re.test(line)) {
        violations.push({ principle: 'P3', file: rel, line: i + 1, text: line.trim(), re: String(re) });
      }
    }
    for (const re of P1_PATTERNS) {
      if (re.test(line)) {
        violations.push({ principle: 'P1', file: rel, line: i + 1, text: line.trim(), re: String(re) });
      }
    }
  });
}

/** P1 보강 — COMMENTS_SCHEMA 에 허용되지 않은 숫자 타입이 없는지. */
function auditCommentsSchema(rel, text) {
  const start = text.indexOf('COMMENTS_SCHEMA');
  if (start < 0) return;
  const region = text.slice(start);
  const numeric = [...region.matchAll(/"type"\s*:\s*"(number|integer)"/g)];
  const segIdx = (region.match(/segment_index/g) || []).length;
  if (numeric.length > segIdx) {
    violations.push({
      principle: 'P1',
      file: rel,
      line: 0,
      text: `COMMENTS_SCHEMA 에 숫자 필드 ${numeric.length}개 (segment_index ${segIdx}개만 허용)`,
      re: 'schema-numeric',
    });
  } else {
    notes.push(`P1: COMMENTS_SCHEMA 숫자 필드 ${numeric.length}개 = segment_index 전용 ✓`);
  }
}

/** P2 보강 — confidence 산출이 한 곳에서만 이뤄지는지. */
function auditConfidenceOwnership(files) {
  const owners = files.filter(
    (f) => /def compute_confidence/.test(f.text) || /function computeConfidence/.test(f.text),
  );
  if (owners.length === 0) {
    violations.push({
      principle: 'P2', file: '-', line: 0,
      text: 'confidence 산출 함수를 찾지 못했습니다', re: 'missing-owner',
    });
  } else if (owners.length > 1) {
    violations.push({
      principle: 'P2', file: owners.map((o) => o.rel).join(', '), line: 0,
      text: `confidence 산출처가 ${owners.length}곳입니다. 단일 산출처여야 합니다`,
      re: 'multiple-owners',
    });
  } else {
    notes.push(`P2: confidence 단일 산출처 = ${owners[0].rel} ✓`);
  }
}

/** P3 보강 — 마이그레이션 스키마에 순위/합불 컬럼이 없는지. */
function auditSchemaColumns(rel, text) {
  const banned = /^\s*(rank|ranking|pass|is_pass|passed|qualified|winner|total_score|total)\s+/gim;
  const hits = [...text.matchAll(banned)];
  if (hits.length) {
    violations.push({
      principle: 'P3', file: rel, line: 0,
      text: `순위/합불 컬럼 의심: ${hits.map((h) => h[1]).join(', ')}`, re: 'schema-column',
    });
  } else {
    notes.push(`P3: ${rel} 에 순위/합불 컬럼 없음 ✓`);
  }
}

// ─────────────────────────────────────────────────────────────────
const collected = [];
for (const t of TARGETS) {
  for await (const abs of walk(t)) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    if (isTestFile(rel)) continue;
    const text = await fs.readFile(abs, 'utf8');
    const ext = path.extname(abs);
    collected.push({ rel, text, ext });
    scan(rel, text, ext);
    if (rel.endsWith('comments.py')) auditCommentsSchema(rel, text);
    if (rel.endsWith('0032_ai_judge.sql')) auditSchemaColumns(rel, text);
  }
}

auditConfidenceOwnership(collected);

console.log(`▶ AI Judge 절대 원칙 감사 — 파일 ${collected.length}개 스캔`);
for (const n of notes) console.log(`  ✓ ${n}`);

if (violations.length === 0) {
  console.log('\n✅ 절대 원칙 위반 0건');
  process.exit(0);
}

console.log(`\n❌ 위반 ${violations.length}건`);
for (const v of violations) {
  const loc = v.line ? `${v.file}:${v.line}` : v.file;
  console.log(`  [${v.principle}] ${loc}\n      ${v.text}\n      (패턴 ${v.re})`);
}
console.log('\n원칙: docs/rubric.md §1.2 — 위반을 고치거나, 정당한 예외라면 감사 스크립트에 명시적 허용을 추가하세요.');
process.exit(1);
