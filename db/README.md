# DB 마이그레이션 (Phase 1)

시트 중심 → DB 중심 전환의 첫 단계. Supabase Postgres 사용.

## 1) 스키마 적용

**옵션 A — 자동 마이그레이션 스크립트 (권장)**

```bash
npm run db:migrate     # db/migrations/*.sql 자동 적용. 재실행 안전.
npm run db:status      # 적용 이력 조회
```

스크립트는 `.env.local` 의 `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_DB_PASSWORD` 로 Supabase pooler 에 직접 연결합니다. `public.schema_migrations` 테이블에 이력을 기록해 같은 파일을 두 번 적용하지 않습니다.

**옵션 B — Supabase Dashboard 수동**

1. https://supabase.com → 프로젝트 → SQL Editor
2. `db/migrations/0001_initial.sql` 내용 복사 → 붙여넣기 → **Run**

**옵션 C — psql 직접**

```bash
psql "postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require" \
  -f db/migrations/0001_initial.sql
```

## 2) 시트 → DB 데이터 이전

마이그레이션 SQL 적용 직후 실행. 모든 단계가 idempotent — 안심하고 여러 번 돌려도 됨.

```bash
# 전체 대회(001/002/003) 일괄 import
npm run import:sheets

# 특정 대회만
node scripts/import-from-sheets.mjs JNJ-001

# 이미 DB 에 있는 대회는 건너뜀
npm run import:sheets:skip-existing
```

출력 예시:
```
▶ 대회목록 시트 로드: 1bRclkuN8fuSf... (gid=2102151233)
✓ 3개 대회 발견: JNJ-001, JNJ-002, JNJ-003

━━━ [JNJ-001] 13TH JEJU LATIN ... ━━━
  ✓ contests upsert (template=1, prelim=10, semi=5)
  ✓ participants: 87건
  ✓ pairings prelim: 30건 (confirmed)
  ✓ pairings semi: 10건 (confirmed)
  ✓ qualifiers prelim: 20건
  ✓ qualifiers semi: 10건
  ✓ final_results: 6건
```

## 3) 검증 쿼리

Supabase SQL Editor 에서 실행:

```sql
-- 대회 수
select count(*) from contests;

-- 대회별 데이터량 요약
select
  c.id, c.name,
  (select count(*) from participants p where p.contest_id = c.id) as participants,
  (select count(*) from pairings pa where pa.contest_id = c.id and pa.round='prelim') as prelim_pairs,
  (select count(*) from pairings pa where pa.contest_id = c.id and pa.round='semi') as semi_pairs,
  (select count(*) from qualifiers q where q.contest_id = c.id and q.round='prelim' and q.passed) as prelim_qualified,
  (select count(*) from qualifiers q where q.contest_id = c.id and q.round='semi' and q.passed) as semi_qualified,
  (select count(*) from final_results f where f.contest_id = c.id) as finals
from contests c
order by c.id;
```

## 4) 다음 단계 (Phase 2 / Phase 3)

| Phase | 내용 |
|-------|------|
| **2** | `/admin` 자료운영 UI — 대회/참가자/페어링/통과자/결승 CRUD. 페어링 셔플·확정·리페어링. ADMIN_PIN 보호. |
| **3** | 표출 화면(`app/api/contests/...`)을 시트 → DB 로 전환. `lib/sheets/` 폐기. |

## 테이블 요약

| 테이블 | 행 | 시트 출처 |
|--------|-----|----------|
| `contests` | 대회 1건 | 대회목록 + 1.대회정보 |
| `participants` | 참가자 1명 | 3.참가자 |
| `pairings` | 페어 1건 (round 별) | 3-1.예선랜덤, 4-1.본선랜덤 |
| `qualifiers` | 통과자 1명 (round 별) | 4.예선통과, 5.본선통과 |
| `final_results` | 결승 결과 1행 | 6.결승 |

### 핵심 동작
- **pairings.status**: `draft` (셔플만) / `confirmed` (운영자가 확정). 표출은 `confirmed` 만. 리페어링 = status 를 `draft` 로 되돌리고 재셔플.
- **participants.role**: `leader` / `follower` / `helper_leader` / `helper_follower`. 헬퍼는 페어링 부족분 채우는 용도.
- **RLS**: anon 키는 표출용 SELECT 만 가능. 운영 변경은 service_role 키 (서버 전용).
