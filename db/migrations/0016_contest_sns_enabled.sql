-- 대회 SNS 방 참여 버튼 활성/비활성 토글.
--   true  → done 화면에 참여 버튼 노출
--   false → 버튼 자체를 렌더하지 않음(완전 숨김)
alter table public.contests
  add column if not exists sns_enabled boolean not null default false;
