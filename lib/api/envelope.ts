// Design Ref: §4 — { data, error } 봉투 응답 + 에러 매핑
// Phase 3 부터 시트 의존성 제거 — DB 어댑터의 도메인 에러를 매핑.
import { NextResponse } from 'next/server';
import { ContestNotFoundError, StepNotAvailableError } from '@/lib/db/adapter';

export interface ApiSuccess<T> {
  data: T;
  error: null;
  cachedAt?: string;
  ttlSeconds?: number;
}

export interface ApiError {
  data: null;
  error: string;
}

export function ok<T>(data: T, extras?: { cachedAt?: string; ttlSeconds?: number }): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ data, error: null, ...extras });
}

export function fail(status: number, message: string): NextResponse<ApiError> {
  return NextResponse.json({ data: null, error: message }, { status });
}

export function mapError(e: unknown): NextResponse<ApiError> {
  if (e instanceof ContestNotFoundError) {
    return fail(404, 'contest not found');
  }
  if (e instanceof StepNotAvailableError) {
    return fail(404, e.message);
  }
  if (e instanceof Error && /Invalid server environment/.test(e.message)) {
    return fail(500, 'server misconfigured: missing env');
  }
  console.error('[api] unexpected error:', e);
  return fail(500, 'internal error');
}
