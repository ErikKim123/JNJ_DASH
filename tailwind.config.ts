import type { Config } from 'tailwindcss';

// Design Ref: §1.2 — 디자인 템플릿(Art Deco × Jeju)의 다크 팔레트를 토큰화
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0F1018',
        bg2: '#1A1B26',
        panel: '#1F2030',
        border: '#2D2E42',
        ink: '#E8E6DA',
        ink2: '#9A98A8',
        accent: '#FFD56B',
        accent2: '#C68F3C',
        ok: '#4ADE80',
        danger: '#F87171',
        info: '#60A5FA',
      },
      fontFamily: {
        sans: ['-apple-system', 'SF Pro Text', 'Helvetica Neue', 'Gulim', '굴림', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
