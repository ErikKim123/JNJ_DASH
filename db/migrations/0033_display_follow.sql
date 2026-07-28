-- MC 콘솔에서 "MC 따라가기"를 원격으로 켜고 끄기 위한 플래그.
--   display_follow    : MC 가 프로젝터(대시보드)를 끌고 갈지 여부.
--   display_follow_at : 마지막 토글 시각. 대시보드는 이 값이 바뀔 때마다 원격 지시를 1회 적용한다.
--                       (같은 값을 다시 눌러도 시각이 바뀌므로 재적용이 보장된다.)
--   contests 는 이미 anon SELECT 허용 → 프로젝터가 공개 GET 으로 함께 읽는다.

alter table public.contests
  add column if not exists display_follow    boolean not null default false,
  add column if not exists display_follow_at timestamptz;
