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
import { useT } from '@/lib/i18n/LocaleContext';

/** 간단한 {KEY} → value 치환. messages.ts 의 placeholder 패턴과 일치 (ContestForm 과 동일). */
function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export function ContestBackupBar({ contestId }: { contestId: string }) {
  const router = useRouter();
  const t = useT();
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
    setMsg(t('cb.jsonStarted'));
  }

  function downloadXlsx() {
    clearMessages();
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/contests/${encodeURIComponent(contestId)}/export`);
        if (!res.ok) throw new Error(fmt(t('cb.exportFailed'), { STATUS: res.status }));
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
        setMsg(t('cb.xlsxDone'));
      } catch (e) {
        setError(e instanceof Error ? e.message : t('cb.xlsxFailed'));
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
      setError(t('cb.badFile'));
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
      setError(
        fmt(t('cb.parseFailed'), {
          MSG: err instanceof Error ? err.message : t('cb.parseUnknown'),
        })
      );
      return;
    }

    const backupContestId = (parsed.contest as { id?: string } | undefined)?.id;
    const summarize = (k: string) => Array.isArray(parsed[k]) ? (parsed[k] as unknown[]).length : 0;

    // 다른 대회 백업이면 — 참가자/심사위원 명단만 복사하는 모드를 제안.
    let namesOnly = false;
    if (backupContestId !== contestId) {
      const proceed = confirm(
        fmt(t('cb.confirmOther'), {
          SRC: backupContestId ?? '?',
          DEST: contestId,
          P: summarize('participants'),
          J: summarize('judges'),
        })
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
        fmt(t('cb.confirmApply'), {
          FMT: isXlsx ? 'XLSX' : 'JSON',
          DEST: contestId,
          SUMMARY: summary,
        })
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
        setError(j.error ?? fmt(t('cb.importFailed'), { STATUS: res.status }));
        return;
      }
      const c = j.data?.counts ?? {};
      if (namesOnly) {
        setMsg(
          fmt(t('cb.restoredNames'), {
            SRC: backupContestId ?? '?',
            DEST: contestId,
            P: c.participants ?? 0,
            J: c.judges ?? 0,
          })
        );
      } else {
        setMsg(
          fmt(t('cb.restored'), {
            C: c.contests ?? 0,
            P: c.participants ?? 0,
            J: c.judges ?? 0,
            V: c.judge_votes ?? 0,
            PR: c.pairings ?? 0,
            Q: c.qualifiers ?? 0,
            F: c.final_results ?? 0,
          })
        );
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded border border-border bg-panel/40 p-4 max-w-3xl">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-sm font-semibold">{t('cb.title')}</h3>
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
      <p className="text-xs text-ink2" dangerouslySetInnerHTML={{ __html: t('cb.desc') }} />
      {pending && <p className="text-xs text-ink2 mt-2">{t('cb.working')}</p>}
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
