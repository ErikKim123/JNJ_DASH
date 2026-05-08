// Design Ref: §1.2, §11.2 — viewBox 1280×720 SVG를 컨테이너에 맞춰 스케일.
// 1920×1080(=16:9), 3840×2160(=16:9)와 viewBox 비율이 동일하므로 width:100% + aspect-ratio 16:9
// 만으로 fit가 자동. 노트북(1366폭, 보통 16:9 또는 16:10)에서도 동일하게 동작.
'use client';

import { type ReactNode } from 'react';

export function ScalingFrame({
  children,
  fit = 'width',
}: {
  children: ReactNode;
  /** 'width' = 컨테이너 폭에 맞춤 (기본). 'viewport' = 화면 전체에 맞춤 (풀스크린용). */
  fit?: 'width' | 'viewport';
}) {
  if (fit === 'viewport') {
    // viewport 비율과 SVG 비율(16:9) 차이를 최소화. CSS aspect-ratio + max로
    // 폭이 모자라면 폭 기준, 높이가 모자라면 높이 기준으로 fit.
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div
          className="w-full"
          style={{
            aspectRatio: '1280 / 720',
            maxWidth: 'min(100%, calc(100vh * 16 / 9))',
            maxHeight: '100vh',
          }}
        >
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="w-full" style={{ aspectRatio: '1280 / 720' }}>
      {children}
    </div>
  );
}
