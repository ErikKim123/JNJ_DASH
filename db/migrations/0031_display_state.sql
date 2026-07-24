-- MC 모바일 진행 콘솔 — 공유 "표출 포인터".
--   MC 폰이 현재 표출할 라운드/스텝을 여기에 기록하면, 프로젝터(대시보드)가
--   폴링해 따라간다. 기존 round_status(prep|pairing|…|result, 7단계)는 vote/ojudge 앱이
--   이미 그 의미로 소비 중이라 재사용하지 않고, 대시보드의 13-step StepKey 를
--   그대로 담는 별도 포인터를 둔다.
--
--   display_round : 'prelim' | 'semi' | 'final' (lib/sheets/types.ts ROUND_KEYS)
--   display_step  : StepKey (prep|judgesIntro|…|report) — 값 화이트리스트는 API(zod)에서.
--   값 검증은 애플리케이션 레이어에서 하므로 여기서는 자유 text (nullable).
--   contests 는 이미 anon SELECT 허용 → 프로젝터가 공개로 읽는다.

alter table public.contests
  add column if not exists display_round      text,
  add column if not exists display_step       text,
  add column if not exists display_updated_at timestamptz;
