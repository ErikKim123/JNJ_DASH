// AI 코멘트 — 스펙 4.3.
//
// ⚠️ 절대 원칙 1: Technique / Teamwork 는 ReferenceNote 로만 렌더한다.
//    "참고 지표" 배지가 컴포넌트 내부에 고정되어 있어 호출부에서 뺄 수 없다.
//    타입상으로도 이 두 축은 reference_only: true 를 갖는다.
//
// 스타일은 JNJ Mobile Design System(app/join/join.css) 토큰만 사용한다.
import type { Comments } from '@/lib/ai-judge/types';

/** 배지 공통 — 라운드 필. 색만 바꿔 쓴다. */
const BADGE_BASE: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 'var(--jnj-radius-pill)',
  fontSize: 10,
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};

export function CommentSections({ comments }: { comments: Comments | Record<string, never> }) {
  const c = comments as Partial<Comments>;
  const has = c && Object.keys(c).length > 0;

  if (!has) {
    return (
      <section
        className="jnj-caption jnj-text-center"
        style={{
          border: '1px solid var(--jnj-border)',
          background: 'var(--jnj-surface)',
          borderRadius: 'var(--jnj-radius-lg)',
          padding: 16,
        }}
      >
        AI 코멘트를 생성하지 못했습니다.
        <br />
        지표는 정상적으로 산출되었습니다.
      </section>
    );
  }

  return (
    <section>
      <h2 className="jnj-section-title">AI 코멘트</h2>

      <div className="jnj-stack-3">
        {c.timing?.comment && <AxisNote title="Timing" body={c.timing.comment} scored />}
        {c.musicality?.comment && <AxisNote title="Musicality" body={c.musicality.comment} />}
        {c.technique?.comment && <ReferenceNote title="Technique" body={c.technique.comment} />}
        {c.teamwork?.comment && <ReferenceNote title="Teamwork" body={c.teamwork.comment} />}
      </div>
    </section>
  );
}

function AxisNote({
  title,
  body,
  scored = false,
}: {
  title: string;
  body: string;
  scored?: boolean;
}) {
  return (
    <article className="jnj-card">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 8,
        }}
      >
        <h3 className="jnj-mono jnj-small" style={{ margin: 0, color: 'var(--jnj-text)' }}>
          {title}
        </h3>
        {scored && (
          <span
            className="jnj-mono"
            style={{
              ...BADGE_BASE,
              background: 'var(--jnj-accent)',
              color: 'var(--jnj-on-accent)',
            }}
          >
            점수 산출 축
          </span>
        )}
      </div>
      <p
        className="jnj-body"
        style={{ margin: 0, whiteSpace: 'pre-line', color: 'var(--jnj-text)' }}
      >
        {body}
      </p>
    </article>
  );
}

/** 점수를 매기지 않는 축. 배지는 제거 불가 — 절대 원칙 1. */
function ReferenceNote({ title, body }: { title: string; body: string }) {
  return (
    <article className="jnj-card" style={{ background: 'transparent' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 8,
        }}
      >
        <h3 className="jnj-mono jnj-small" style={{ margin: 0 }}>
          {title}
        </h3>
        <span
          className="jnj-mono"
          style={{
            ...BADGE_BASE,
            background: 'var(--jnj-track)',
            border: '1px solid var(--jnj-border)',
            color: 'var(--jnj-text-muted)',
          }}
        >
          참고 지표 · 점수 없음
        </span>
      </div>
      <p
        className="jnj-body"
        style={{ margin: 0, whiteSpace: 'pre-line', color: 'var(--jnj-text-muted)' }}
      >
        {body}
      </p>
    </article>
  );
}
