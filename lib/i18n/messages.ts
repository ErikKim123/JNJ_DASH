// admin UI 라벨 영/한 사전.
// 영어가 source of truth. 새 라벨은 항상 영어 먼저 추가하고 한국어 대응 채움.
// 점진적 확장 — 모든 admin 텍스트를 다 옮길 필요 없음. 가장 눈에 띄는 것부터.

export type Locale = 'en' | 'ko';

export const LOCALES: readonly Locale[] = ['en', 'ko'] as const;

/** 전체 메시지 키 union — 타입 추론으로 t(key) 호출 시 자동 완성. */
export type MessageKey = keyof typeof MESSAGES_EN;

export const MESSAGES_EN = {
  // ── Locale switcher ─────────────────────────────────────────────
  'locale.label': 'Language',
  'locale.en': 'EN',
  'locale.ko': 'KO',

  // ── Top header ──────────────────────────────────────────────────
  'header.brand': 'Admin',
  'header.dataOps': 'Data Ops',
  'header.display': '← Display',
  'header.logout': 'Logout',
  'header.loggingOut': 'Logging out…',

  // ── Sidebar ─────────────────────────────────────────────────────
  'sidebar.contests': 'Contests',
  'sidebar.new': '+ New',
  'sidebar.noContests': 'No contests yet.',

  // ── Contest tabs ────────────────────────────────────────────────
  'tab.contestInfo': 'Contest Info',
  'tab.judges': 'Judges',
  'tab.participants': 'Participants',
  'tab.prelimPairing': 'Prelim Pairing',
  'tab.prelimJudging': 'Prelim Judging',
  'tab.prelimQualifiers': 'Prelim Qualifiers',
  'tab.semiPairing': 'Semi Pairing',
  'tab.semiJudging': 'Semi Judging',
  'tab.semiQualifiers': 'Semi Qualifiers',
  'tab.finalJudging': 'Final Judging',
  'tab.finalResults': 'Final Results',

  // ── Round names ────────────────────────────────────────────────
  'round.prelim': 'Preliminary',
  'round.semi': 'Semi-Final',
  'round.final': 'Grand Final',

  // ── Judging matrix : status bar ────────────────────────────────
  'matrix.eligible': 'eligible',
  'matrix.leaderShort': 'L',
  'matrix.followerShort': 'F',
  'matrix.helperShort': 'H',
  'matrix.helperTooltip': 'Helper — not counted toward rank or pass quota',
  'matrix.judges': 'judges',
  'matrix.passQuota': 'Pass quota',
  'matrix.couples': 'couples',
  'matrix.currentlyPassing': 'Currently passing',
  'matrix.podium': 'Podium',
  'matrix.tieOverQuota': 'tie over quota',
  'matrix.boundaryTie': 'Boundary tie',
  'matrix.boundaryTieDetail': 'at the rank cut · review needed',
  'matrix.clickToToggle': 'click cell to toggle · → O → X',
  'matrix.activeItems': 'active items',
  'matrix.passingLive': 'Currently passing · live',
  'matrix.podiumLive': 'Podium · live',

  // ── Judging matrix : action bar ────────────────────────────────
  'matrix.newJudgeName': 'New judge name',
  'matrix.addJudge': '+ Add Judge',
  'matrix.refresh': '↻ Refresh',
  'matrix.reset': '↺ Reset',
  'matrix.commitToQualifiers': '✓ Commit to Qualifiers',
  'matrix.uncommit': '↶ Undo Commit',
  'matrix.uncommitTooltip': 'Delete all qualifier rows for this round (votes & judges preserved)',
  'matrix.uncommitModalTitle': 'Undo qualifiers commit?',
  'matrix.uncommitModalConfirm': 'Yes, undo commit',
  'matrix.autoRefresh': 'Auto 5s',
  'matrix.autoRefreshOn': 'Auto-refresh ON — every 5s',
  'matrix.autoRefreshOff': 'Auto-refresh OFF',
  'matrix.resetModalTitle': 'Reset all votes?',
  'matrix.resetModalConfirm': 'Yes, reset',
  'matrix.cancel': 'Cancel',

  // ── Judging matrix : labels / footer ───────────────────────────
  'matrix.role': 'Role',
  'matrix.rank': 'Rank',
  'matrix.team': 'Team',
  'matrix.numSign': '#',
  'matrix.totalAvg': 'Total / Avg',
  'matrix.oCount': 'O / X',
  'matrix.leaderO': 'Leader O →',
  'matrix.followerO': 'Follower O →',
  'matrix.judgeAvg': 'Judge Avg →',
  'matrix.avgOfEntered': 'avg of all entered scores',
  'matrix.passQuotaShort': 'pass quota',
  'matrix.passQuotaFull': 'Pass quota →',
  'matrix.couplesFull': 'couples (Leaders {LEADERS} / Followers {FOLLOWERS})',
  'matrix.rowsHighlighted': 'rows highlighted by rank ≤ {MAX}',
  'matrix.podiumTop': 'Podium → Top',
  'matrix.perRole': 'per role',
  'matrix.noParticipants': 'No participants yet.',
  'matrix.noQualifiers': 'No qualifiers passed to this round yet.',
  'matrix.tooltipPrelim': '💡 Click an O/X cell to cycle  ·  → O → X → ·. Operators can add judges anytime — votes persist.',
  'matrix.tooltipFinal': '💡 Final round: 3 numeric scores per cell (basic / connectivity / musicality). Edits autosave on blur.',
  'matrix.tooltipLiveCounter': 'Live count — updates on every O/X click',

  // ── Judging matrix : action messages ───────────────────────────
  'matrix.resetDone': 'Reset done — {N} cells cleared.',
  'matrix.refreshedDone': 'Refreshed — judges {J} · cells {V}.',
  'matrix.committedDone': 'Committed — Leaders {L} / Followers {F} marked as PASS in Qualifiers.',
  'matrix.uncommittedDone': 'Commit undone — {N} qualifier row(s) deleted.',
  'matrix.confirmReset': 'Reset ALL {ROUND} votes? This will erase every cell in this matrix. Judges 명단은 유지됩니다.',
  'matrix.confirmCommit': 'Commit current {ROUND} ranking to Qualifiers?\n· In-quota (top {MAX} per role, boundary ties included) → PASS=true\n· Others (with O>0) → PASS=false\n· No O vote → not in qualifiers list',
  'matrix.confirmUncommit': 'Undo {ROUND} qualifiers commit?\n· Deletes every qualifier row for {ROUND}.\n· Votes / judges / pairings are preserved — you can commit again.\n· If the next round already has pairings or votes based on these qualifiers, they may become stale.',
  'matrix.confirmDeleteJudge': 'Delete judge "{NAME}"? Removes the judge from prelim, semi, and final, and erases all of their votes/scores across rounds.',
  'matrix.commitOnlyPrelimSemi': 'Commit is only for Prelim/Semi. Final results are managed separately.',
} as const;

