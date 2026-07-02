// /ojudge/* 공용 레이아웃 — 온라인 심사위원 셀프 등록 앱.
// 참가자 JOIN 앱과 완전히 동일한 디자인 시스템(join.css)을 재사용한다.
import type { Metadata, Viewport } from 'next';
import '../join/join.css';

export const metadata: Metadata = {
  title: 'JNJ JUDGE — Online judge registration',
  description: 'Online judge registration for JNJ Dash competitions.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#111111',
};

export default function OJudgeLayout({ children }: { children: React.ReactNode }) {
  return <div className="jnj-shell">{children}</div>;
}
