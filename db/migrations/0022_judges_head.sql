-- 헤드(타이브레이커) 심사위원 플래그.
-- 경계 동점 시 추려내기에서 이 심사위원이 O 준 후보를 우선 자동 선택한다(운영자 확인).
-- 집계에는 일반 심사위원처럼 그대로 포함. 대회당 1명만 true 로 운영(앱에서 단일 보장).
alter table public.judges
  add column if not exists is_head boolean not null default false;
