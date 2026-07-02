-- 온라인 심사위원이 참여하는 라운드(예선/본선/결승) 선택.
--   contests.online_judge_rounds — jsonb string[] ('prelim'|'semi'|'final').
--   기본값은 결승만(현재 온라인 결승 심사만 구현). 운영자가 대회 정보에서 체크박스로 조정.
alter table public.contests
  add column if not exists online_judge_rounds jsonb
    not null
    default '["final"]'::jsonb;

do $$ begin
  alter table public.contests
    add constraint contests_online_judge_rounds_is_array
    check (jsonb_typeof(online_judge_rounds) = 'array');
exception when duplicate_object then null;
end $$;
