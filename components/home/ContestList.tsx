// Design Ref: §11.2 — Server Component. Phase 3: 시트 → DB 어댑터로 전환.
import { getContestList } from '@/lib/db/adapter';
import { ContestCard } from './ContestCard';

export async function ContestList() {
  let contests;
  try {
    contests = await getContestList();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isMissingTable = /Could not find the table|relation .* does not exist/i.test(msg);
    return (
      <div className="rounded-lg border border-danger/40 bg-panel p-6 text-sm text-danger">
        <p className="font-semibold mb-2">대회 목록을 불러오지 못했습니다.</p>
        <p className="text-ink2 text-xs font-mono break-all">{msg}</p>
        <div className="text-ink2 text-xs mt-3 space-y-1">
          {isMissingTable ? (
            <>
              <p>Supabase 에 DB 스키마가 아직 적용되지 않았습니다.</p>
              <p>
                터미널에서 <code className="bg-bg2 px-1 py-0.5 rounded">npm run db:migrate</code> 를 실행한 뒤,{' '}
                <code className="bg-bg2 px-1 py-0.5 rounded">npm run import:sheets</code> 로 데이터를 가져오세요.
              </p>
            </>
          ) : (
            <p>
              <code className="bg-bg2 px-1 py-0.5 rounded">.env.local</code> 의 Supabase 키
              (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) 를 확인하세요.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (contests.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-panel p-8 text-center text-sm text-ink2">
        <p className="mb-2">등록된 대회가 없습니다.</p>
        <p className="text-xs">
          <code className="bg-bg2 px-1 py-0.5 rounded">npm run import:sheets</code> 로 기존 시트에서 가져오거나,{' '}
          <a href="/admin" className="text-accent hover:underline">자료운영(/admin)</a> 에서 새 대회를 생성하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1">
      {contests.map((c) => {
        // Plan SC1 — 카드 렌더링. spreadsheetId는 클라이언트 노출 금지
        const { spreadsheetId, ...safe } = c;
        return <ContestCard key={c.contestId} contest={safe} />;
      })}
    </div>
  );
}
