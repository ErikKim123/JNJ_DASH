-- 대회 상태에 'closed'(마감) 추가 — 준비(ready)와 진행 중(live) 사이.
-- 접수를 마감했지만 아직 진행 전인 상태. 접수 게이팅은 기존 'ready 외 차단' 로직으로 그대로 막힘.
alter table public.contests drop constraint if exists contests_status_check;
alter table public.contests
  add constraint contests_status_check
  check (status in ('ready','closed','live','done','archived'));
