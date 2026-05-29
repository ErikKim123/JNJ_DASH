-- 대회 SNS 방(오픈채팅/커뮤니티) 링크.
-- 등록 완료 화면(done)에서 "SNS 방 참여" 버튼으로 노출.
--   비어있으면 버튼 비활성(준비중), URL 이 있으면 활성화되어 새 탭으로 방 참여.
alter table public.contests
  add column if not exists sns_url text not null default '';
