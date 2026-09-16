import type { Metadata, Viewport } from 'next';
// VOTE/AUDIENCE 앱과 같은 디자인 토큰을 재사용한다 — 관객이 채점하던 화면과
// 결과를 보는 화면이 같은 서체·같은 색으로 이어지게.
// 이 CSS 는 /results 세그먼트에서만 번들되어 Dash(Tailwind) 전역과 섞이지 않는다.
import '../vote/styles/colors_and_type.css';
import '../vote/vote.css';
import './results.css';

export const metadata: Metadata = {
  title: 'JNJ RESULTS',
  description: 'Official results for JNJ Dash competitions.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return <div className="vote-root">{children}</div>;
}
