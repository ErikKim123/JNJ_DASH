// Design Ref: §4 — { data, error } 봉투 응답 + 에러 매핑
import { NextResponse } from 'next/server';
import { SheetsApiError } from '@/lib/sheets/client';
import { ContestNotFoundError, StepNotAvailableError } from '@/lib/sheets/adapter';

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
  if (e instanceof SheetsApiError) {
    return fail(502, `sheets api failed: ${e.status}`);
  }
  if (e instanceof Error && /Invalid server environment/.test(e.message)) {
    // env 미설정 시 운영자에게 즉시 보이도록 500 반환 + 메시지 노출
    return fail(500, 'server misconfigured: missing env');
  }
  console.error('[api] unexpected error:', e);
  return fail(500, 'internal error');
}
