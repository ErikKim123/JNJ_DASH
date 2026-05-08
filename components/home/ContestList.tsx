// Design Ref: §11.2 — Server Component. /api 경유 대신 어댑터를 직접 호출 (서버 컴포넌트이므로 가능)
import { getContestList } from '@/lib/sheets/adapter';
import { ContestCard } from './ContestCard';

export async function ContestList() {
  let contests;
  try {
    contests = await getContestList();
  } catch (e) {
    return (
      <div className="rounded-lg border border-danger/40 bg-panel p-6 text-sm text-danger">
        <p className="font-semibold mb-2">대회 목록을 불러오지 못했습니다.</p>
        <p className="text-ink2 text-xs font-mono break-all">
          {e instanceof Error ? e.message : String(e)}
        </p>
        <p className="text-ink2 text-xs mt-3">
          환경변수 CONTEST_LIST_SHEET_ID가 설정되어 있는지 확인하세요 (로컬: .env.local · Vercel: Project Settings → Environment Variables).
        </p>
      </div>
    );
  }

  if (contests.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-panel p-8 text-center text-sm text-ink2">
        등록된 대회가 없습니다. 대회목록 시트에 행을 추가하고 새로고침하세요.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {contests.map((c) => {
        // Plan SC1 — 카드 렌더링. spreadsheetId는 클라이언트 노출 금지
        const { spreadsheetId, ...safe } = c;
        return <ContestCard key={c.contestId} contest={safe} />;
      })}
    </div>
  );
}
