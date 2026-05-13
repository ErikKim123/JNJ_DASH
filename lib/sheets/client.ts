// Design Ref: §4.4 — 서버 메모리 LRU 캐시, TTL 5초.
// 변경: gviz CSV 엔드포인트 사용 → API Key 불필요. "링크가 있는 모든 사용자: 뷰어"
// 권한만 있으면 됨. (구글 시트 공식 비공개 SDK 의존성 제거)
import { LRUCache } from 'lru-cache';
import { getServerEnv } from '@/config/env';

export interface SheetRange {
  spreadsheetId: string;
  range: string; // 'TabName' 또는 'TabName!A1:E' 둘 다 허용 (range 부분은 무시되고 전체 탭 반환)
}

export interface SheetResponse {
  values: string[][];
  cachedAt: string;
}

const CACHE_MAX = 200;

let cacheInstance: LRUCache<string, SheetResponse> | null = null;
function getCache(): LRUCache<string, SheetResponse> {
  if (cacheInstance) return cacheInstance;
  const env = getServerEnv();
  cacheInstance = new LRUCache<string, SheetResponse>({
    max: CACHE_MAX,
    ttl: env.SHEETS_CACHE_TTL_SECONDS * 1000,
  });
  return cacheInstance;
}

function cacheKey(spreadsheetId: string, range: string): string {
  return `${spreadsheetId}::${range}`;
}

export class SheetsApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'SheetsApiError';
    this.status = status;
  }
}

/**
 * 최소 CSV 파서. RFC 4180 따른 "..." 이스케이프 + "" 리터럴 처리.
 * 시트 셀 안에 콤마/줄바꿈/따옴표가 있어도 안전.
 */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = csv.length;
  while (i < n) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Google Sheets gviz CSV endpoint.
 * URL: https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:csv&sheet={TAB}
 * 요구 사항: 시트가 "링크가 있는 모든 사용자: 뷰어" 이상으로 공유되어 있을 것.
 *
 * range 파라미터는 'TabName!A1:Z' 형식이면 TabName만 추출. range 부분은 무시되고 전체 탭이 반환됨
 * (어댑터에서 행/컬럼 인덱스로 필터링하므로 문제 없음).
 */
export async function getSheetRange(
  spreadsheetId: string,
  range: string,
  options?: { skipCache?: boolean }
): Promise<SheetResponse> {
  const key = cacheKey(spreadsheetId, range);
  const cache = getCache();

  if (!options?.skipCache) {
    const hit = cache.get(key);
    if (hit) return hit;
  }

  const url = new URL(
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq`
  );
  url.searchParams.set('tqx', 'out:csv');

  // range 형식: "gid:12345" → gid로 조회 / 그 외 → 시트 이름 (탭 이름)
  // gid 사용을 권장 (탭 이름은 변경 위험 + gviz가 존재하지 않으면 첫 탭으로 fallback함)
  if (range.startsWith('gid:')) {
    url.searchParams.set('gid', range.slice(4).split('!')[0]);
  } else {
    const tabName = range.includes('!') ? range.split('!')[0] : range;
    url.searchParams.set('sheet', tabName);
  }

  const res = await fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new SheetsApiError(
      res.status,
      `Sheets gviz ${res.status}: ${text.slice(0, 200) || res.statusText}`
    );
  }

  const text = await res.text();

  // gviz가 시트를 못 찾거나 권한 없음일 때 HTML 또는 에러 메시지를 반환할 수 있음
  if (text.startsWith('<') || text.startsWith('/*O_o*/')) {
    throw new SheetsApiError(
      400,
      `Sheets gviz returned non-CSV. 시트 공유 설정(링크 보유자 보기)과 식별자("${range}") 확인 필요.`
    );
  }

  const values = parseCsv(text);
  const response: SheetResponse = {
    values,
    cachedAt: new Date().toISOString(),
  };
  cache.set(key, response);
  return response;
}

/**
 * 특정 시트 문서의 모든 탭 캐시 항목을 무효화. 운영자가 "조회" 버튼으로
 * 즉시 갱신을 요청할 때 사용 (5초 TTL을 우회).
 */
export function invalidateSheetCache(spreadsheetId: string): void {
  const cache = getCache();
  const prefix = `${spreadsheetId}::`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// 테스트/디버그용
export function _resetCacheForTests(): void {
  cacheInstance?.clear();
}

export function _getCacheSize(): number {
  return cacheInstance?.size ?? 0;
}
