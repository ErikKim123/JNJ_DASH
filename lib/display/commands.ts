// MC → 표출(프로젝터) 원격 명령 어휘. display-state 채널(contests.display_cmd)로 오간다.
//   refresh       : 표출의 "조회 / Refresh" 실행 (스텝 데이터 + 메타 재조회)
//   video:play    : 현재 VIDEO 스텝 플레이어 재생
//   video:pause   : 현재 VIDEO 스텝 플레이어 일시정지
//   video:restart : 처음(0초)으로 되감고 재생
//   overlay:1..3  : 현재 라운드의 추가 영상 N번을 전체화면 오버레이로 재생
//   overlay:close : 오버레이 닫기
//   reveal:next   : 결승 RESULT 다음 자리 발표 (표출 클릭과 동일)
//   reveal:reset  : 결승 RESULT 발표를 처음 상태로 되돌림
export const DISPLAY_COMMANDS = [
  'refresh',
  'video:play',
  'video:pause',
  'video:restart',
  'overlay:1',
  'overlay:2',
  'overlay:3',
  'overlay:close',
  'reveal:next',
  'reveal:reset',
] as const;

export type DisplayCommand = (typeof DISPLAY_COMMANDS)[number];

export function isDisplayCommand(v: unknown): v is DisplayCommand {
  return typeof v === 'string' && (DISPLAY_COMMANDS as readonly string[]).includes(v);
}
