'use client';

// 온라인 심사위원 관리 — 대회당 최대 ~1000명이라 페이지네이션(50/page).
//   목록/편집만 담당(등록은 공개 조인앱 /ojudge 에서 셀프 등록).
//   · PIN(4자리)·이름·국가·이메일·연락처 인라인 편집(blur 저장) + 행 삭제.
//   · 페이지 이동은 URL(?page=N) 기반 — 서버가 해당 페이지만 다시 로드.
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, Input } from './ui';
import type { OnlineJudgeRow } from '@/lib/db/types';

function buildQrSrc(url: string, size = 120): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${encodeURIComponent(url)}`;
}

export function OnlineJudgesAdmin({
  contestId,
  rows,
  total,
  page,
  pageSize,
  joinUrl,
}: {
  contestId: string;
  rows: OnlineJudgeRow[];
  total: number;
  page: number;
  pageSize: number;
  joinUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const apiBase = `/api/admin/contests/${encodeURIComponent(contestId)}/online-judges`;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const basePath = `/admin/contests/${encodeURIComponent(contestId)}/online-judges`;
  const firstIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastIndex = Math.min(total, page * pageSize);

  function patch(id: string, patchBody: Partial<OnlineJudgeRow>, onOk: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`${apiBase}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Update failed (${res.status})`);
        router.refresh();
        return;
      }
      onOk();
    });
  }

  function remove(row: OnlineJudgeRow) {
    const label = row.name || `${row.first_name} ${row.last_name}`.trim() || row.email || '(no name)';
    if (!confirm(`온라인 심사위원 "${label}" 을(를) 삭제할까요?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`${apiBase}/${row.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError(`Delete failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded border border-border bg-panel">
        <header className="flex items-start justify-between px-4 py-3 border-b border-border bg-bg2/50 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">Online Judges</h3>
            <Badge tone="info">{total} judges</Badge>
            <span className="text-xs text-ink2">공개 조인앱(/ojudge)에서 셀프 등록 · {pageSize}명씩 페이지</span>
          </div>
          {/* 등록 링크/QR — 운영자가 화면에 띄워두면 심사위원이 폰으로 스캔해 셀프 등록 */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1">
              <a
                href={joinUrl}
                target="_blank"
                rel="noopener"
                className="font-mono text-xs text-accent hover:underline break-all max-w-[16rem] text-right"
                title={joinUrl}
              >
                {joinUrl}
              </a>
              <Button onClick={copyLink}>{copied ? '복사됨 ✓' : '링크 복사'}</Button>
            </div>
            <div className="w-16 h-16 bg-white rounded p-1 shrink-0" title={joinUrl}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={buildQrSrc(joinUrl, 120)}
                alt="Online judge registration QR"
                width={56}
                height={56}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="block w-full h-full"
              />
            </div>
          </div>
        </header>

        {error && (
          <div className="px-4 py-2 text-sm text-danger bg-danger/5 border-b border-danger/20" role="alert">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg2 text-ink2 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 w-16">#</th>
                <th className="text-left px-3 py-2 w-16">Photo</th>
                <th className="text-left px-3 py-2 min-w-[10rem]">Name</th>
                <th className="text-left px-3 py-2 min-w-[8rem]">Country</th>
                <th className="text-left px-3 py-2 min-w-[12rem]">Email</th>
                <th className="text-left px-3 py-2 min-w-[9rem]">Phone</th>
                <th className="text-left px-3 py-2 w-24">PIN</th>
                <th className="text-right px-3 py-2 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-ink2 py-8">
                    아직 등록된 온라인 심사위원이 없습니다.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <OnlineJudgeRowEditor
                  key={r.id}
                  row={r}
                  pending={pending}
                  onPatch={(p, onOk) => patch(r.id, p, onOk)}
                  onDelete={() => remove(r)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        <footer className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border bg-bg2/30 flex-wrap">
          <span className="text-xs text-ink2 font-mono">
            {firstIndex}–{lastIndex} / {total} · Page {page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <PageLink basePath={basePath} page={1} disabled={page <= 1} label="« First" />
            <PageLink basePath={basePath} page={page - 1} disabled={page <= 1} label="‹ Prev" />
            <PageLink basePath={basePath} page={page + 1} disabled={page >= totalPages} label="Next ›" />
            <PageLink basePath={basePath} page={totalPages} disabled={page >= totalPages} label="Last »" />
          </div>
        </footer>
      </section>
    </div>
  );
}

function PageLink({
  basePath,
  page,
  disabled,
  label,
}: {
  basePath: string;
  page: number;
  disabled: boolean;
  label: string;
}) {
  const cls =
    'px-2.5 py-1 rounded border text-xs transition ' +
    (disabled
      ? 'border-border text-ink2/40 pointer-events-none'
      : 'border-border text-ink2 hover:text-ink hover:border-ink');
  if (disabled) return <span className={cls}>{label}</span>;
  return (
    <Link href={`${basePath}?page=${page}`} className={cls}>
      {label}
    </Link>
  );
}

function OnlineJudgeRowEditor({
  row,
  pending,
  onPatch,
  onDelete,
}: {
  row: OnlineJudgeRow;
  pending: boolean;
  onPatch: (patch: Partial<OnlineJudgeRow>, onOk: () => void) => void;
  onDelete: () => void;
}) {
  const [d, setD] = useState({
    name: row.name || `${row.first_name} ${row.last_name}`.trim(),
    representative: row.representative,
    email: row.email,
    phone: row.phone,
    pin: row.pin,
  });
  const [pinErr, setPinErr] = useState(false);

  function commit<K extends keyof typeof d>(field: K, value: (typeof d)[K]) {
    if (value === (row[field as keyof OnlineJudgeRow] as unknown)) return;
    onPatch({ [field]: value } as Partial<OnlineJudgeRow>, () => {});
  }

  function commitPin() {
    const v = d.pin.trim();
    if (v === row.pin) return;
    if (v !== '' && !/^\d{4}$/.test(v)) {
      setPinErr(true);
      return;
    }
    setPinErr(false);
    onPatch({ pin: v }, () => {});
  }

  const photo = useMemo(() => row.photo_url, [row.photo_url]);

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-mono text-ink2">{row.display_order}</td>
      <td className="px-3 py-2">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-bg2">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={d.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="block text-[9px] text-ink2/50 leading-10 text-center">—</span>
          )}
        </div>
      </td>
      <td className="px-2 py-2">
        <Input
          value={d.name}
          onChange={(e) => setD({ ...d, name: e.target.value })}
          onBlur={() => commit('name', d.name.trim())}
          className="w-full"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          value={d.representative}
          onChange={(e) => setD({ ...d, representative: e.target.value })}
          onBlur={() => commit('representative', d.representative.trim())}
          className="w-full"
          placeholder="—"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          type="email"
          value={d.email}
          onChange={(e) => setD({ ...d, email: e.target.value })}
          onBlur={() => commit('email', d.email.trim())}
          className="w-full"
          placeholder="—"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          value={d.phone}
          onChange={(e) => setD({ ...d, phone: e.target.value })}
          onBlur={() => commit('phone', d.phone.trim())}
          className="w-full"
          placeholder="—"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          value={d.pin}
          inputMode="numeric"
          maxLength={4}
          onChange={(e) => setD({ ...d, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
          onBlur={commitPin}
          className={`w-16 font-mono text-center tracking-widest ${pinErr ? 'border-danger' : ''}`}
          placeholder="----"
          title={pinErr ? '4자리 숫자를 입력하세요' : '4자리 숫자 PIN'}
        />
      </td>
      <td className="px-3 py-2 text-right">
        <Button variant="danger" onClick={onDelete} disabled={pending}>
          Del
        </Button>
      </td>
    </tr>
  );
}
