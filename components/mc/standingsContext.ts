// MC 콘솔 공용 순위/동점 컨텍스트 — 폴링 결과를 배너·심사탭·동점 모달이 함께 본다.
// (Provider 는 standings.tsx, 소비자는 이 파일의 useStandings 만 임포트 → 순환 임포트 방지)
'use client';

import { createContext, useContext } from 'react';
import type { RoundKey } from '@/lib/sheets/types';
import type { RoleStanding } from '@/lib/judging/standings';

/** GET /api/admin/contests/[id]/judging/[round]/standings 응답. */
export interface StandingsResp {
  round: RoundKey;
  maxPerRole: number;
  leader: RoleStanding;
  follower: RoleStanding;
  committed: boolean;
}

export interface RoleCount {
  /** 현재 점수 기준 정원 안 인원(동점이면 정원을 넘을 수 있음). */
  live: number;
  /** 확정(qualifiers.passed / final_rank≤3) 인원. */
  confirmed: number;
}

export interface StandingsCtxValue {
  /** 지금 감시 중인 라운드 — 화면전환 탭이면 표출 라운드, 그 외에는 탭 라운드. */
  round: RoundKey;
  data: StandingsResp | null;
  error: string | null;
  loading: boolean;
  /** 마지막 성공 조회 시각(ms). */
  updatedAt: number | null;
  /** 자동 조회(5초) 사용 여부 — 심사위원 점수가 들어오면 저절로 갱신된다. */
  auto: boolean;
  setAuto: (v: boolean) => void;
  reload: () => Promise<StandingsResp | null>;
  /** 경계 동점이 걸린 역할들. */
  ties: RoleStanding[];
  /** 경계 동점 후보 총원. */
  tieCount: number;
  counts: { leader: RoleCount; follower: RoleCount };
  /** 확정 전 + 라이브 정원 초과(= 동점으로 자리보다 인원이 많음). */
  overQuota: boolean;
  /** 동점 추려내기 모달 열기/닫기. */
  tieOpen: boolean;
  openTie: () => void;
  closeTie: () => void;
}

export const StandingsCtx = createContext<StandingsCtxValue | null>(null);

export function useStandings(): StandingsCtxValue {
  const v = useContext(StandingsCtx);
  if (!v) throw new Error('useStandings must be used inside <StandingsProvider>');
  return v;
}

/** 역할 라벨 — MC 콘솔 전역 공통. */
export function roleLabel(role: 'leader' | 'follower'): string {
  return role === 'leader' ? '리더' : '팔로워';
}

/** 동점 점수 단위 — 예선/본선은 O 표, 결승은 점수 합. */
export function tieUnit(round: RoundKey): string {
  return round === 'final' ? '점' : '표';
}
