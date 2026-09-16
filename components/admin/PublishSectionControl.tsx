'use client';

// 섹션별 웹게시 스위치 — 참가자 / 예선 통과자 / 본선 통과자 탭 오른쪽 끝에 붙는다.
//
// 결승 결과(PublishResultsControl)와 같은 공개 페이지(/results/<대회ID>)를 쓰되,
// 켜고 끄는 대상이 그 섹션 하나다. 운영 순서가 한 번에 끝나지 않기 때문이다:
// 대회 전에 참가자 명단을 돌리고, 예선이 끝나면 통과자를, 본선이 끝나면 다시 통과자를 알린다.
// 스위치가 하나뿐이면 명단을 공개하려다 아직 나오지도 않은 결승 순위까지 열린다.
//
// 링크·열기 버튼은 켜져 있을 때만 — 닫힌 주소(404)를 복사해 돌리지 않도록.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui';
import { useT } from '@/lib/i18n/LocaleContext';

/** contests 테이블의 섹션 게시 컬럼. */
export type PublishField =
  | 'participants_published'
  | 'prelim_published'
  | 'semi_published';

export function PublishSectionControl({
  contestId,
  field,
  published,
  sectionLabel,
}: {
  contestId: string;
  field: PublishField;
  published: boolean;
  /** 확인 문구에 넣을 섹션 이름 — 예: '참가자 명단'. */
  sectionLabel: string;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const path = `/results/${encodeURIComponent(contestId)}`;
  // 절대 주소는 브라우저에서만 만든다 — 미리보기·프로덕션 도메인이 달라도 '지금 그 도메인'.
  const absUrl = typeof window === 'undefined' ? path : `${window.location.origin}${path}`;

  async function toggle() {
    const next = !published;
    const ask = next
      ? `${sectionLabel}을(를) 공개 페이지에 게시할까요?`
      : `${sectionLabel}을(를) 공개 페이지에서 내릴까요?`;
    if (!confirm(ask)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/contests/${encodeURIComponent(contestId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      startTransition(() => router.refresh());
    } catch {
      alert(t('publish.failed'));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(absUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // 클립보드가 막힌 환경(비 HTTPS 등) — 주소를 띄워 직접 복사하게 한다.
      prompt(t('publish.copyLink'), absUrl);
    }
  }

  const disabled = busy || pending;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink2 hidden sm:inline">{t('publish.label')}</span>
      <span
        className={`inline-flex items-center gap-1.5 text-xs ${published ? 'text-accent' : 'text-ink2'}`}
        title={published ? absUrl : undefined}
      >
        <span
          aria-hidden
          className={`w-1.5 h-1.5 rounded-full ${published ? 'bg-accent' : 'bg-border'}`}
        />
        {published ? t('publish.on') : t('publish.off')}
      </span>

      {published && (
        <>
          <Button onClick={copy} disabled={disabled}>
            {copied ? t('publish.copied') : t('publish.copyLink')}
          </Button>
          <a
            href={path}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition border border-border bg-bg2 hover:border-accent hover:text-accent"
          >
            {t('publish.open')} ↗
          </a>
        </>
      )}

      <Button
        variant={published ? 'danger' : 'primary'}
        onClick={toggle}
        disabled={disabled}
      >
        {published ? t('publish.unpublishAction') : t('publish.publishAction')}
      </Button>
    </div>
  );
}
