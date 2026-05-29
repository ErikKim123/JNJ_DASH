// JOIN APP 톤앤매너(테마) 유틸.
//   - 대회별 join_theme(프리셋 키) + join_accent(포인트색 오버라이드) 를
//     JOIN 페이지 루트(<main>)에 적용할 className / CSS 변수 style 로 변환한다.
//   - 그룹/랜딩처럼 여러 대회가 섞인 화면은 pickJoinTheme 로 집계해 하나의 테마를 정한다.
// join.css 의 시맨틱 토큰(--jnj-bg/--jnj-surface/--jnj-text/--jnj-border/--jnj-accent ...)과 한 쌍.
import type { CSSProperties } from 'react';
import type { ContestRow } from '@/lib/db/types';

export type JoinThemeMode = 'light' | 'dark';

/** 프리셋 테마 1종 — 전체 팔레트 정의. accent 는 기본 포인트색(오버라이드 없을 때). */
export interface JoinPreset {
  key: string;
  label: string;
  mode: JoinThemeMode;
  bg: string;
  surface: string;
  surface2: string;
  track: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
}

// ── 프리셋 10종 (라이트 2 / 다크 8) ──────────────────────────────────
export const JOIN_PRESETS: JoinPreset[] = [
  {
    key: 'dark', label: 'Dark', mode: 'dark',
    bg: '#111111', surface: '#1F1F21', surface2: '#1F1F21', track: '#28282A',
    text: '#FFFFFF', textMuted: '#9E9EA0', border: '#39393B', accent: '#FFFFFF',
  },
  {
    key: 'light', label: 'Light', mode: 'light',
    bg: '#FFFFFF', surface: '#FFFFFF', surface2: '#FAFAFA', track: '#F5F5F5',
    text: '#111111', textMuted: '#707072', border: '#E5E5E5', accent: '#111111',
  },
  {
    key: 'graphite', label: 'Graphite', mode: 'dark',
    bg: '#161616', surface: '#222222', surface2: '#222222', track: '#2E2E2E',
    text: '#F2F2F2', textMuted: '#A0A0A0', border: '#3A3A3A', accent: '#F5C84B',
  },
  {
    key: 'midnight', label: 'Midnight', mode: 'dark',
    bg: '#0B1020', surface: '#141B30', surface2: '#141B30', track: '#1E2742',
    text: '#E8ECF8', textMuted: '#8C97B8', border: '#28324F', accent: '#4F8CFF',
  },
  {
    key: 'forest', label: 'Forest', mode: 'dark',
    bg: '#0C1A12', surface: '#122418', surface2: '#122418', track: '#1A3324',
    text: '#E6F2EA', textMuted: '#8FB59C', border: '#234734', accent: '#2FBF71',
  },
  {
    key: 'ocean', label: 'Ocean', mode: 'dark',
    bg: '#07171A', surface: '#0E262B', surface2: '#0E262B', track: '#133840',
    text: '#E2F4F6', textMuted: '#84B3BB', border: '#1E4951', accent: '#21C7C7',
  },
  {
    key: 'wine', label: 'Wine', mode: 'dark',
    bg: '#1A0E14', surface: '#2A151F', surface2: '#2A151F', track: '#3A1E2C',
    text: '#F6E9EF', textMuted: '#C399AC', border: '#4A2838', accent: '#E84D6A',
  },
  {
    key: 'sunset', label: 'Sunset', mode: 'dark',
    bg: '#1A120B', surface: '#2A1D12', surface2: '#2A1D12', track: '#3A2917',
    text: '#F8ECDD', textMuted: '#C2A485', border: '#4A3520', accent: '#FF7A1A',
  },
  {
    key: 'royal', label: 'Royal', mode: 'dark',
    bg: '#150B26', surface: '#221141', surface2: '#221141', track: '#2E1A52',
    text: '#EFE6FA', textMuted: '#A593C4', border: '#392461', accent: '#B581FF',
  },
  {
    key: 'cream', label: 'Cream', mode: 'light',
    bg: '#FBF7F0', surface: '#FFFFFF', surface2: '#F4ECE0', track: '#EFE6D8',
    text: '#2B2218', textMuted: '#8A7B66', border: '#E6D9C6', accent: '#C2410C',
  },
  {
    key: 'slate', label: 'Slate', mode: 'light',
    bg: '#F1F5F9', surface: '#FFFFFF', surface2: '#E9EEF4', track: '#E2E8F0',
    text: '#0F172A', textMuted: '#64748B', border: '#D5DEE8', accent: '#2563EB',
  },
  {
    key: 'rose', label: 'Rose', mode: 'light',
    bg: '#FFF1F5', surface: '#FFFFFF', surface2: '#FCE7EE', track: '#F8DCE6',
    text: '#2B1620', textMuted: '#9A6E7E', border: '#F0CFD9', accent: '#E0457B',
  },
];

export const JOIN_PRESET_MAP: Record<string, JoinPreset> = Object.fromEntries(
  JOIN_PRESETS.map((p) => [p.key, p]),
);
export const JOIN_PRESET_KEYS: string[] = JOIN_PRESETS.map((p) => p.key);
export const DEFAULT_PRESET_KEY = 'dark';

