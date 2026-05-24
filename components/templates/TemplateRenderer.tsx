// Design Ref: §2.3, §5 — 디자인 템플릿 번호 + (round, step, data) → SVG 렌더.
// SVG 문자열은 placeholder 치환이 끝난 신뢰 가능 데이터(xmlEscape 적용됨)이므로
// dangerouslySetInnerHTML로 렌더해도 안전.
'use client';

import { forwardRef, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RoundKey, StepKey, StepDataPayload } from '@/lib/sheets/types';
import { getTemplate } from '@/lib/templates/registry';
import { ScalingFrame } from '@/components/ui/ScalingFrame';

export interface TemplateRendererProps {
  templateId: number;
  round: RoundKey;
  step: StepKey;
  data: StepDataPayload;
  fit?: 'width' | 'viewport';
  /** 대회별 커스텀 배경 이미지 URL — 설정 시 디자인 템플릿 기본 배경 위에 덮어 그림. */
  backgroundOverride?: string;
  /** 커스텀 배경 투명도 (0-100). 미지정 시 100. */
  backgroundOpacity?: number;
}

// 결승 Result 발표 순서: 팔로워 3 → 리더 3 → 팔로워 2 → 리더 2 → 팔로워 1 → 리더 1
const FINAL_REVEAL_ORDER = ['F-3', 'L-3', 'F-2', 'L-2', 'F-1', 'L-1'] as const;
type RevealId = (typeof FINAL_REVEAL_ORDER)[number];

// SVG host — svg 문자열이 바뀌지 않으면 절대 재렌더하지 않는다.
// 이래야 클릭으로 reveal state만 변할 때 dangerouslySetInnerHTML이 DOM을 건드리지 않아
// 기존 애니메이션 / 적용된 클래스 / SMIL 상태가 보존된다.
const SvgHost = memo(
  forwardRef<HTMLDivElement, { svg: string }>(function SvgHost({ svg }, ref) {
    return (
      <div
        ref={ref}
        className="w-full h-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  })
);

export function TemplateRenderer({ templateId, round, step, data, fit = 'width', backgroundOverride, backgroundOpacity }: TemplateRendererProps) {
  const template = getTemplate(templateId);
  // svg 문자열을 메모이즈 — data/round/step/배경 override/opacity 가 같으면 이전 결과 재사용
  const svg = useMemo(
    () => template.render(round, step, data, { backgroundOverride, backgroundOpacity }),
    [template, round, step, data, backgroundOverride, backgroundOpacity]
  );

  const isFinalResult = round === 'final' && step === 'result';
  const isCeremony = round === 'final' && step === 'ceremony';
  const wrapRef = useRef<HTMLDivElement>(null);
  // 발표된 ID 집합 — monotonic
  const [revealed, setRevealed] = useState<Set<RevealId>>(() => new Set());
  // 이미 keyframe 애니메이션이 트리거된 ID — 다시 추가하지 않음(재재생 방지)
  const animatedRef = useRef<Set<RevealId>>(new Set());
  const totalReveal = FINAL_REVEAL_ORDER.length;
  // Ceremony 벚꽃 토글 상태
  const [sakuraActive, setSakuraActive] = useState(false);

  // 결승 Result 진입/이탈 시 reveal 상태 + 애니메이션 기록 초기화
  useEffect(() => {
    setRevealed(new Set());
    animatedRef.current = new Set();
  }, [isFinalResult, round, step]);

  // Ceremony 진입/이탈 시 벚꽃 토글 초기화
  useEffect(() => {
    setSakuraActive(false);
  }, [isCeremony, round, step]);

  // Ceremony — .jnj-sakura 클래스에 active 토글 적용
  useLayoutEffect(() => {
    if (!isCeremony || !wrapRef.current) return;
    const el = wrapRef.current.querySelector<SVGGElement>('.jnj-sakura');
    if (!el) return;
    if (sakuraActive) el.classList.add('active');
    else el.classList.remove('active');
  }, [sakuraActive, isCeremony, svg]);

  // SVG/reveal 변화 시 [data-reveal-id] 요소에 클래스 + 인라인 style 적용.
  // useLayoutEffect로 paint 직전 동기 적용 → 한 프레임의 깜빡임도 방지.
  useLayoutEffect(() => {
    if (!isFinalResult || !wrapRef.current) return;
    const items = wrapRef.current.querySelectorAll<SVGGElement>('[data-reveal-id]');
    items.forEach((el) => {
      const id = el.getAttribute('data-reveal-id') as RevealId | null;
      if (!id || !revealed.has(id)) return;

      if (animatedRef.current.has(id)) {
        // 이미 애니메이션 트리거된 항목 — 인라인 style로 최종 가시 상태 강제 고정.
        // CSS 규칙이 어떤 이유로든 무력화되거나 forwards lock이 풀려도 사라지지 않게 보강.
        if (!el.classList.contains('revealed')) el.classList.add('revealed');
        el.style.opacity = '1';
      } else {
        // 처음 발표되는 항목 — keyframe 애니메이션 트리거
        el.classList.add('revealed');
        el.classList.add('reveal-anim');
        animatedRef.current.add(id);
      }
    });
  }, [revealed, isFinalResult, svg]);

  const advanceReveal = () => {
    setRevealed((prev) => {
      if (prev.size >= totalReveal) return prev;
      const next = new Set(prev);
      next.add(FINAL_REVEAL_ORDER[prev.size]);
      return next;
    });
  };

  // 키보드: Space / Enter 로 다음 자리 발표 (DashboardShell의 ←/→/1/2/3/F 와 충돌 안 함)
  useEffect(() => {
    if (!isFinalResult) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        advanceReveal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinalResult]);

  const handleClick = () => {
    if (isFinalResult) {
      advanceReveal();
      return;
    }
    if (isCeremony) {
      setSakuraActive((v) => !v);
      return;
    }
  };

  const revealCount = revealed.size;
  const hint = useMemo(() => {
    if (!isFinalResult) return null;
    return revealCount < totalReveal
      ? `▸ 클릭 / SPACE 로 발표 (${revealCount}/${totalReveal})`
      : '✦ 발표 완료 ✦';
  }, [isFinalResult, revealCount, totalReveal]);

  return (
    <ScalingFrame fit={fit}>
      <div
        className="relative w-full h-full"
        onClick={handleClick}
        style={
          isFinalResult
            ? { cursor: revealCount < totalReveal ? 'pointer' : 'default' }
            : isCeremony
              ? { cursor: 'pointer' }
              : undefined
        }
      >
        <SvgHost ref={wrapRef} svg={svg} />
        {hint ? (
          <div
            className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-mono tracking-widest text-[#D4AF37] opacity-50 select-none"
            aria-live="polite"
          >
            {hint}
          </div>
        ) : null}
      </div>
    </ScalingFrame>
  );
}
