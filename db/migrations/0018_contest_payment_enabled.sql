-- 대회 참가비 결제 버튼 활성/비활성 토글.
--   true  → done 화면·확인 메일에 결제 버튼 노출 (URL 이 유효할 때)
--   false → 결제 버튼 자체를 렌더하지 않음(완전 숨김)
-- 기존 대회는 결제 버튼을 유지하도록 기본값 true.
alter table public.contests
  add column if not exists payment_enabled boolean not null default true;
