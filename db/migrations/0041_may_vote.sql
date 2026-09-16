-- MAY 투표(0.5표) — 예선·본선에 중간 판정을 하나 더 둔다.
--
-- O/X 두 갈래만 있으면 심사위원이 줄 수 있는 값이 1 아니면 0 이라, 정원 경계에서
-- 같은 표를 받은 사람이 무더기로 생긴다. 실제 운영에서 동점자가 계속 늘어
-- 매번 헤드 심사위원 타이브레이크나 재심사로 풀어야 했다.
--
-- M(MAY) 은 0.5 표다. '올려도 되고 아니어도 되는' 참가자를 반 표로 표현할 수 있게
-- 되면서 같은 인원으로도 점수 분포가 두 배로 촘촘해진다.
--
-- 세 가지를 바꾼다.
--   1) judge_votes.vote_mark 에 'M' 허용
--   2) judges.max_may_votes — 심사위원이 줄 수 있는 M 표 상한. O 정원(max_votes)과
--      별개로 센다. 노란 표를 몇 장 줄지는 O 를 몇 장 줄지와 다른 결정이기 때문이다.
--   3) qualifiers.votes 를 정수 → numeric(6,1). 0.5 가 더해지면 합계가 12.5 처럼
--      나오는데 int 컬럼은 이를 13 으로 반올림해 저장해 버린다 — 동점을 피하려고
--      만든 값이 저장 단계에서 다시 동점으로 뭉개진다.
--
-- 기존 데이터는 그대로다: M 이 하나도 없으면 모든 집계가 예전과 같은 정수로 나온다.
-- idempotent.

-- 1) M 마크 허용 ──────────────────────────────────────────────────────────
alter table public.judge_votes
  drop constraint if exists judge_votes_vote_mark_check;

alter table public.judge_votes
  add constraint judge_votes_vote_mark_check
  check (vote_mark in ('O', 'M', 'X'));

comment on column public.judge_votes.vote_mark is
  '예선/본선 판정 — O(1표) · M(0.5표, MAY) · X(0표). null=미채점.';

-- 2) M 표 상한 ───────────────────────────────────────────────────────────
alter table public.judges
  add column if not exists max_may_votes int;

do $$
begin
  alter table public.judges
    add constraint judges_max_may_votes_range check (max_may_votes >= 0);
exception
  when duplicate_object then null;
end $$;

comment on column public.judges.max_may_votes is
  '이 라운드에서 줄 수 있는 최대 M(0.5표) 수. null = 제한 없음. max_votes(O 상한)와 별개.';

-- 3) 합계에 0.5 가 살아남게 ──────────────────────────────────────────────
-- 이미 numeric 이면 건너뛴다(재실행 안전).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'qualifiers'
      and column_name = 'votes' and data_type = 'integer'
  ) then
    alter table public.qualifiers
      alter column votes type numeric(6,1) using votes::numeric(6,1);
  end if;
end $$;

comment on column public.qualifiers.votes is
  '라운드 득표 합계. O=1 · M=0.5 로 더한 값이라 12.5 같은 반 표가 나올 수 있다.';
