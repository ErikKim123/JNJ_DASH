-- 심사위원 사진 — participant-photos 와 동일 패턴.
--   judges.photo_url 컬럼은 통합 명단의 mirror 대상이므로
--   같은 (contest_id, display_order) 의 3 row (prelim/semi/final) 가 항상 동일한 URL 을 갖는다.
--   업로드/삭제는 /api/admin/contests/[id]/judge-photo-upload + judges PATCH 에서 처리.
--
-- 저장소는 participant-photos 버킷을 그대로 재사용 (이미 public read 정책 적용됨).
--   파일 경로 prefix: `${contestId}/judges/${judgeDisplayOrder}-${ts}.${ext}`

alter table public.judges
  add column if not exists photo_url text not null default '';
