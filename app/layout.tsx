import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JNJ Dash',
  description: '댄스 컴페티션 채점 표출 앱',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: 일부 브라우저 확장(Kantu, Grammarly 등)이
    // <html>/<body>에 속성을 주입해 hydration 경고를 일으키므로 한 단계만 무시.
    <html lang="ko" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
