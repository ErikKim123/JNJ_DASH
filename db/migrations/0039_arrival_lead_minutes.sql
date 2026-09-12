-- 참가자 도착 안내 시간 — '대회 시작 몇 분 전까지 오세요'.
--
-- 이 문구는 확인 메일과 신청 완료 화면 두 곳에 나가는데 숫자가 코드에 박혀 있었다.
-- 처음엔 30분, 지금은 1시간 — 바꿀 때마다 배포를 해야 했고, 대회마다 다르게 둘 수도 없었다.
-- 실제로는 대회 규모·장소에 따라 다르다(작은 배틀은 10분, 큰 페스티벌은 2시간).
--
-- 분 단위로 저장한다. 화면에서는 '1시간 30분 전' 처럼 읽기 좋게 풀어서 보여준다.
--
-- 기본값 60 — 적용 즉시 지금 나가는 문구('1시간 전')가 그대로 유지된다.
-- 범위 1~1440분(24시간): 오타로 큰 숫자가 들어가 '10080분 전' 같은 안내가 나가는 걸 막는다.
-- idempotent.

alter table public.contests
  add column if not exists arrival_lead_minutes int not null default 60;

do $$
begin
  alter table public.contests
    add constraint contests_arrival_lead_minutes_range
    check (arrival_lead_minutes between 1 and 1440);
exception
  when duplicate_object then null;
end $$;

comment on column public.contests.arrival_lead_minutes is
  '참가자 도착 안내 시간(분). 확인 메일·신청 완료 화면의 "대회 시작 N분 전" 문구에 쓴다.';
