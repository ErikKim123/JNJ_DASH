'use client';

// 디자인 템플릿 선택 — 숫자 입력 대신 registry 에 등록된 템플릿을 카드 갤러리로 표출.
// 새 템플릿을 lib/templates/registry.ts 에 등록하면 이 화면에 자동으로 추가된다.
//
// 각 카드는 실제 템플릿 SVG 를 <iframe srcdoc> 안에서 렌더한다. 템플릿 01/02/03 의
// gradient/filter id 가 동일(goldg, palmg, softGlow …)해서 한 문서에 나란히 인라인하면
// 뒤쪽 SVG 가 앞쪽 정의를 참조해 색이 섞인다 — iframe 으로 문서를 분리해 이를 막는다.
import { useEffect, useMemo, useState } from 'react';
import { Button, Select } from './ui';
import { useT } from '@/lib/i18n/LocaleContext';
import {
  templateOptions,
  PREVIEW_SCREENS,
  DEFAULT_PREVIEW_SCREEN,
  renderPreviewSvg,
  type PreviewScreenKey,
} from '@/lib/templates/preview';

// app/layout.tsx 와 동일한 웹폰트 — iframe 은 부모 문서 스타일을 물려받지 않으므로 직접 링크.
// (부모에서 이미 로드된 폰트라 캐시에서 즉시 뜬다.)
const FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=Cinzel:wght@400;500;600;700;800;900&family=Oswald:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap">';

function frameDoc(svg: string): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    FONT_LINK +
    '<style>html,body{margin:0;padding:0;background:#000;overflow:hidden}' +
    'svg{display:block;width:100vw;height:100vh}</style>' +
    '</head><body>' +
    svg +
    '</body></html>'
  );
}

function PreviewFrame({
  templateId,
  screen,
  title,
  interactive = false,
}: {
  templateId: number;
  screen: PreviewScreenKey;
  title: string;
  /** 모달 확대 보기에서는 클릭/스크롤을 허용하지 않되 포인터만 통과시키지 않는다. */
  interactive?: boolean;
}) {
  const doc = useMemo(() => frameDoc(renderPreviewSvg(templateId, screen)), [templateId, screen]);
  return (
    <iframe
      // key: 템플릿/화면이 바뀌면 문서를 새로 만들어 이전 애니메이션 상태를 남기지 않는다.
      key={`${templateId}-${screen}`}
      title={title}
      srcDoc={doc}
      sandbox=""
      scrolling="no"
      tabIndex={-1}
      className={`block w-full border-0 bg-black ${interactive ? '' : 'pointer-events-none'}`}
      style={{ aspectRatio: '1280 / 720' }}
    />
  );
}

