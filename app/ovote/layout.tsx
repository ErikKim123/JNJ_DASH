import type { Metadata } from 'next';
// VOTE 앱과 동일한 디자인 토큰 + 베이스 스타일을 재사용.
// 두 CSS 는 /ovote 세그먼트에서만 번들되어 Dash(Tailwind) 전역과 섞이지 않는다.
import '../vote/styles/colors_and_type.css';
import '../vote/vote.css';

export const metadata: Metadata = {
  title: 'JNJ ONLINE VOTE',
  description: 'Online judge scoring app for JNJ Dash competitions.',
};

export default function OVoteLayout({ children }: { children: React.ReactNode }) {
  return <div className="vote-root">{children}</div>;
}
