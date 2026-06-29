// 라운드별 "추가 영상"(예선/본선/결승 각 3개) 공용 타입·정규화.
// 심사위원 소개 영상(judges_video_url)과 별개로, 표출 화면 오른쪽 위 버튼으로
// 전체화면 오버레이 재생하는 보조 영상들. DB 는 contests.extra_videos (jsonb).

import type { RoundKey } from '@/lib/sheets/types';

export const EXTRA_VIDEO_ROUNDS = ['prelim', 'semi', 'final'] as const;
export const EXTRA_VIDEOS_PER_ROUND = 3;

export interface ExtraVideos {
  prelim: string[];
  semi: string[];
  final: string[];
}

/** 항상 라운드별 정확히 3칸(빈 문자열 채움)인 ExtraVideos 로 정규화. jsonb 가 {}/부분/null 이어도 안전. */
export function normalizeExtraVideos(raw: unknown): ExtraVideos {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = (key: RoundKey): string[] => {
    const arr = Array.isArray(src[key]) ? (src[key] as unknown[]) : [];
    return Array.from({ length: EXTRA_VIDEOS_PER_ROUND }, (_, i) =>
      typeof arr[i] === 'string' ? (arr[i] as string) : '',
    );
  };
  return { prelim: pick('prelim'), semi: pick('semi'), final: pick('final') };
}

/** 모든 라운드가 빈 문자열이면 true (설정된 추가 영상 없음). */
export function isExtraVideosEmpty(v: ExtraVideos): boolean {
  return EXTRA_VIDEO_ROUNDS.every((r) => v[r].every((u) => !u.trim()));
}
