// 대회 아이콘(로고) — 모든 디자인 템플릿 공통. 표출 화면 상단 중앙에 얹는다.
//
// 각 템플릿의 shell() 은 content 뒤에 <!--ICON_SLOT--> 마커를 두고(=콘텐츠 위에 그려짐),
// index.ts 가 applyContestIcon() 으로 마커를 <image> 로 치환한다.
// 배치 좌표(ICON_RECT)는 템플릿마다 헤더 위치가 달라 각 index.ts 에서 넘긴다.

export const ICON_SLOT = '<!--ICON_SLOT-->';

/** 아이콘이 들어갈 박스. 이미지는 이 박스 안에서 비율 유지로 축소(meet)된다. */
export interface IconRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * <!--ICON_SLOT--> 를 아이콘 <image> 로 치환. url 이 비면 마커만 제거한다.
 * 로고는 가로/세로 비율이 제각각이므로 xMidYMid meet 으로 박스 안에 맞춘다.
 */
export function applyContestIcon(
  svg: string,
  rect: IconRect,
  url?: string,
  opacityPct?: number
): string {
  if (!url) return svg.replace(ICON_SLOT, '');
  const safe = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const clamped = Math.max(
    0,
    Math.min(100, typeof opacityPct === 'number' && !Number.isNaN(opacityPct) ? opacityPct : 100)
  );
  const img =
    `<image href="${safe}" x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" ` +
    `preserveAspectRatio="xMidYMid meet" opacity="${(clamped / 100).toString()}"/>`;
  return svg.replace(ICON_SLOT, img);
}
