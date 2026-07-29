// MC → 표출(프로젝터) 원격 명령 어휘. display-state 채널(contests.display_cmd)로 오간다.
//   refresh     : 표출의 "조회 / Refresh" 실행 (스텝 데이터 + 메타 재조회)
//   video:play  : 현재 VIDEO 스텝 플레이어 재생
//   video:pause : 현재 VIDEO 스텝 플레이어 일시정지
export const DISPLAY_COMMANDS = ['refresh', 'video:play', 'video:pause'] as const;

export type DisplayCommand = (typeof DISPLAY_COMMANDS)[number];

export function isDisplayCommand(v: unknown): v is DisplayCommand {
  return typeof v === 'string' && (DISPLAY_COMMANDS as readonly string[]).includes(v);
}