/** 대회별 테마 선택 — 프리셋 키 + 포인트색 오버라이드('' = 프리셋 기본). */
export interface JoinTheme {
  key: string;
  accent: string;
}

export const DEFAULT_JOIN_THEME: JoinTheme = { key: DEFAULT_PRESET_KEY, accent: '' };

/** '#abc' / '#aabbcc' 만 통과. 그 외(빈 값 포함)는 '' 반환. */
export function normalizeAccent(raw: string | null | undefined): string {
  if (!raw) return '';
  const v = raw.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : '';
}

/** #abc → #aabbcc 로 확장. 6자리는 그대로. */
function expandHex(hex: string): string {
  if (hex.length === 4) {
    return '#' + hex.slice(1).split('').map((c) => c + c).join('');
  }
  return hex;
}

/** 배경색(accent) 위에 올릴 글자색 — 상대 휘도로 흑/백 선택. */
export function onAccentColor(accent: string): string {
  const hex = expandHex(normalizeAccent(accent) || '#000000');
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? '#111111' : '#FFFFFF';
}

/** 알 수 없는 키는 기본 프리셋으로. */
export function resolvePreset(key: string | null | undefined): JoinPreset {
  return (key && JOIN_PRESET_MAP[key]) || JOIN_PRESET_MAP[DEFAULT_PRESET_KEY];
}

/** 프리셋 + 포인트색 오버라이드 → 구체 hex 팔레트 (어드민 프리뷰/렌더 공용). */
export interface JoinPalette {
  mode: JoinThemeMode;
  bg: string;
  surface: string;
  surface2: string;
  track: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  onAccent: string;
}

export function resolveJoinPalette(presetKey: string, accentOverride: string): JoinPalette {
  const p = resolvePreset(presetKey);
  const accent = normalizeAccent(accentOverride) || p.accent;
  return {
    mode: p.mode,
    bg: p.bg,
    surface: p.surface,
    surface2: p.surface2,
    track: p.track,
    text: p.text,
    textMuted: p.textMuted,
    border: p.border,
    accent,
    onAccent: onAccentColor(accent),
  };
}

/**
 * JOIN 페이지 루트(<main>)에 펼칠 props.
 *   - className: 다크 프리셋이면 'dark' (TopNav variant 등 mode 기반 분기와 일치)
 *   - style: 전체 팔레트를 CSS 변수로 인라인 (background/color 는 토큰 참조)
 *   - mode: 'light' | 'dark'
 */
export function joinRootProps(theme: JoinTheme): {
  className: string;
  style: CSSProperties;
  mode: JoinThemeMode;
} {
  const pal = resolveJoinPalette(theme.key, theme.accent);
  const style: Record<string, string> = {
    background: 'var(--jnj-bg)',
    color: 'var(--jnj-text)',
    '--jnj-bg': pal.bg,
    '--jnj-surface': pal.surface,
    '--jnj-surface-2': pal.surface2,
    '--jnj-track': pal.track,
    '--jnj-text': pal.text,
    '--jnj-text-muted': pal.textMuted,
    '--jnj-border': pal.border,
    '--jnj-accent': pal.accent,
    '--jnj-on-accent': pal.onAccent,
  };
  return {
    className: pal.mode === 'dark' ? 'dark' : '',
    style: style as CSSProperties,
    mode: pal.mode,
  };
}

/** 단일 대회 → 테마. */
export function contestTheme(c: Pick<ContestRow, 'join_theme' | 'join_accent'> | null | undefined): JoinTheme {
  if (!c) return DEFAULT_JOIN_THEME;
  const key = c.join_theme && JOIN_PRESET_MAP[c.join_theme] ? c.join_theme : DEFAULT_PRESET_KEY;
  return { key, accent: normalizeAccent(c.join_accent) };
}

/**
 * 여러 대회 → 하나의 테마(그룹/랜딩용).
 *   - key: 가장 흔한 프리셋 (동수면 기본 프리셋).
 *   - accent: 가장 흔한 비어있지 않은 포인트색 오버라이드 (없으면 '').
 */
export function pickJoinTheme(
  contests: Pick<ContestRow, 'join_theme' | 'join_accent'>[],
): JoinTheme {
  if (contests.length === 0) return DEFAULT_JOIN_THEME;
  const keyCount = new Map<string, number>();
  const accentCount = new Map<string, number>();
  for (const c of contests) {
    const k = c.join_theme && JOIN_PRESET_MAP[c.join_theme] ? c.join_theme : DEFAULT_PRESET_KEY;
    keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
    const a = normalizeAccent(c.join_accent);
    if (a) accentCount.set(a, (accentCount.get(a) ?? 0) + 1);
  }
  let key = DEFAULT_PRESET_KEY;
  let bestK = 0;
  for (const [k, n] of keyCount) {
    if (n > bestK) {
      bestK = n;
      key = k;
    }
  }
  let accent = '';
  let bestA = 0;
  for (const [a, n] of accentCount) {
    if (n > bestA) {
      bestA = n;
      accent = a;
    }
  }
  return { key, accent };
}