/** 화면 전환 세그먼트 — 갤러리 전체 / 모달 공용. */
function ScreenTabs({
  value,
  onChange,
  size = 'sm',
}: {
  value: PreviewScreenKey;
  onChange: (k: PreviewScreenKey) => void;
  size?: 'sm' | 'md';
}) {
  const t = useT();
  return (
    <div className="inline-flex rounded border border-border overflow-hidden">
      {PREVIEW_SCREENS.map((s) => {
        const active = s.key === value;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            aria-pressed={active}
            className={`${size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs'} transition ${
              active ? 'bg-accent text-bg font-medium' : 'text-ink2 hover:text-ink hover:bg-bg2'
            }`}
          >
            {t(s.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function TemplatePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (id: number) => void;
}) {
  const t = useT();
  const options = useMemo(() => templateOptions(), []);
  const [screen, setScreen] = useState<PreviewScreenKey>(DEFAULT_PREVIEW_SCREEN);
  // 모달에서 확대해 보고 있는 템플릿 id (null = 닫힘)
  const [zoomId, setZoomId] = useState<number | null>(null);
  const [zoomScreen, setZoomScreen] = useState<PreviewScreenKey>(DEFAULT_PREVIEW_SCREEN);

  // 저장된 번호가 registry 에 없는 경우 — 표출은 1번으로 폴백되므로 그 사실을 알린다.
  const registered = options.some((o) => o.id === value);
  const zoomOption = options.find((o) => o.id === zoomId) ?? null;

  useEffect(() => {
    if (zoomId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomId]);

  function openZoom(id: number) {
    setZoomId(id);
    setZoomScreen(screen);
  }

  return (
    <section className="rounded border border-border bg-panel/40 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="text-sm font-semibold">{t('cf.templateTitle')}</h3>
          <p className="text-xs text-ink2 mt-1">{t('cf.templateHint')}</p>
        </div>
        {/* 카드 클릭 외에 목록에서 바로 고를 수 있는 셀렉트 — 템플릿이 많아지면 이쪽이 빠르다. */}
        <label className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-ink2">
            {t('cf.templateSelectLabel')}
          </span>
          <Select
            value={String(value)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="min-w-[15rem]"
          >
            {!registered && (
              <option value={String(value)}>
                {pad2(value)} — {t('cf.templateNotRegisteredOption')}
              </option>
            )}
            {options.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {pad2(o.id)} — {o.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {!registered && (
        <p className="mb-3 text-xs text-danger">
          {t('cf.templateUnregistered').replace('{N}', String(value))}
        </p>
      )}

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xs uppercase tracking-widest text-ink2">
          {t('cf.templatePreviewScreen')}
        </span>
        <ScreenTabs value={screen} onChange={setScreen} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {options.map((o) => {
          const active = o.id === value;
          return (
            <div
              key={o.id}
              className={`rounded border overflow-hidden transition ${
                active ? 'border-accent' : 'border-border hover:border-accent/50'
              }`}
            >
              <button
                type="button"
                onClick={() => onChange(o.id)}
                aria-pressed={active}
                title={`${pad2(o.id)} — ${o.name}`}
                className="block w-full text-left cursor-pointer group"
              >
                <PreviewFrame
                  templateId={o.id}
                  screen={screen}
                  title={`${o.name} preview`}
                />
                <div className={`px-2.5 py-2 ${active ? 'bg-accent/10' : 'bg-bg2'}`}>
                  <div className="flex items-center gap-2">
                    {/* 라디오 표시 — 카드가 "고르는 것"임을 분명히 한다. */}
                    <span
                      aria-hidden
                      className={`shrink-0 w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        active ? 'border-accent' : 'border-border group-hover:border-accent/60'
                      }`}
                    >
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                    </span>
                    <span className={`text-xs ${active ? 'text-accent' : 'text-ink2'}`}>
                      {pad2(o.id)}
                    </span>
                    <span
                      className={`ml-auto text-xs ${
                        active ? 'text-accent' : 'text-ink2 group-hover:text-accent'
                      }`}
                    >
                      {active ? t('cf.templateSelected') : t('cf.templateSelect')}
                    </span>
                  </div>
                  <div className="text-sm truncate mt-1" title={o.name}>
                    {o.name}
                  </div>
                </div>
              </button>
              <div className="px-2.5 pb-2.5 pt-1 bg-bg2/60 flex justify-end">
                <Button type="button" variant="ghost" className="text-xs px-1.5 py-1" onClick={() => openZoom(o.id)}>
                  {t('cf.templateZoom')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {zoomOption && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomId(null)}
          role="dialog"
          aria-modal="true"
          aria-label={zoomOption.name}
        >
          <div
            className="w-full max-w-5xl rounded border border-border bg-panel p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="text-sm">
                <span className="text-ink2 mr-1.5">{pad2(zoomOption.id)}</span>
                {zoomOption.name}
              </div>
              <div className="flex items-center gap-2">
                <ScreenTabs value={zoomScreen} onChange={setZoomScreen} size="md" />
                <Button type="button" variant="ghost" onClick={() => setZoomId(null)}>
                  {t('cf.templateClose')}
                </Button>
              </div>
            </div>
            <PreviewFrame
              templateId={zoomOption.id}
              screen={zoomScreen}
              title={`${zoomOption.name} preview`}
              interactive
            />
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant={zoomOption.id === value ? 'secondary' : 'primary'}
                disabled={zoomOption.id === value}
                onClick={() => {
                  onChange(zoomOption.id);
                  setZoomId(null);
                }}
              >
                {zoomOption.id === value ? t('cf.templateInUse') : t('cf.templateUse')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
