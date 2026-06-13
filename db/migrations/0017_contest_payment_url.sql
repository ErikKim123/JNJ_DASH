-- 대회 참가비 결제 페이지 링크.
-- 등록 완료 화면(done)과 확인 메일에서 "참가비 결제하기 / Make Your Payment" 버튼으로 노출.
--   비어있으면 버튼 숨김, URL 이 있으면 새 탭으로 결제 페이지 이동.
-- 기존 대회 호환을 위해 기존 하드코딩 결제 URL 을 기본값으로 채운다.
alter table public.contests
  add column if not exists payment_url text not null
  default 'https://phuquocsummerlatinfest.com/jj-competition-battle-2026';
