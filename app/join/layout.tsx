// /join/* 공용 레이아웃. JNJ Mobile Design System (Nike Podium CDS 기반) 적용.
// 모노크롬, Oswald display, 모바일 우선.
import type { Metadata, Viewport } from 'next';
import './join.css';

export const metadata: Metadata = {
  title: 'JNJ JOIN — Register for your competition',
  description: 'Participant registration for JNJ Dash competitions.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FFFFFF',
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="jnj-shell">{children}</div>
  );
}
