-- JOIN APP 톤앤매너 — 프리셋 테마 확장.
-- 0013 에서 join_theme 을 'light'|'dark' 로 제한했으나, 프리셋 테마(midnight/forest/ocean ...)를
-- 추가하면서 자유 키로 전환. 허용값 검증은 API(lib/join/theme.ts JOIN_PRESET_KEYS)에서 수행.
-- 기본값은 0013 의 'dark' 유지.

alter table public.contests
  drop constraint if exists contests_join_theme_chk;
