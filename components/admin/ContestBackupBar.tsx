'use client';

// 대회 데이터 백업/복원 — JSON 과 XLSX(엑셀) 두 형식 모두 지원.
//
// 다운로드:
//   [↓ JSON]  — 서버가 직접 JSON 파일 응답 (Content-Disposition)
//   [↓ XLSX]  — 서버에서 JSON 받아온 뒤 클라이언트에서 xlsx 변환해 저장
//                (10 시트: contest / participants / judges / pairings / qualifiers /
//                 final_results + 라운드별 점수 시트 prelim_votes / semi_votes /
//                 final_scores + _meta)
//
// 업로드:
//   파일 확장자로 자동 판별. .xlsx 면 xlsx → JSON 변환 후 동일 import API 호출.
//   라운드별 점수 시트가 있으면 거기서 votes 환원. 옛 백업(judge_votes 단일 시트)도 호환.
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui';
import { jsonBackupToXlsx, xlsxFileToJsonBackup } from './backup-xlsx';

export function ContestBackupBar({ contestId }: { contestId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function clearMessages() { setError(null); setMsg(null); }

  function downloadJson() {
    clearMessages();
    // 서버가 Content-Disposition 으로 파일명 지정 → 단순 anchor 클릭.
    const a = document.createElement('a');
    a.href = `/api/admin/contests/${encodeURIComponent(contestId)}/export`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setMsg('JSON backup download started.');
  }

  function downloadXlsx() {
    clearMessages();
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/contests/${encodeURIComponent(contestId)}/export`);
        if (!res.ok) throw new Error(`Export failed (${res.status})`);
        const backup = (await res.json()) as Record<string, unknown>;
        const blob = await jsonBackupToXlsx(backup);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `${contestId.replace(/[^A-Za-z0-9_-]/g, '_')}-backup-${today}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setMsg('XLSX backup downloaded.');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to build XLSX');
      }
    });
  }

  function pickFile() {
    fileRef.current?.click();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    clearMessages();

    const isXlsx = /\.xlsx$/i.test(file.name);
    const isJson = /\.json$/i.test(file.name);
    if (!isXlsx && !isJson) {
      setError('Unsupported file — choose .json or .xlsx.');
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      if (isXlsx) {
        parsed = await xlsxFileToJsonBackup(file);
      } else {
        const text = await file.text();
        parsed = JSON.parse(text);
      }
    } catch (err) {
      setError(`Parse failed: ${err instanceof Error ? err.message : 'unknown'}`);
      return;
    }

    const backupContestId = (parsed.contest as { id?: string } | undefined)?.id;
    const summarize = (k: string) => Array.isArray(parsed[k]) ? (parsed[k] as unknown[]).length : 0;

    // 다른 대회 백업이면 — 참가자/심사위원 명단만 복사하는 모드를 제안.
    let namesOnly = false;
    if (backupContestId !== contestId) {
      const proceed = confirm(
        `This backup is for "${backupContestId ?? '?'}", not "${contestId}".\n\n` +
        `Copy participants & judges only into "${contestId}"?\n` +
        `· participants: ${summarize('participants')}\n` +
        `· judges: ${summarize('judges')}\n\n` +
        `Existing rows in "${contestId}" with matching id will be overwritten. ` +
        `Other tables (votes, pairings, qualifiers, finals) and contest meta are NOT copied. Continue?`
      );
      if (!proceed) return;
      namesOnly = true;
    } else {
      // judge_votes 는 환원 결과 카운트 (라운드 합산). 옛 백업/새 백업 모두 동일하게 표시.
      const summary = [
        `participants ${summarize('participants')}`,
        `judges ${summarize('judges')}`,
        `scores ${summarize('judge_votes')}`,
        `pairings ${summarize('pairings')}`,
        `qualifiers ${summarize('qualifiers')}`,
        `final_results ${summarize('final_results')}`,
      ].join(' · ');

      if (!confirm(
        `Apply ${isXlsx ? 'XLSX' : 'JSON'} backup to "${contestId}"?\n\n${summary}\n\n` +
        `Rows with matching id will be overwritten. Continue?`
      )) return;
    }

    startTransition(async () => {
      const qs = namesOnly ? '?names_only=1' : '';
      const res = await fetch(
        `/api/admin/contests/${encodeURIComponent(contestId)}/import${qs}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? `Import failed (${res.status})`);
        return;
      }
      const c = j.data?.counts ?? {};
      if (namesOnly) {
        setMsg(
          `Names-only restore from "${backupContestId}" → "${contestId}" — ` +
          `participants ${c.participants ?? 0}, judges ${c.judges ?? 0}.`
        );
      } else {
        setMsg(
          `Restored — contests ${c.contests ?? 0}, participants ${c.participants ?? 0}, ` +
          `judges ${c.judges ?? 0}, judge_votes ${c.judge_votes ?? 0}, ` +
          `pairings ${c.pairings ?? 0}, qualifiers ${c.qualifiers ?? 0}, finals ${c.final_results ?? 0}.`
        );
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded border border-border bg-panel/40 p-4 max-w-3xl">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-sm font-semibold">Backup & Restore</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={downloadJson} disabled={pending}>↓ JSON</Button>
          <Button onClick={downloadXlsx} disabled={pending}>↓ XLSX</Button>
          <Button variant="primary" onClick={pickFile} disabled={pending}>↑ Upload</Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={onFileSelected}
          />
        </div>
      </div>
      <p className="text-xs text-ink2">
        Downloads a snapshot of this contest as <strong>JSON</strong> or <strong>XLSX</strong> (Excel).
        XLSX includes <strong>contest · participants · judges · pairings · qualifiers · final_results</strong>{' '}
        plus per-round score sheets <strong>prelim_votes · semi_votes · final_scores</strong>{' '}
        (with judge name &amp; team name columns for readability) — edit in Excel and upload back.
        Existing votes are matched by (judge, participant) and overwritten.
        Uploading a backup from a different contest copies <strong>participants &amp; judges only</strong>{' '}
        (after confirmation) — useful for seeding a new contest.
      </p>
      {pending && <p className="text-xs text-ink2 mt-2">working…</p>}
      {msg && (
        <p className="text-xs text-ok mt-2 rounded border border-ok/40 bg-ok/5 px-2 py-1">
          ✓ {msg}
        </p>
      )}
      {error && (
        <p className="text-xs text-danger mt-2 rounded border border-danger/40 bg-danger/5 px-2 py-1" role="alert">
          ✗ {error}
        </p>
      )}
    </section>
  );
}
