// Result 화면에서 시트의 자동 통과(TRUE) 인원이 설정 정원을 초과한 경우 표시되는 경고.
// 동점자 처리를 운영자가 수동으로 결정해야 함을 알림.
'use client';

import type { ResultData } from '@/lib/sheets/types';

export function OverflowAlert({ overflow }: { overflow: NonNullable<ResultData['overflow']> }) {
  const parts: string[] = [];
  if (overflow.leaderOverflow > 0) {
    parts.push(`리더 ${overflow.leaderTotal}명(정원 +${overflow.leaderOverflow})`);
  }
  if (overflow.followerOverflow > 0) {
    parts.push(`팔로워 ${overflow.followerTotal}명(정원 +${overflow.followerOverflow})`);
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-accent2 bg-accent/10 px-4 py-2.5 text-xs flex items-start gap-3"
    >
      <span className="text-accent text-base leading-none mt-0.5">⚠️</span>
      <div className="flex-1">
        <p className="font-semibold text-accent">
          동점자 발생 — 운영자 수동 검토 필요 (정원 {overflow.maxPerRole}명)
        </p>
        <p className="text-ink2 mt-1 font-mono">
          시트 자동 통과: {parts.join(' · ')}
        </p>
        <p className="text-ink2 mt-1 leading-relaxed">
          대시보드는 정원 {overflow.maxPerRole}명만 표출 중. 시트에서 통과자를 직접
          확정한 뒤 우측 상단 <span className="font-mono text-accent">↻ 조회</span> 버튼을 눌러 갱신하세요.
        </p>
      </div>
    </div>
  );
}
