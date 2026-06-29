import type { Metadata } from 'next';
// 디자인 토큰(:root 변수) → vote 베이스 스타일 순서로 로드.
// 두 파일 모두 /vote 세그먼트에서만 번들되어 Dash(Tailwind) 전역과 섞이지 않는다.
import './styles/colors_and_type.css';
import './vote.css';

export const metadata: Metadata = {
  title: 'JNJ VOTE',
  description: 'JNJ dance competition scoring app',
};

// 중첩 레이아웃 — <html>/<body>는 루트 layout.tsx 가 렌더한다.
// .vote-root 래퍼가 vote.css 베이스 스타일(흰 캔버스/폰트)을 이 서브트리에만 적용.
export default function VoteLayout({ children }: { children: React.ReactNode }) {
  return <div className="vote-root">{children}</div>;
}
