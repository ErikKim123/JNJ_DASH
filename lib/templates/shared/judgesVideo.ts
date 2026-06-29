// 심사위원 소개 영상 (예선 JUDGES 다음 스텝) 의 공용 콘텐츠 SVG.
// 3개 디자인 템플릿(01/02/03) 모두 공유.
//
// 표출 화면이 video_url 의 영상파일(mp4 등)을 SVG <foreignObject> 안의 HTML <video> 로 직접 재생.
// (SVG 문자열은 dangerouslySetInnerHTML 로 HTML 파서가 해석 → foreignObject 가 HTML 통합 지점이라
//  내부 <video> 가 정상 동작. ScalingFrame 의 16:9 스케일/풀스크린에도 그대로 따라감.)
//
// 헤더/타이틀/푸터 없이 영상만 거의 전체 화면(1280×720)으로 크게 표출.
// video_url 이 비어있으면 점선 박스 + "영상 미설정" 안내를 표출.

export interface JudgesVideoLayoutOpts {
  /** 재생할 영상파일 URL. 빈 문자열이면 안내 슬라이드. */
  videoUrl: string;
}

/** 속성값(href/src)에 안전하게 인라인하기 위한 escape — xmlEscape 와 달리 따옴표까지 처리. */
function escapeAttr(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 영상 영역 — 16:9 비율을 유지하며 1280×720 프레임을 거의 가득 채움.
const VIDEO_H = 660; // 680 → 660 (상·하 약 3% 축소)
const VIDEO_W = Math.round((VIDEO_H * 16) / 9); // 1173
const VIDEO_X = Math.round((1280 - VIDEO_W) / 2); // 54
const VIDEO_Y = Math.round((720 - VIDEO_H) / 2); // 30 (세로 중앙 유지)

/** 골드 라운드 프레임 (영상/안내 박스 공통 테두리). */
function goldFrame(): string {
  return `
    <rect x="${VIDEO_X - 6}" y="${VIDEO_Y - 6}" width="${VIDEO_W + 12}" height="${VIDEO_H + 12}"
          rx="14" fill="none" stroke="url(#goldg)" stroke-width="1.6" opacity="0.85"/>
    <rect x="${VIDEO_X - 2}" y="${VIDEO_Y - 2}" width="${VIDEO_W + 4}" height="${VIDEO_H + 4}"
          rx="10" fill="none" stroke="#D4AF37" stroke-width="0.5" opacity="0.5"/>
  `;
}

/** 영상 미설정 안내 슬라이드. */
function emptyState(): string {
  const cx = 640;
  const cy = VIDEO_Y + VIDEO_H / 2;
  return `
    <rect x="${VIDEO_X}" y="${VIDEO_Y}" width="${VIDEO_W}" height="${VIDEO_H}"
          rx="10" fill="#0A0A0A" fill-opacity="0.55"
          stroke="#D4AF37" stroke-width="1" stroke-dasharray="8 8" stroke-opacity="0.5"/>
    <g transform="translate(${cx} ${cy - 40})" fill="none" stroke="url(#goldg)" stroke-width="2.4">
      <circle r="40" opacity="0.7"/>
      <path d="M -13 -20 L 22 0 L -13 20 Z" fill="#D4AF37" stroke="none" opacity="0.85"/>
    </g>
    <text x="${cx}" y="${cy + 40}" text-anchor="middle"
          font-family="'Gulim', '굴림', 'Cormorant Garamond', Georgia, sans-serif"
          font-size="24" letter-spacing="2" fill="#FFEBA0" font-weight="700">영상이 설정되지 않았습니다</text>
    <text x="${cx}" y="${cy + 70}" text-anchor="middle"
          font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif"
          font-style="italic" font-size="16" fill="#D4AF37" opacity="0.8" letter-spacing="2">
      Judge introduction video not set
    </text>
  `;
}

/**
 * 입력값을 브라우저가 재생 가능한 src 로 정규화.
 *  - http(s):// 또는 / 로 시작 → 이미 URL → 그대로.
 *  - 그 외(로컬 파일경로 Z:\... 등) → /api/video?file=<인코딩> 로 변환해 로컬 파일 스트리밍.
 */
export function resolveVideoSrc(raw: string): string {
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw;
  return `/api/video?file=${encodeURIComponent(raw)}`;
}

/**
 * 영상 영역의 1280×720 좌표를 비율(%)로 노출 — TemplateRenderer 가 foreignObject 위에
 * 실제 HTML <video> 오버레이를 같은 위치로 겹쳐 그릴 때 사용 (foreignObject 내부 video 는
 * Chromium 에서 오디오가 안 나오는 제약이 있어, 소리 재생용 실제 video 를 덧댄다).
 */
export const VIDEO_RECT_PCT = {
  left: (VIDEO_X / 1280) * 100,
  top: (VIDEO_Y / 720) * 100,
  width: (VIDEO_W / 1280) * 100,
  height: (VIDEO_H / 720) * 100,
} as const;

/**
 * YouTube 링크에서 영상 ID(11자) 추출. watch?v= / youtu.be / embed / shorts / live 형태 지원.
 * YouTube 링크가 아니면 null.
 */
export function parseYouTubeId(raw: string): string | null {
  const url = (raw ?? '').trim();
  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/i,
    /youtu\.be\/([\w-]{11})/i,
    /youtube\.com\/embed\/([\w-]{11})/i,
    /youtube\.com\/shorts\/([\w-]{11})/i,
    /youtube\.com\/live\/([\w-]{11})/i,
  ];
  for (const p of patterns) {
    const m = p.exec(url);
    if (m) return m[1];
  }
  return null;
}

/** YouTube 링크면 임베드 URL(iframe src) 반환, 아니면 null. */
export function youTubeEmbedUrl(raw: string): string | null {
  const id = parseYouTubeId(raw);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}

/** 영상 플레이어 (foreignObject + HTML video). */
function videoPlayer(url: string): string {
  const src = escapeAttr(resolveVideoSrc(url));
  // controls: 운영자가 재생/일시정지/볼륨 조절. autoplay 는 브라우저 정책상 음성과 함께면 막힐 수 있어
  //   재생 버튼으로 시작하는 것을 기본 동작으로 둔다. playsinline 로 전체화면 강제 진입 방지.
  return `
    <foreignObject x="${VIDEO_X}" y="${VIDEO_Y}" width="${VIDEO_W}" height="${VIDEO_H}">
      <video xmlns="http://www.w3.org/1999/xhtml"
             src="${src}"
             controls playsinline preload="metadata"
             style="width:100%;height:100%;object-fit:contain;background:#000;border-radius:10px;display:block;">
      </video>
    </foreignObject>
  `;
}

/**
 * 메인 빌더 — videoUrl 유무에 따라 플레이어/안내 슬라이드를 선택해 콘텐츠 그룹 반환.
 * 반환값은 shell() 내부에 그대로 삽입 (헤더/타이틀/푸터 없이 영상만).
 */
export function judgesVideoContent(opts: JudgesVideoLayoutOpts): string {
  const url = (opts.videoUrl ?? '').trim();
  return url ? `${goldFrame()}${videoPlayer(url)}` : emptyState();
}
