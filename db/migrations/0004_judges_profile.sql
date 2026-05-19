-- 심사위원 프로필 확장 — 시트 "2.심사위원" 의 모든 필드를 DB 에 보존.
--
-- 매핑:
--   심사위원명        → judges.name       (기존)
--   메인/활동명       → judges.alias      (신규)
--   전문 장르         → judges.specialty  (신규)
--   주요 경력         → judges.career     (신규)
--   연락처            → judges.phone      (신규)
--   이메일            → judges.email      (신규)
--   비고              → judges.memo       (신규)
--   예선/본선 투표 max → judges.max_votes (라운드별 row 이므로 한 컬럼)
--   대상 (리더/팔로워/모두) → judges.target_role (신규)
--
-- target_role 은 그 심사위원이 평가할 대상 — both 가 기본값. 운영자가 "리더 전담" 같은 분담 설정 시 사용.

do $$ begin
  create type judge_target_role as enum ('leader','follower','both');
exception when duplicate_object then null;
end $$;

alter table public.judges
  add column if not exists alias text not null default '',
  add column if not exists specialty text not null default '',
  add column if not exists career text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists email text not null default '',
  add column if not exists memo text not null default '',
  add column if not exists max_votes int,
  add column if not exists target_role judge_target_role not null default 'both';
