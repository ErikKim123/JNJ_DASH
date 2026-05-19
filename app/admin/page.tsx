// /admin — 대시보드. 대회 목록 카드 + 빠른 진입.
import Link from 'next/link';
import { listContests } from '@/lib/db/queries';
import type { ContestRow } from '@/lib/db/types';
import { PageHeader, Badge } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function AdminIndexPage() {
  let contests: ContestRow[] = [];
  let dbError: string | null = null;
  try {
    contests = await listContests();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return (
    <>
      <PageHeader
        title="Data Operations"
        subtitle="Pick a contest or create a new one."
        actions={
          <Link
            href="/admin/contests/new"
            className="inline-flex items-center px-3 py-1.5 rounded bg-accent text-bg text-sm font-medium hover:bg-accent2 transition"
          >
            + New Contest
          </Link>
        }
      />

      {dbError && (
        <div className="mb-4 rounded border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
          <p className="font-semibold">Supabase connection failed</p>
          <p className="font-mono text-xs mt-1">{dbError}</p>
          <p className="text-xs mt-2 text-ink2">
            Apply <code className="bg-bg2 px-1">db/migrations/0001_initial.sql</code>{' '}
            and check the Supabase keys in <code className="bg-bg2 px-1">.env.local</code>.
          </p>
        </div>
      )}

      {contests.length === 0 && !dbError ? (
        <div className="rounded border border-border bg-panel p-8 text-center text-sm text-ink2">
          <p className="mb-3">No contests yet.</p>
          <p>
            Run <code className="bg-bg2 px-1">npm run import:sheets</code> to seed from sheets, or{' '}
            <Link href="/admin/contests/new" className="text-accent hover:underline">
              create a new contest
            </Link>.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
          {contests.map((c) => (
            <Link
              key={c.id}
              href={`/admin/contests/${encodeURIComponent(c.id)}`}
              className="block rounded border border-border bg-panel p-4 hover:border-accent transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-ink2">{c.id}</span>
                <Badge tone={c.status === 'live' ? 'ok' : c.status === 'done' ? 'info' : 'neutral'}>
                  {c.status}
                </Badge>
              </div>
              <h3 className="text-base font-semibold mb-1">{c.name}</h3>
              <div className="text-xs text-ink2 flex items-center gap-3">
                {c.period_start && (
                  <span>
                    {c.period_start} ~ {c.period_end ?? ''}
                  </span>
                )}
                <span>· Template {c.design_template_number}</span>
                <span>
                  · Prelim {c.prelim_pass_per_role} / Semi {c.semi_pass_per_role}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
