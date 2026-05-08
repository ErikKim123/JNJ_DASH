// Design Ref: §4.1 — GET /api/contests
import { getContestList } from '@/lib/sheets/adapter';
import { ok, mapError } from '@/lib/api/envelope';

export const dynamic = 'force-dynamic'; // 캐시는 서버 LRU에서 처리, Next fetch 캐시 비활성화

export async function GET() {
  try {
    const list = await getContestList();
    // Design §4.4 — spreadsheetId는 클라이언트에 노출 금지
    const safe = list.map(({ spreadsheetId, ...rest }) => rest);
    return ok(safe);
  } catch (e) {
    return mapError(e);
  }
}
