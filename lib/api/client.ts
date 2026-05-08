// Design Ref: §4 — 클라이언트 측 API 호출 헬퍼. 봉투 응답을 풀어서 throw on error.
import type { ContestMeta, RoundKey, StepDataPayload, StepKey } from '@/lib/sheets/types';
import type { ContestCardData } from '@/components/home/ContestCard';

interface Envelope<T> {
  data: T | null;
  error: string | null;
  cachedAt?: string;
  ttlSeconds?: number;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<{ data: T; cachedAt?: string; ttlSeconds?: number }> {
  const res = await fetch(url, { ...init, cache: 'no-store' });
  const json = (await res.json()) as Envelope<T>;
  if (!res.ok || json.error || json.data === null) {
    throw new Error(json.error ?? `${res.status} ${res.statusText}`);
  }
  return { data: json.data, cachedAt: json.cachedAt, ttlSeconds: json.ttlSeconds };
}

export async function fetchContests(): Promise<ContestCardData[]> {
  const { data } = await getJson<ContestCardData[]>('/api/contests');
  return data;
}

export async function fetchContestMeta(contestId: string): Promise<ContestMeta> {
  const { data } = await getJson<ContestMeta>(`/api/contests/${encodeURIComponent(contestId)}/meta`);
  return data;
}

export interface StepFetchResult {
  payload: StepDataPayload;
  cachedAt?: string;
  ttlSeconds?: number;
}

export async function fetchStepData(
  contestId: string,
  round: RoundKey,
  step: StepKey,
  signal?: AbortSignal,
  options?: { refresh?: boolean }
): Promise<StepFetchResult> {
  const base = `/api/contests/${encodeURIComponent(contestId)}/round/${round}/step/${step}`;
  const url = options?.refresh ? `${base}?refresh=1` : base;
  const { data, cachedAt, ttlSeconds } = await getJson<StepDataPayload>(url, { signal });
  return { payload: data, cachedAt, ttlSeconds };
}
