-- 0002: participants 이름을 first_name / last_name 으로 분리 (2026-06).
--
-- 배경:
--   기존에는 participants.team_name 한 필드에 사람 이름을 보관했다.
--   이를 first_name / last_name 으로 나누고, 표출(DASH/결과/페어링)에는
--   last_name 만 노출한다.
--
-- 분류 규칙:
--   "Heidi Wong"        → first='Heidi', last='Wong'
--   "Mary Jane Watson"  → first='Mary',  last='Jane Watson'
--   "XY" (공백 없음)    → first='XY',    last='XY'   (둘 다 같은 값)
--
-- 설계:
--   team_name 컬럼은 삭제하지 않고 "표시명(=last_name)" 으로 의미를 재정의해 유지한다.
--   qualifiers / pairings / final_results 가 team_name(또는 *_name)을 생성 시점에
--   스냅샷 복사하므로, team_name = last_name 로 맞춰두면 표출/심사 코드를 수정하지
--   않아도 last name 만 표시된다.
--
-- 적용 방법 (0001 과 동일):
--   1) Supabase Dashboard → SQL Editor → 본 파일 내용 붙여넣기 → Run
--   2) 또는 supabase CLI: supabase db push
--   재실행 안전(idempotent) 하도록 작성됨.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) 컬럼 추가
-- ─────────────────────────────────────────────────────────────────────────
alter table public.participants
  add column if not exists first_name text not null default '',
  add column if not exists last_name  text not null default '';

-- ─────────────────────────────────────────────────────────────────────────
-- 2) 기존 team_name → first/last backfill
--    first/last 가 둘 다 비어있는 "신규" 행만 분해. (이전 0002 를 이미 돌렸다면
--    first/last 가 이미 차 있으므로 건너뛰고 아래 3) 에서 교정한다.)
-- ─────────────────────────────────────────────────────────────────────────
update public.participants p
set
  first_name = parts.first,
  last_name  = parts.last
from (
  select
    id,
    split_part(n, ' ', 1) as first,
    case
      when position(' ' in n) > 0
        then btrim(substr(n, position(' ' in n) + 1))   -- 첫 공백 뒤 전체
      else split_part(n, ' ', 1)                          -- 공백 없으면 first 와 동일
    end as last
  from (
    select id, btrim(regexp_replace(team_name, '\s+', ' ', 'g')) as n
    from public.participants
  ) z
) parts
where p.id = parts.id
  and coalesce(p.first_name, '') = ''
  and coalesce(p.last_name, '') = ''
  and coalesce(p.team_name, '') <> '';

-- ─────────────────────────────────────────────────────────────────────────
-- 3) 교정: 한 단어 이름(last 가 비어있는데 first 는 있음)은 last = first 로 미러.
--    (이전 0002 가 한 단어를 last='' 로 넣었던 경우를 바로잡는다.)
-- ─────────────────────────────────────────────────────────────────────────
update public.participants
set last_name = first_name
where coalesce(last_name, '') = ''
  and coalesce(first_name, '') <> '';

-- ─────────────────────────────────────────────────────────────────────────
-- 4) 표시명(team_name) = last_name 으로 통일
-- ─────────────────────────────────────────────────────────────────────────
update public.participants
set team_name = last_name
where team_name <> last_name;

-- ─────────────────────────────────────────────────────────────────────────
-- 5) 이미 생성된 스냅샷도 last name 으로 갱신 (진행 중/완료 대회 표출 일관성).
--    헬퍼 sentinel('—')은 건드리지 않는다.
-- ─────────────────────────────────────────────────────────────────────────
update public.qualifiers q
set team_name = p.last_name
from public.participants p
where p.contest_id = q.contest_id
  and p.num = q.participant_num
  and q.team_name <> p.last_name;

update public.final_results f
set team_name = p.last_name
from public.participants p
where p.contest_id = f.contest_id
  and p.num = f.participant_num
  and f.team_name <> p.last_name;

update public.pairings pr
set leader_name = p.last_name
from public.participants p
where p.contest_id = pr.contest_id
  and p.num = pr.leader_num
  and pr.leader_num <> '—'
  and pr.leader_name <> p.last_name;

update public.pairings pr
set follower_name = p.last_name
from public.participants p
where p.contest_id = pr.contest_id
  and p.num = pr.follower_num
  and pr.follower_num <> '—'
  and pr.follower_name <> p.last_name;
