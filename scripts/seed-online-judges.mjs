#!/usr/bin/env node
/**
 * 온라인 심사위원 시드 — 특정 대회에 N명의 온라인 심사위원을 생성.
 *
 * 사용:
 *   node scripts/seed-online-judges.mjs [contestId] [count]
 *   예: node scripts/seed-online-judges.mjs JNJ-999 120
 *
 * display_order 는 기존 최대값+1 부터 이어서 부여(충돌 방지).
 * PIN 은 4자리(고정 규칙: 번호를 4자리 zero-pad → 재현 가능/테스트 편의).
 */
import pg from 'pg';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const { Client } = pg;

async function loadDotenv() {
  const file = path.join(process.cwd(), '.env.local');
  try {
    const raw = await fs.readFile(file, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

function extractProjectRef(url) {
  const m = String(url || '').match(/^https?:\/\/([a-z0-9]{20,})\.supabase\.co/i);
  return m ? m[1] : null;
}

function buildClientConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  const poolerHost = process.env.SUPABASE_DB_POOLER_HOST || 'aws-0-ap-northeast-1.pooler.supabase.com';
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL 가 .env.local 에 필요합니다');
  if (!password) throw new Error('SUPABASE_DB_PASSWORD 가 .env.local 에 필요합니다');
  const ref = extractProjectRef(url);
  if (!ref) throw new Error(`Supabase URL 에서 project ref 추출 실패: ${url}`);
  return { host: poolerHost, port: 5432, user: `postgres.${ref}`, password, database: 'postgres', ssl: { rejectUnauthorized: false } };
}

// 데모용 이름 풀.
const FIRST = ['Alex', 'Sam', 'Chris', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Drew',
  'Min', 'Jae', 'Soo', 'Hana', 'Yuki', 'Haru', 'Lin', 'Wei', 'Diego', 'Sofia',
  'Luca', 'Marco', 'Elena', 'Nina', 'Pablo', 'Carla', 'Ivan', 'Olga', 'Ana', 'Leo'];
const LAST = ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Tanaka', 'Sato', 'Suzuki', 'Wang', 'Chen',
  'Garcia', 'Lopez', 'Rossi', 'Muller', 'Smith', 'Brown', 'Ivanov', 'Nguyen', 'Khan', 'Ramos',
  'Silva', 'Costa', 'Novak', 'Dubois', 'Meyer', 'Popov', 'Reyes', 'Cruz', 'Ferrari', 'Yamamoto'];
const COUNTRY = ['Korea', 'Japan', 'United States', 'Spain', 'Italy', 'Brazil', 'Colombia', 'France', 'Germany', 'Taiwan'];

async function main() {
  await loadDotenv();
  const contestId = process.argv[2] || 'JNJ-999';
  const count = Math.max(1, Number(process.argv[3] || 120));

  const client = new Client(buildClientConfig());
  await client.connect();
  try {
    const { rows: cRows } = await client.query('select id from public.contests where id = $1', [contestId]);
    if (cRows.length === 0) throw new Error(`대회를 찾을 수 없습니다: ${contestId}`);

    const { rows: mRows } = await client.query(
      'select coalesce(max(display_order), 0) as max from public.online_judges where contest_id = $1',
      [contestId],
    );
    let order = Number(mRows[0].max);

    const values = [];
    const params = [];
    for (let i = 0; i < count; i++) {
      order += 1;
      const first = FIRST[(order * 7) % FIRST.length];
      const last = LAST[(order * 13) % LAST.length];
      const country = COUNTRY[(order * 3) % COUNTRY.length];
      const pin = String(order % 10000).padStart(4, '0');
      const email = `ojudge${order}@demo.jnj`;
      const phone = `+82 10-${String(1000 + (order % 9000)).padStart(4, '0')}-${String(order % 10000).padStart(4, '0')}`;
      const b = params.length;
      values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9})`);
      params.push(contestId, order, first, last, last, country, email, phone, pin);
    }

    const sql = `insert into public.online_judges
      (contest_id, display_order, first_name, last_name, name, representative, email, phone, pin)
      values ${values.join(',')}`;
    await client.query(sql, params);

    console.log(`✓ ${contestId} 에 온라인 심사위원 ${count}명 생성 (display_order ${Number(mRows[0].max) + 1}..${order}).`);
    console.log(`  PIN 규칙: display_order 4자리 zero-pad (예: #${Number(mRows[0].max) + 1} → PIN ${String((Number(mRows[0].max) + 1) % 10000).padStart(4, '0')})`);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error('✗', e.message); process.exit(1); });
