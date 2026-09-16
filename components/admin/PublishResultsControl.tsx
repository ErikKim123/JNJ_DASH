'use client';

// 결승 결과 웹게시 스위치 — 결승 결과 탭 오른쪽 끝에 붙는다.
//
// 결과를 확정한 사람이 곧바로 공개까지 하도록 같은 화면에 두었다. 설정 페이지
// 어딘가로 보내면 '확정은 했는데 게시를 잊는' 간극이 생긴다.
//
// 게시 중일 때만 링크·열기 버튼이 나온다 — 닫혀 있는 주소를 복사해 돌리면
// 받은 사람이 404 를 보게 되기 때문이다.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui';
import { PublishWolfDialog } from './PublishWolfDialog';
import { useT } from '@/lib/i18n/LocaleContext';

export function PublishResultsControl({
  contestId,
  contestName,
  published,
}: {
  contestId: string;
  contestName: string;
  published: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Wolf 게시는 공개 페이지와 따로 간다 — 공개 링크를 안 열고 고객몰 시상대만
  // 올리는 경우가 있고, 그 반대도 있다.
  const [wolfOpen, setWolfOpen] = useState(false);

  const path = `/results/${encodeURIComponent(contestId)}`;
  // 절대 주소는 브라우저에서만 만든다 — 서버 렌더 시점의 host 추측보다 정확하고,
  // 미리보기·프로덕션 도메인이 달라도 항상 '지금 보고 있는 그 도메인' 이 된다.
  const absUrl = typeof window === 'undefined' ? path : `${window.location.origin}${path}`;

  async function toggle() {
    const next = !published;
    if (!confirm(next ? t('publish.confirmOn') : t('publish.confirmOff'))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/contests/${encodeURIComponent(contestId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results_published: next }),
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

      <span aria-hidden className="mx-1 h-4 w-px bg-border" />

      <Button onClick={() => setWolfOpen(true)} disabled={disabled} title="결승 1~3위를 Wolf 우승자관리에 넣습니다">
        WOLF 게시 ↗
      </Button>
      {wolfOpen && (
        <PublishWolfDialog
          contestId={contestId}
          contestName={contestName}
          onClose={() => setWolfOpen(false)}
        />
      )}
    </div>
  );
}
