// 절대 원칙 2 (docs/rubric.md §1.2) 의 UI 단일 강제점.
//
// ⚠️ 개별 화면이 confidence 를 보고 직접 분기하는 코드를 만들지 말 것.
//    지표를 렌더하는 모든 화면은 이 컴포넌트로 감싼다.
//    판정 자체는 워커의 compute_confidence() 가 이미 끝났고, 서버 API 도
//    low 면 지표를 내려보내지 않는다. 이 컴포넌트는 마지막 방어선이다.
//
// 색·타이포는 JNJ Mobile Design System(app/join/join.css) 토큰/클래스만 사용한다.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LOW_REASON_GUIDE } from '@/lib/ai-judge/format';
import type { LowReason, Report } from '@/lib/ai-judge/types';

/** 사유 안내 · 촬영 요령 공통 — 안내 박스 스펙 */
const NOTICE_BOX: React.CSSProperties = {
  border: '1px solid var(--jnj-border)',
  background: 'var(--jnj-surface)',
  borderRadius: 'var(--jnj-radius-lg)',
  padding: 16,
};

export function ConfidenceGate({
  report,
  children,
}: {
  report: Report;
  children: ReactNode;
}) {
  if (report.confidence === 'low') {
    return <AnalysisUnavailable reasons={report.unavailableReasons} />;
  }
  return <>{children}</>;
}

export function AnalysisUnavailable({ reasons }: { reasons: LowReason[] }) {
  const guides = reasons.length
    ? reasons
    : (['pose_success_low'] as LowReason[]);

  return (
    <section style={{ padding: '32px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 32, lineHeight: 1, margin: 0 }}>🎬</p>
      <h1 className="jnj-h2" style={{ margin: '16px 0 8px', color: 'var(--jnj-text)' }}>
        분석 불가
      </h1>
      <p className="jnj-body" style={{ margin: 0, color: 'var(--jnj-text-muted)' }}>
        영상 품질이 지표를 신뢰할 수 있는 수준에 미치지 못했습니다.
        <br />
        잘못된 수치를 보여드리지 않기 위해 결과를 표시하지 않습니다.
      </p>

      <ul
        className="jnj-stack-3"
        style={{ listStyle: 'none', margin: '24px 0 0', padding: 0, textAlign: 'left' }}
      >
        {guides.map((r) => (
          <li
            key={r}
            style={{
              ...NOTICE_BOX,
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--jnj-text)',
            }}
          >
            {LOW_REASON_GUIDE[r] ?? r}
          </li>
        ))}
      </ul>

      <div style={{ ...NOTICE_BOX, marginTop: 24, textAlign: 'left' }}>
        <p className="jnj-h3" style={{ margin: '0 0 8px', color: 'var(--jnj-text)' }}>
          촬영 요령
        </p>
        <ul
          style={{
            listStyle: 'disc',
            margin: 0,
            paddingLeft: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <li className="jnj-caption">머리부터 발끝까지 화면에 들어오게 찍어 주세요.</li>
          <li className="jnj-caption">카메라를 고정하고, 밝은 곳에서 촬영해 주세요.</li>
          <li className="jnj-caption">커플은 두 사람이 겹치지 않도록 조금 멀리서 찍어 주세요.</li>
          <li className="jnj-caption">음악이 들리도록 소리를 켜고 촬영해 주세요.</li>
        </ul>
      </div>

      <Link href="/ajudge" className="jnj-btn jnj-btn-primary" style={{ marginTop: 24 }}>
        다시 촬영하기
      </Link>
    </section>
  );
}
