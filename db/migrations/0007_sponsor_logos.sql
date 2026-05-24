-- PREP 화면 하단 광고/스폰서 로고 6개.
-- contests.sponsor_logos: text[] (최대 6개 public URL).
-- contest-sponsors 버킷: 코드(/api/admin/contests/[contestId]/sponsor-upload)에서 자동 생성하지만
-- 운영용으로 명시 등록.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) contests.sponsor_logos 컬럼 추가
-- ─────────────────────────────────────────────────────────────────────────
alter table public.contests
  add column if not exists sponsor_logos text[] not null default '{}';

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Storage Bucket: contest-sponsors (public read)
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contest-sponsors',
  'contest-sponsors',
  true,
  3145728, -- 3MB (로고는 작아야 함)
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) RLS: 공개 SELECT, INSERT/UPDATE/DELETE 는 service_role 만
-- ─────────────────────────────────────────────────────────────────────────
do $$ begin
  drop policy if exists "contest-sponsors public read" on storage.objects;
exception when undefined_object then null;
end $$;

create policy "contest-sponsors public read"
  on storage.objects
  for select
  using (bucket_id = 'contest-sponsors');
