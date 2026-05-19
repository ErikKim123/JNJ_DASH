// Design Ref: §4.1 — GET /api/contests (Phase 3: DB 기반)
import { getContestList } from '@/lib/db/adapter';
import { ok, mapError } from '@/lib/api/envelope';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const list = await getContestList();
    // legacy spreadsheetId 는 클라이언트 노출 금지 (의미 없는 정보 + 시트 ID 비공개)
    const safe = list.map((c) => {
      const { spreadsheetId, ...rest } = c;
      void spreadsheetId;
      return rest;
    });
    return ok(safe);
  } catch (e) {
    return mapError(e);
  }
}
