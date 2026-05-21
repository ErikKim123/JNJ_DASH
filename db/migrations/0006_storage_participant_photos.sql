-- 참가자 사진 업로드용 Supabase Storage 버킷 + RLS 정책.
--
-- 코드 (app/api/admin/contests/[contestId]/photo-upload/route.ts) 에서
-- 버킷이 없으면 service_role 로 자동 생성하므로 본 마이그레이션은 선택사항이지만,
-- 운영용으로 명시 등록해두면 Dashboard 에서 즉시 식별 가능.
--
-- Supabase Dashboard → SQL Editor → 본 파일 내용 붙여넣기 → Run.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Bucket: participant-photos (public read)
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'participant-photos',
  'participant-photos',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) RLS: 누구나 SELECT(읽기) 가능, INSERT/UPDATE/DELETE 는 service_role 만.
--    service_role 키는 RLS 를 우회하므로 별도 INSERT 정책은 불필요.
-- ─────────────────────────────────────────────────────────────────────────
do $$ begin
  drop policy if exists "participant-photos public read" on storage.objects;
exception when undefined_object then null;
end $$;

create policy "participant-photos public read"
  on storage.objects
  for select
  using (bucket_id = 'participant-photos');
