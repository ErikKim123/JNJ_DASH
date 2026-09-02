-- 0037 의 "같은 페스티벌 대회 전체에 일괄 참여" 를 되돌린다.
--
-- 왜:
--   참여 행(online_judges)은 그 사람이 실제로 그 대회에서 심사할 때만 있어야 한다.
--   안 들어간 대회에까지 미리 행을 깔면 명단·결승 매트릭스가 심사하지 않을 사람으로
--   부풀고, "이 사람이 심사한 건가?" 를 행의 존재만으로는 알 수 없게 된다.
--
-- 이후 정책(앱):
--   계정(audience_judges)은 그대로 — 어느 대회에서든 같은 번호/PIN 으로 로그인한다.
--   참여 행은 등록하거나 그 대회에 로그인하는 순간 생긴다(ensureEnrollment).
--
-- 삭제 대상 한정:
--   0037 이 만든 행만. 기준은 0037 적용 시각 ±2분 안에 생겼고, 한 번도 채점하지 않은 행.
--   "같은 그룹에 더 오래된 참여가 있으면 삭제" 같은 데이터 기반 규칙은 쓰지 않는다 —
--   그 규칙은 본인이 직접 두 대회에 등록한 사람(예: BLF2026-3 의 Veena)까지 지운다.
--   채점 기록(online_judge_votes)이나 제출 시각이 있는 행은 어떤 경우에도 건드리지 않는다.

delete from public.online_judges oj
using public.schema_migrations sm
where sm.filename = '0037_audience_judges.sql'
  and oj.audience_judge_id is not null
  and oj.created_at between sm.applied_at - interval '2 minutes'
                        and sm.applied_at + interval '2 minutes'
  and oj.final_submitted_at is null
  and not exists (
    select 1 from public.online_judge_votes v where v.online_judge_id = oj.id
  );
