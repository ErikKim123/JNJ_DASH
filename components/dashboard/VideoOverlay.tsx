// 표출 화면 전체를 덮는 영상 오버레이 — 오른쪽 위 "영상1/2/3" 버튼으로 띄운다.
// YouTube 링크면 iframe 임베드(autoplay), 그 외 URL 이면 <video> 로 재생.
'use client';

import { useEffect } from 'react';
import { resolveVideoSrc, youTubeEmbedUrl } from '@/lib/templates/shared/judgesVideo';

export function VideoOverlay({ url, onClose }: { url: string; onClose: () => void }) {
  // Esc 로 닫기.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    // capture: DashboardShell 의 전역 키 핸들러보다 먼저 처리해 닫기 동작이 우선되게.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const embed = youTubeEmbedUrl(url);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* 닫기 버튼 */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full border border-white/40 bg-black/50 text-white text-xl leading-none hover:bg-white hover:text-black transition-colors"
      >
        ✕
      </button>

      {/* 16:9 영상 영역 */}
      <div className="w-[92vw] max-w-[1600px] aspect-video bg-black">
        {embed ? (
          <iframe
            key={embed}
            src={`${embed}&autoplay=1`}
            title="Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full border-0"
          />
        ) : (
          <video
            key={url}
            src={resolveVideoSrc(url)}
            controls
            autoPlay
            playsInline
            className="w-full h-full bg-black object-contain"
          />
        )}
      </div>
    </div>
  );
}
