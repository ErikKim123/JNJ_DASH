-- 심사위원 영상소개 스텝(예선 JUDGES 다음)의 영상 URL.
-- 표출 화면에서 직접 재생되는 mp4 등 영상파일 직접 링크. 비어있으면 "영상 미설정" 안내 슬라이드 표출.
alter table public.contests
  add column if not exists judges_video_url text not null default '';
