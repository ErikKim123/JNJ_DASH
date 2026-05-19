'use client';

// EN/KO 2단 토글. 현재 선택된 쪽은 강조, 클릭으로 즉시 전환 (localStorage 자동 저장).
import { useLocale } from '@/lib/i18n/LocaleContext';
import type { Locale } from '@/lib/i18n/messages';

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div
      role="group"
      aria-label={t('locale.label')}
      className="inline-flex rounded border border-border overflow-hidden text-xs"
    >
      <Pill code="en" active={locale === 'en'} onClick={setLocale}>
        {t('locale.en')}
      </Pill>
      <Pill code="ko" active={locale === 'ko'} onClick={setLocale}>
        {t('locale.ko')}
      </Pill>
    </div>
  );
}

function Pill({
  code, active, onClick, children,
}: {
  code: Locale;
  active: boolean;
  onClick: (l: Locale) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(code)}
      aria-pressed={active}
      className={`px-2.5 py-1 font-medium transition ${
        active
          ? 'bg-accent/15 text-accent'
          : 'text-ink2 hover:text-ink hover:bg-bg2'
      }`}
    >
      {children}
    </button>
  );
}