export const MESSAGES_KO: Record<MessageKey, string> = {
  // ── Locale switcher ─────────────────────────────────────────────
  'locale.label': '언어',
  'locale.en': 'EN',
  'locale.ko': 'KO',

  // ── Top header ──────────────────────────────────────────────────
  'header.brand': '관리',
  'header.dataOps': '데이터 운영',
  'header.display': '← 표시 화면',
  'header.logout': '로그아웃',
  'header.loggingOut': '로그아웃 중…',

  // ── Sidebar ─────────────────────────────────────────────────────
  'sidebar.contests': '대회',
  'sidebar.new': '+ 새 대회',
  'sidebar.noContests': '아직 대회가 없습니다.',

  // ── Contest tabs ────────────────────────────────────────────────
  'tab.contestInfo': '대회 정보',
  'tab.judges': '심사위원',
  'tab.participants': '참가자',
  'tab.prelimPairing': '예선 페어링',
  'tab.prelimJudging': '예선 심사',
  'tab.prelimQualifiers': '예선 통과자',
  'tab.semiPairing': '본선 페어링',
  'tab.semiJudging': '본선 심사',
  'tab.semiQualifiers': '본선 통과자',
  'tab.finalJudging': '결승 심사',
  'tab.finalResults': '결승 결과',

  // ── Round names ────────────────────────────────────────────────
  'round.prelim': '예선',
  'round.semi': '본선',
  'round.final': '결승',

  // ── Judging matrix : status bar ────────────────────────────────
  'matrix.eligible': '명 대상',
  'matrix.leaderShort': '리',
  'matrix.followerShort': '팔',
  'matrix.helperShort': '헬',
  'matrix.helperTooltip': '헬퍼 — 순위/통과 정원에 포함되지 않음',
  'matrix.judges': '명 심사위원',
  'matrix.passQuota': '통과 정원',
  'matrix.couples': '커플',
  'matrix.currentlyPassing': '현재 통과',
  'matrix.podium': '시상',
  'matrix.tieOverQuota': '동점으로 정원 초과',
  'matrix.boundaryTie': '경계 동점',
  'matrix.boundaryTieDetail': '명 — 정원 경계 동점, 검토 필요',
  'matrix.clickToToggle': '셀 클릭으로 · → O → X 순환',
  'matrix.activeItems': '활성 항목',
  'matrix.passingLive': '현재 통과 · 실시간',
  'matrix.podiumLive': '시상 · 실시간',

  // ── Judging matrix : action bar ────────────────────────────────
  'matrix.newJudgeName': '새 심사위원 이름',
  'matrix.addJudge': '+ 심사위원 추가',
  'matrix.refresh': '↻ 새로고침',
  'matrix.reset': '↺ 초기화',
  'matrix.commitToQualifiers': '✓ 통과자 확정',
  'matrix.uncommit': '↶ 확정 되돌리기',
  'matrix.uncommitTooltip': '이 라운드의 통과자 행 전체 삭제 (투표·심사위원은 유지)',
  'matrix.uncommitModalTitle': '통과자 확정을 되돌릴까요?',
  'matrix.uncommitModalConfirm': '예, 확정 되돌리기',
  'matrix.autoRefresh': '자동 5초',
  'matrix.autoRefreshOn': '자동 새로고침 ON — 5초마다',
  'matrix.autoRefreshOff': '자동 새로고침 OFF',
  'matrix.resetModalTitle': '모든 투표를 초기화할까요?',
  'matrix.resetModalConfirm': '예, 초기화',
  'matrix.cancel': '취소',

  // ── Judging matrix : labels / footer ───────────────────────────
  'matrix.role': '역할',
  'matrix.rank': '등수',
  'matrix.team': '팀',
  'matrix.numSign': '번호',
  'matrix.totalAvg': '총점 / 평균',
  'matrix.oCount': 'O / X',
  'matrix.leaderO': '리더 O →',
  'matrix.followerO': '팔로워 O →',
  'matrix.judgeAvg': '심사위원 평균 →',
  'matrix.avgOfEntered': '입력된 점수의 평균',
  'matrix.passQuotaShort': '통과 정원',
  'matrix.passQuotaFull': '통과 정원 →',
  'matrix.couplesFull': '커플 (리더 {LEADERS} / 팔로워 {FOLLOWERS})',
  'matrix.rowsHighlighted': '등수 ≤ {MAX} 행이 강조됨',
  'matrix.podiumTop': '시상 → 상위',
  'matrix.perRole': '명 (역할별)',
  'matrix.noParticipants': '아직 참가자가 없습니다.',
  'matrix.noQualifiers': '이 라운드로 통과한 참가자가 아직 없습니다.',
  'matrix.tooltipPrelim': '💡 O/X 셀을 클릭하면 · → O → X → · 순환. 심사 중에도 심사위원 추가 가능 — 투표는 그대로 보존.',
  'matrix.tooltipFinal': '💡 결승: 셀당 3개 점수 (기본기 / 연결성 / 음악성). 포커스가 빠질 때 자동 저장.',
  'matrix.tooltipLiveCounter': '실시간 카운트 — O/X 클릭마다 갱신',

  // ── Judging matrix : action messages ───────────────────────────
  'matrix.resetDone': '초기화 완료 — {N}개 셀 비움.',
  'matrix.refreshedDone': '새로고침 완료 — 심사위원 {J}명 · 셀 {V}개.',
  'matrix.committedDone': '확정 완료 — 리더 {L} / 팔로워 {F} 명이 통과자에 PASS 표시.',
  'matrix.uncommittedDone': '확정 되돌림 — 통과자 행 {N}개 삭제.',
  'matrix.confirmReset': '{ROUND}의 모든 투표를 초기화할까요? 이 매트릭스의 모든 셀이 지워집니다. 심사위원 명단은 유지됩니다.',
  'matrix.confirmCommit': '{ROUND} 현재 순위를 통과자에 확정할까요?\n· 정원 안 (역할별 상위 {MAX}, 경계 동점 포함) → PASS=true\n· 그 외 (O>0) → PASS=false\n· O 표 없음 → 통과자 목록에서 제외',
  'matrix.confirmUncommit': '{ROUND} 통과자 확정을 되돌릴까요?\n· {ROUND} 의 통과자 행을 모두 삭제합니다.\n· 투표 / 심사위원 / 페어링은 유지되며, 다시 확정할 수 있습니다.\n· 다음 라운드에 이 통과자 기준의 페어링이나 투표가 이미 있으면 정합성이 깨질 수 있습니다.',
  'matrix.confirmDeleteJudge': '심사위원 "{NAME}"을 삭제할까요? 예선·본선·결승 모두에서 제거되며, 모든 라운드의 투표/점수가 함께 삭제됩니다.',
  'matrix.commitOnlyPrelimSemi': '확정은 예선/본선에서만 가능합니다. 결승 결과는 별도 관리됩니다.',
};

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  en: MESSAGES_EN as Record<MessageKey, string>,
  ko: MESSAGES_KO,
};
