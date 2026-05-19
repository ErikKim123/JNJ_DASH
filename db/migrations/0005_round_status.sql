-- 라운드별 상태 컨트롤 — 시트의 라운드별 드롭다운 대체.
-- 기존에 round_status enum 이 (prep|pairing|open|live|calculate|close|result) 로 정의돼 있어
-- 그 값들을 그대로 사용. 표출 화면 step 흐름과 1:1 매칭.

do $$ begin
  create type round_status as enum (
    'prep','pairing','open','live','calculate','close','result'
  );
exception when duplicate_object then null;
end $$;

alter table public.contests
  add column if not exists prelim_status round_status not null default 'prep',
  add column if not exists semi_status   round_status not null default 'prep',
  add column if not exists final_status  round_status not null default 'prep';
