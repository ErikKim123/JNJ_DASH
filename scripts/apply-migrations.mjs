#!/usr/bin/env node
/**
 * Supabase Postgres 마이그레이션 자동 적용 스크립트.
 *
 * 사용:
 *   npm run db:migrate            - db/migrations/*.sql 전체 적용
 *   node scripts/apply-migrations.mjs --list   - 적용 이력만 표시
 *
 * 동작:
 *   1) .env.local 읽기 → SUPABASE_DB_PASSWORD / NEXT_PUBLIC_SUPABASE_URL 추출
 *   2) URL 에서 project ref 추출 → pooler 사용자 'postgres.<ref>' 구성
 *   3) public.schema_migrations 테이블이 없으면 생성 (적용 이력 추적)
 *   4) db/migrations/*.sql 을 파일명 순서로 읽어, 이미 적용된 건 건너뜀
 *   5) 각 파일은 트랜잭션 안에서 실행 (실패 시 자동 롤백)
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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

function extractProjectRef(url) {
  // https://wpahhleendnsewuptrhm.supabase.co → wpahhleendnsewuptrhm
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
  // pooler session-mode(5432) — DDL/prepared statements 안정성.
  // ssl: rejectUnauthorized=false — Supabase pooler 는 자체 인증서 체인 사용.
  return {
    host: poolerHost,
    port: 5432,
    user: `postgres.${ref}`,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  };
}

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now(),
      checksum text
    );
  `);
}

async function listApplied(client) {
  const { rows } = await client.query(`select filename, applied_at from public.schema_migrations order by filename`);
  return rows;
}

async function main() {
  await loadDotenv();
  const args = process.argv.slice(2);
  const listOnly = args.includes('--list');

  const cfg = buildClientConfig();
  console.log(`▶ 연결: postgresql://${cfg.user}:***@${cfg.host}:${cfg.port}/${cfg.database}`);

  const client = new Client(cfg);
  await client.connect();

  try {
    await ensureMigrationsTable(client);

    if (listOnly) {
      const rows = await listApplied(client);
      if (!rows.length) {
        console.log('적용된 마이그레이션이 없습니다.');
      } else {
        console.log('적용 이력:');
        for (const r of rows) console.log(`  ✓ ${r.filename}  (${r.applied_at.toISOString()})`);
      }
      return;
    }

    const migrationsDir = path.join(process.cwd(), 'db', 'migrations');
    const files = (await fs.readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (!files.length) {
      console.log('db/migrations/ 에 .sql 파일이 없습니다.');
      return;
    }

    const applied = new Set((await listApplied(client)).map((r) => r.filename));
    let appliedNow = 0;

    for (const f of files) {
      if (applied.has(f)) {
        console.log(`  · ${f} (이미 적용됨)`);
        continue;
      }
      const sql = await fs.readFile(path.join(migrationsDir, f), 'utf8');
      console.log(`▶ ${f} 적용 중...`);
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query(
          'insert into public.schema_migrations (filename) values ($1)',
          [f]
        );
        await client.query('commit');
        appliedNow++;
        console.log(`  ✓ ${f} 적용 완료`);
      } catch (e) {
        await client.query('rollback').catch(() => {});
        // verbose error 위치 표시
        const where = e.where || e.internalQuery || '';
        const detail = e.detail || '';
        const position = e.position ? ` (position ${e.position})` : '';
        console.error(`  ✗ ${f} 실패: ${e.message}${position}`);
        if (detail) console.error(`     detail: ${detail}`);
        if (where) console.error(`     where: ${where.slice(0, 400)}`);
        throw e;
      }
    }

    if (appliedNow === 0) {
      console.log('\n✓ 모든 마이그레이션이 이미 적용되어 있습니다.');
    } else {
      console.log(`\n✓ ${appliedNow}개 마이그레이션을 새로 적용했습니다.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('\n✗ 마이그레이션 실패:', e.message);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
});
