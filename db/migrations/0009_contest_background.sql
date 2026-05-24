-- 대회별 배경 이미지 (모든 화면 공통). 비어있으면 디자인 템플릿 기본 배경 사용.
-- contest-backgrounds 버킷: 코드 (/api/admin/contests/[contestId]/background-upload) 에서 자동 생성하지만
-- 운영용으로 명시 등록.

alter table public.contests
  add column if not exists background_image text not null default '';

-- ─────────────────────────────────────────────────────────────────────────
-- Storage Bucket: contest-backgrounds (public read, 8MB — 배경은 고해상도)
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contest-backgrounds',
  'contest-backgrounds',
  true,
  8388608, -- 8MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  drop policy if exists "contest-backgrounds public read" on storage.objects;
exception when undefined_object then null;
end $$;

create policy "contest-backgrounds public read"
  on storage.objects
  for select
  using (bucket_id = 'contest-backgrounds');
