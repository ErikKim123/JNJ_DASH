-- MC 원격 명령 채널 — MC 콘솔이 표출(프로젝터) 화면에 1회성 동작을 지시한다.
--   display_cmd    : 명령 문자열. 'refresh' | 'video:play' | 'video:pause'
--   display_cmd_at : 발행 시각. 같은 명령을 다시 눌러도 시각이 바뀌므로 표출이 재실행한다.
-- 표출은 공개 GET /api/contests/[id]/display-state 폴링으로 받는다.
alter table public.contests
  add column if not exists display_cmd    text,
  add column if not exists display_cmd_at timestamptz;
