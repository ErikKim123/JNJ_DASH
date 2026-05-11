/**
 * JNJ Score + JNJ Dash 통합 Apps Script
 * =====================================
 *
 * 두 기능을 한 파일에 합침:
 *
 *   ① [기존] JNJ Score Web App
 *      - 심사위원 앱이 점수/투표를 POST로 전송
 *      - "3.참가자" 시트의 심사위원별 컬럼에 O/X 또는 점수 기록
 *      - 자동 통과 컬럼은 시트가 알아서 계산
 *      - doPost / doGet / handleSubmit / handleRead / handleSubmitTo 등
 *
 *   ② [추가] 페어링 박제 (onOpen 메뉴)
 *      - "3-1.예선랜덤시트" / "4-1.본선랜덤" 의 RAND() 수식 → 정적 값으로 박제
 *      - 시트 메뉴에 "🎲 페어링 관리" 추가
 *      - 박제/박제해제/셔플후박제 메뉴 항목
 *
 * 두 기능은 서로 독립이라 충돌 없음.
 *
 * 설치:
 *   대상 시트 → 확장 프로그램 → Apps Script → 기존 코드 모두 삭제 → 이 파일
 *   내용 통째로 붙여넣기 → Ctrl+S → 시트 새로고침(F5)
 */

// ════════════════════════════════════════════════════════════════════════
// ① JNJ Score Web App (기존)
// ════════════════════════════════════════════════════════════════════════

var SHEET_NAME = '3.참가자';
var EXPECTED_TOKEN = 'CHANGE_ME_TOKEN'; // <-- set this AND match in .env.local
// Empty string → SpreadsheetApp.getActive() = the bound spreadsheet.
// Bind this script to your competition's master file:
//   open the master sheet → Extensions → Apps Script → paste this file.
// For multi-competition support, leave this empty and use action='submit_to'
// with sheetId in the body (requires elevated scope — see appsscript.json).
var SPREADSHEET_ID = '';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.token !== EXPECTED_TOKEN) {
      return jsonError('Invalid token');
    }
    if (body.action === 'rename_remarks_status') {
      return jsonOk({ result: renameRemarksToStatus() });
    }
    if (body.action === 'read') {
      return jsonOk(handleRead(body));
    }
    if (body.action === 'submit_to') {
      return jsonOk({ written: handleSubmitTo(body) });
    }
    if (body.action !== 'submit') {
      return jsonError('Unknown action');
    }
    var written = handleSubmit(body);
    return jsonOk({ written: written });
  } catch (err) {
    return jsonError(String(err && err.message ? err.message : err));
  }
}

function doGet() {
  return jsonOk({ ping: 'ok', sheet: SHEET_NAME });
}

function handleSubmit(body) {
  var round = body.round;
  var judgeId = String(body.judgeId || '');
  var entries = body.entries || [];
  if (!judgeId) throw new Error('Missing judgeId');
  if (!entries.length) return 0;

  var ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Sheet not found: ' + SHEET_NAME);

  var data = sh.getDataRange().getValues();
  var headerRow = findParticipantHeader(data);
  if (headerRow < 0) throw new Error('Cannot locate header row');

  var headers = data[headerRow].map(function (h) {
    return String(h || '').replace(/^☑\s*/, '').trim();
  });
  var subHeaders = headerRow + 1 < data.length
    ? data[headerRow + 1].map(function (h) { return String(h || '').trim(); })
    : [];

  var numIdx = headers.indexOf('참가번호');
  if (numIdx < 0) throw new Error('Missing 참가번호 column');

  if (round === 'prelim' || round === 'semi') {
    var col = findJudgeVoteColumn(headers, round, judgeId);
    if (col < 0) throw new Error('Judge VOTE column not found for ' + judgeId + ' in ' + round);
    var written = 0;
    entries.forEach(function (entry) {
      var rowIdx = findContestantRow(data, headerRow + 2, numIdx, entry.contestantId);
      if (rowIdx < 0) return;
      sh.getRange(rowIdx + 1, col + 1).setValue(mapStatusToVoteCell(entry));
      written++;
    });
    return written;
  }

  if (round === 'final') {
    var judgeCols = findFinalJudgeCols(headers, subHeaders, judgeId);
    if (!judgeCols) throw new Error('Judge columns not found for ' + judgeId);
    var written = 0;
    entries.forEach(function (entry) {
      var rowIdx = findContestantRow(data, headerRow + 2, numIdx, entry.contestantId);
      if (rowIdx < 0) return;
      sh.getRange(rowIdx + 1, judgeCols.basics + 1).setValue(entry.basics);
      sh.getRange(rowIdx + 1, judgeCols.connection + 1).setValue(entry.connection);
      sh.getRange(rowIdx + 1, judgeCols.musicality + 1).setValue(entry.musicality);
      written++;
    });
    return written;
  }

  throw new Error('Unknown round: ' + round);
}

// VOTE cell value for prelim/semi per-judge columns: ON → 'O', else → 'X'.
function mapStatusToVoteCell(entry) {
  var s = entry.status;
  if (!s && typeof entry.pass === 'boolean') s = entry.pass ? 'pass' : 'fail';
  return s === 'pass' ? 'O' : 'X';
}

// Locate the per-judge VOTE column for a given round.
//   prelim group = (col after 비고) ... (col before 예선 등수)
//   semi   group = (col after 예선통과...) ... (col before 본선 등수)
// Within each group, judge rank N (1-based) = groupStart + (N - 1).
function findJudgeVoteColumn(headers, round, judgeId) {
  var rank = parseInt(String(judgeId).replace(/^J/, ''), 10);
  if (!rank) return -1;

  if (round === 'prelim') {
    var startAfter = headers.indexOf('비고');
    var endBefore = headers.indexOf('예선 등수');
    if (endBefore < 0) endBefore = findHeaderStartingWith(headers, '예선통과');
    if (startAfter < 0 || endBefore < 0) return -1;
    var groupStart = startAfter + 1;
    var groupSize = endBefore - groupStart;
    if (rank > groupSize) return -1;
    return groupStart + rank - 1;
  }

  if (round === 'semi') {
    var startAfter = findHeaderStartingWith(headers, '예선통과');
    var endBefore = headers.indexOf('본선 등수');
    if (endBefore < 0) endBefore = findHeaderStartingWith(headers, '본선통과');
    if (startAfter < 0 || endBefore < 0) return -1;
    var groupStart = startAfter + 1;
    var groupSize = endBefore - groupStart;
    if (rank > groupSize) return -1;
    return groupStart + rank - 1;
  }

  return -1;
}

// Find first header whose stripped value starts with `prefix`.
// Tolerates "예선통과", "예선통과 (자동)", "☑ 예선통과 (자동)" (☑ already stripped upstream).
function findHeaderStartingWith(headers, prefix) {
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').trim();
    if (h.indexOf(prefix) === 0) return i;
  }
  return -1;
}

function findParticipantHeader(data) {
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === '참가번호') return i;
  }
  return -1;
}

function findContestantRow(data, startRow, numIdx, contestantId) {
  // contestantId is "C001" — strip leading C and compare numerically.
  var target = String(contestantId).replace(/^C/, '').replace(/^0+/, '');
  for (var i = startRow; i < data.length; i++) {
    var raw = String(data[i][numIdx] || '').trim();
    if (!raw) continue;
    var normalized = raw.replace(/^0+/, '');
    if (normalized === target) return i;
  }
  return -1;
}

function findFinalJudgeCols(headers, subHeaders, judgeId) {
  // Header has "① 김도윤", "② 이서연", ... judge columns span 3 sub-columns.
  // judgeId format: "J01" -> rank 1.
  var rank = parseInt(String(judgeId).replace(/^J/, ''), 10);
  if (!rank) return null;
  // Find the n-th judge column header (anything containing 김/이/박/etc names is too lax;
  // safer: find headers whose subheader is "기본기" — every 3 cols starts a new judge).
  var basicsCols = [];
  for (var i = 0; i < subHeaders.length; i++) {
    if (subHeaders[i] === '기본기') basicsCols.push(i);
  }
  if (basicsCols.length < rank) return null;
  var b = basicsCols[rank - 1];
  return { basics: b, connection: b + 1, musicality: b + 2 };
}

function jsonOk(data) {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, data: data }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function jsonError(message) {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: false, error: message }),
  ).setMimeType(ContentService.MimeType.JSON);
}

// Generic read of a sheet tab as 2D array. Used to fetch private master files.
// body: { action:"read", token, sheetId?, sheetName, range? }
//   sheetId   — defaults to SPREADSHEET_ID
//   sheetName — required (e.g. "2.심사위원")
//   range     — optional A1 range (e.g. "A1:Z200"); else full data range
function handleRead(body) {
  var sheetId = body.sheetId || SPREADSHEET_ID;
  if (!sheetId) throw new Error('Missing sheetId');
  var ss = SpreadsheetApp.openById(sheetId);
  var sh = ss.getSheetByName(body.sheetName);
  if (!sh) throw new Error('Sheet tab not found: ' + body.sheetName);
  var values = body.range
    ? sh.getRange(body.range).getValues()
    : sh.getDataRange().getValues();
  return { values: values };
}

// Submit to a specific master sheet (different from the bound one).
// body: { action:"submit_to", token, sheetId, judgeId, round, entries }
function handleSubmitTo(body) {
  if (!body.sheetId) throw new Error('Missing sheetId');
  var ss = SpreadsheetApp.openById(body.sheetId);
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Sheet not found: ' + SHEET_NAME);
  return writeRound(sh, body);
}

// Shared write logic extracted from handleSubmit so both endpoints reuse it.
function writeRound(sh, body) {
  var round = body.round;
  var judgeId = String(body.judgeId || '');
  var entries = body.entries || [];
  if (!judgeId) throw new Error('Missing judgeId');
  if (!entries.length) return 0;

  var data = sh.getDataRange().getValues();
  var headerRow = findParticipantHeader(data);
  if (headerRow < 0) throw new Error('Cannot locate header row');

  var headers = data[headerRow].map(function (h) {
    return String(h || '').replace(/^☑\s*/, '').trim();
  });
  var subHeaders = headerRow + 1 < data.length
    ? data[headerRow + 1].map(function (h) { return String(h || '').trim(); })
    : [];
  var numIdx = headers.indexOf('참가번호');
  if (numIdx < 0) throw new Error('Missing 참가번호 column');

  if (round === 'prelim' || round === 'semi') {
    var col = findJudgeVoteColumn(headers, round, judgeId);
    if (col < 0) throw new Error('Judge VOTE column not found for ' + judgeId + ' in ' + round);
    var written = 0;
    entries.forEach(function (entry) {
      var rowIdx = findContestantRow(data, headerRow + 2, numIdx, entry.contestantId);
      if (rowIdx < 0) return;
      sh.getRange(rowIdx + 1, col + 1).setValue(mapStatusToVoteCell(entry));
      written++;
    });
    return written;
  }

  if (round === 'final') {
    var rank = parseInt(String(judgeId).replace(/^J/, ''), 10);
    var basicsCols = [];
    for (var i = 0; i < subHeaders.length; i++) {
      if (subHeaders[i] === '기본기') basicsCols.push(i);
    }
    if (!rank || basicsCols.length < rank) throw new Error('Judge cols not found: ' + judgeId);
    var b = basicsCols[rank - 1];
    var written = 0;
    entries.forEach(function (entry) {
      var rowIdx = findContestantRow(data, headerRow + 2, numIdx, entry.contestantId);
      if (rowIdx < 0) return;
      sh.getRange(rowIdx + 1, b + 1).setValue(entry.basics);
      sh.getRange(rowIdx + 1, b + 2).setValue(entry.connection);
      sh.getRange(rowIdx + 1, b + 3).setValue(entry.musicality);
      written++;
    });
    return written;
  }

  throw new Error('Unknown round: ' + round);
}

// One-shot maintenance helper. Run once from the Apps Script editor:
// Editor → select function "renameRemarksToStatus" → click Run.
// Renames the "비고" header on "3.참가자" to "상태". Idempotent — safe to re-run.
function renameRemarksToStatus() {
  var ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Sheet not found: ' + SHEET_NAME);
  var data = sh.getDataRange().getValues();
  var headerRow = -1;
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === '참가번호') { headerRow = i; break; }
  }
  if (headerRow < 0) throw new Error('header row not found');
  var row = data[headerRow];
  for (var c = 0; c < row.length; c++) {
    if (String(row[c] || '').trim() === '비고') {
      sh.getRange(headerRow + 1, c + 1).setValue('상태');
      Logger.log('Renamed 비고 → 상태 at column ' + (c + 1));
      return 'renamed at column ' + (c + 1);
    }
  }
  Logger.log('No "비고" column found (already renamed?)');
  return 'no-op';
}


// ════════════════════════════════════════════════════════════════════════
// ② JNJ Dash 페어링 박제 (메뉴)
// ════════════════════════════════════════════════════════════════════════

// 예선 페어 행을 최대 99행(2~100)까지 박제 대상에 포함 — 향후 추가 페이지 확장 여유 확보.
// 본선 페어 행을 최대 50행(2~51)까지 박제 대상에 포함.
// 시트에는 모든 행 보존, jnj-dash 표출 한도는 별도 (예선 A/B/C × 20 = 60, 본선은 현재 10).
var PAIRING_TABS = [
  { name: '3-1.예선랜덤', range: 'A2:G100', label: '예선' },
  { name: '4-1.본선랜덤', range: 'A2:G51', label: '본선' },
];

// 행 확장 시 채워 넣을 마지막 행 (autoFill 대상)
var PRELIM_EXTEND_LAST_ROW = 100;
var SEMI_EXTEND_LAST_ROW = 51;

// 박제 시 원본 수식을 백업할 숨김 시트 이름
var BACKUP_SHEET_NAME = '_pairing_formula_backup';

// 인원 불일치 자리에 채울 폴백 표기 (3.참가자 시트에 헬퍼가 0명일 때만 사용).
// 컬럼 매핑: B=리더참가번호, C=리더팀명, D=리더대표자, E=팔로워참가번호, F=팔로워팀명, G=팔로워대표자
var HELPER_FALLBACK_NAME = '헬퍼유저';
var HELPER_FALLBACK_NUM = '—';

// ── 메뉴 등록 ─────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎲 페어링 관리')
    .addItem('🎲 새 셔플 (예선)',         'shufflePrelim')
    .addItem('🎲 새 셔플 (본선)',         'shuffleSemi')
    .addSeparator()
    .addItem('현재 페어링 박제 (예선)',   'freezePrelim')
    .addItem('현재 페어링 박제 (본선)',   'freezeSemi')
    .addItem('현재 페어링 박제 (전부)',   'freezeAll')
    .addSeparator()
    .addItem('셔플 후 박제 (예선)',       'shuffleAndFreezePrelim')
    .addItem('셔플 후 박제 (본선)',       'shuffleAndFreezeSemi')
    .addSeparator()
    .addItem('박제 해제 (예선)',          'unfreezePrelim')
    .addItem('박제 해제 (본선)',          'unfreezeSemi')
    .addItem('박제 해제 (전부)',          'unfreezeAll')
    .addSeparator()
    .addItem('행 확장 (예선 → 100행)',    'extendPrelimRows')
    .addItem('행 확장 (본선 → 50행)',     'extendSemiRows')
    .addItem('🔍 진단: 본선랜덤 수식 보기', 'diagnoseSemiPairingFormula')
    .addItem('⚡ 본선 50쌍 자동 (해제+확장+셔플)', 'prepareSemi50')
    .addItem('🔄 본선랜덤 재생성 (4.예선통과 → 50쌍 값)', 'rebuildSemiRandom50')
    .addItem('헬퍼유저 채우기 (예선)',     'fillHelpersPrelim')
    .addItem('헬퍼유저 채우기 (본선)',     'fillHelpersSemi')
    .addSeparator()
    .addItem('🟡 동점자 표시 (예선)',      'highlightTiesPrelim')
    .addItem('🟡 동점자 표시 (본선)',      'highlightTiesSemi')
    .addItem('동점자 표시 해제',          'clearTieHighlights')
    .addItem('⭐ 동점자 자동 표시 설치 (1회)', 'installTieAutoFormat')
    .addItem('동점자 자동 표시 제거',       'uninstallTieAutoFormat')
    .addSeparator()
    .addItem('🔧 통과자 시트 FILTER 마이그레이션', 'migrateQualifierFormulas')
    .addItem('🔍 진단: 3.참가자 AH 컬럼 상태',     'diagnoseAHColumn')
    .addSeparator()
    .addItem('🔍 진단: 3.참가자 헬퍼 확인',  'diagnoseHelpers')
    .addItem('🔍 진단: 예선 빈자리 강제채움', 'forceFillPrelim')
    .addToUi();
}

// ── 동점자 하이라이트 ────────────────────────────────────────────────────
// 시트 자동 통과(TRUE) 인원이 1.대회정보의 정원을 초과한 경우, 경계 등수의
// 동점자 행을 노란색 배경 + 비고 마커로 표시. 운영자가 시각적으로 식별 후
// 수동으로 통과/탈락을 결정할 수 있도록 도움.
function highlightTiesPrelim() { highlightTiesOne('prelim'); }
function highlightTiesSemi()   { highlightTiesOne('semi'); }

var TIE_HIGHLIGHT_COLOR = '#FFF4C2'; // 옅은 노란색
var TIE_REMARK_MARKER = '🟡 동점';

/** 헤더 배열에서 keywords 중 하나라도 포함된 첫 컬럼 인덱스 반환 (-1: 없음). */
function findColumnByKeywords(headers, keywords) {
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i] || '';
    for (var j = 0; j < keywords.length; j++) {
      if (h.indexOf(keywords[j]) >= 0) return i;
    }
  }
  return -1;
}

/** 1.대회정보 시트에서 라운드별 통과 정원 조회. 못 찾으면 null. */
function getCapacityFromContestInfo(round) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('1.대회정보');
  if (!sh) return null;
  var data = sh.getDataRange().getValues();
  var keyword = round === 'prelim' ? '예선 통과 인원' : '본선 통과 인원';
  for (var i = 0; i < data.length; i++) {
    var label = String(data[i][0] || '').trim();
    if (label.indexOf(keyword) >= 0) {
      var n = parseInt(String(data[i][1] || '0').replace(/[^0-9]/g, ''), 10);
      if (n > 0) return n;
    }
  }
  return null;
}

function highlightTiesOne(round) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME); // '3.참가자'
  var label = round === 'prelim' ? '예선' : '본선';
  if (!sh) {
    ss.toast('탭 "' + SHEET_NAME + '" 없음', '⚠️', 5);
    return;
  }

  var data = sh.getDataRange().getValues();
  var headerRow = findParticipantHeader(data);
  if (headerRow < 0) {
    ss.toast('헤더 행 못 찾음', '⚠️', 5);
    return;
  }
  var headers = data[headerRow].map(function (h) {
    return String(h || '').replace(/^☑\s*/, '').trim();
  });

  var roleIdx = findColumnByKeywords(headers, ['역할', '역활']);
  var rankIdx = findColumnByKeywords(headers, [
    round === 'prelim' ? '예선 등수' : '본선 등수',
    round === 'prelim' ? '예선등수' : '본선등수',
  ]);
  var passIdx = findColumnByKeywords(headers, [
    round === 'prelim' ? '예선통과' : '본선통과',
    round === 'prelim' ? '예선 통과' : '본선 통과',
  ]);
  var remarkIdx = findColumnByKeywords(headers, ['비고', '상태']);

  if (roleIdx < 0 || passIdx < 0) {
    ss.toast('필요 컬럼 못 찾음 (역할 / ' + label + '통과)', '⚠️', 5);
    return;
  }

  var capacity = getCapacityFromContestInfo(round);
  if (!capacity) {
    ss.toast('1.대회정보의 "' + label + ' 통과 인원" 못 찾음', '⚠️', 5);
    return;
  }

  // 역할별로 TRUE 그룹 분리 (등수 정보 포함)
  var groups = { '리더': [], '팔로워': [] };
  for (var i = headerRow + 1; i < data.length; i++) {
    var role = String(data[i][roleIdx] || '').trim();
    var passVal = String(data[i][passIdx] || '').toUpperCase();
    var isPass = passVal === 'TRUE' || passVal === '1';
    if (!isPass) continue;
    if (role !== '리더' && role !== '팔로워') continue;
    var rank = rankIdx >= 0 ? Number(data[i][rankIdx]) || 0 : 0;
    groups[role].push({ rowIdx: i, rank: rank });
  }

  // 각 역할별로 boundary rank의 동점자 식별
  var tieRowIndices = [];
  ['리더', '팔로워'].forEach(function (role) {
    var group = groups[role];
    if (group.length <= capacity) return; // 동점자 없음 (정원 이하)

    if (rankIdx < 0) {
      // 등수 컬럼 없으면 그냥 정원 초과분 모두 표시 (정확도는 낮음)
      group.forEach(function (g, idx) {
        if (idx >= capacity) tieRowIndices.push(g.rowIdx);
      });
      return;
    }

    // 등수가 낮은 순으로 정렬 후 정원-1 인덱스의 등수를 boundary로 본다
    group.sort(function (a, b) { return a.rank - b.rank; });
    var boundaryRank = group[capacity - 1].rank;
    // 같은 boundaryRank를 가진 모든 TRUE 행 = 동점자
    group.forEach(function (g) {
      if (g.rank === boundaryRank) tieRowIndices.push(g.rowIdx);
    });
  });

  if (tieRowIndices.length === 0) {
    ss.toast(label + ' 동점자 없음 — 정원과 일치', 'ℹ️', 4);
    return;
  }

  // 동점자 표시: A열(참가번호)을 노란색 배경 + 비고 컬럼에 마커 추가
  tieRowIndices.forEach(function (rowIdx) {
    sh.getRange(rowIdx + 1, 1).setBackground(TIE_HIGHLIGHT_COLOR);
    if (remarkIdx >= 0) {
      var existing = String(sh.getRange(rowIdx + 1, remarkIdx + 1).getValue() || '').trim();
      if (existing.indexOf(TIE_REMARK_MARKER) < 0) {
        var newVal = existing ? existing + ' / ' + TIE_REMARK_MARKER : TIE_REMARK_MARKER;
        sh.getRange(rowIdx + 1, remarkIdx + 1).setValue(newVal);
      }
    }
  });

  ss.toast(label + ' 동점자 ' + tieRowIndices.length + '명 표시 완료 (A열 노란색 + 비고 마커)', '✅', 5);
}

// ── 통과자 시트 FILTER 마이그레이션 ──────────────────────────────────────
// 4.예선통과 / 5.본선통과 시트의 기존 SMALL+IF 배열 수식을 FILTER로 교체.
// 이유: SMALL+IF는 캐시된 계산값이 stale 상태일 때 일부 행이 "0"으로 나오는 문제 발생.
//      FILTER는 단일 수식으로 자동 spill이라 안정적이고 항상 실시간.
//
// 1회 실행만으로 양쪽 시트(예선/본선) 동시 마이그레이션.
function migrateQualifierFormulas() {
  var ss = SpreadsheetApp.getActive();
  // 예선: 3.참가자.AH=TRUE인 행을 4.예선통과로, J열은 3.참가자.AY(본선통과)
  migrateOneQualifierSheet(ss, '4.예선통과', 'AH', 'AY');
  // 본선: 3.참가자.AY=TRUE인 행을 5.본선통과로, J열은 3.참가자.AZ(결승전)
  migrateOneQualifierSheet(ss, '5.본선통과', 'AY', 'AZ');
}

/**
 * 진단: 3.참가자 시트 AH(예선통과) 컬럼의 실제 값 타입/분포 확인.
 * FILTER 마이그레이션 후 결과가 비어있을 때 원인 진단용.
 */
function diagnoseAHColumn() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME); // '3.참가자'
  if (!sh) {
    SpreadsheetApp.getUi().alert('탭 "' + SHEET_NAME + '" 없음');
    return;
  }
  var range = sh.getRange('AH5:AH134');
  var values = range.getValues();
  var distribution = {};
  var sampleByType = {};
  for (var i = 0; i < values.length; i++) {
    var v = values[i][0];
    var t = typeof v;
    var key = t + ':' + JSON.stringify(v);
    distribution[key] = (distribution[key] || 0) + 1;
    if (!sampleByType[t]) sampleByType[t] = { value: v, row: i + 5 };
  }

  var lines = [];
  lines.push('AH5:AH134 값 분포 (' + values.length + '개 셀):');
  Object.keys(distribution).forEach(function (k) {
    lines.push('  ' + k + ' × ' + distribution[k] + '개');
  });
  lines.push('');
  lines.push('타입별 첫 샘플:');
  Object.keys(sampleByType).forEach(function (t) {
    var s = sampleByType[t];
    lines.push('  ' + t + ': 행' + s.row + ' = ' + JSON.stringify(s.value));
  });
  lines.push('');

  // FILTER 조건 시뮬레이션
  var matchByCondition = {
    '=1 (숫자)': 0,
    '=TRUE': 0,
    '*1>0 (강제 변환)': 0,
  };
  for (var i = 0; i < values.length; i++) {
    var v = values[i][0];
    if (v === 1 || v === '1') matchByCondition['=1 (숫자)']++;
    if (v === true) matchByCondition['=TRUE']++;
    var n = Number(v);
    if (!isNaN(n) && n > 0) matchByCondition['*1>0 (강제 변환)']++;
  }
  lines.push('FILTER 조건 매칭 시뮬레이션:');
  Object.keys(matchByCondition).forEach(function (k) {
    lines.push('  ' + k + ' → ' + matchByCondition[k] + '개 매칭');
  });

  SpreadsheetApp.getUi().alert(lines.join('\n'));
}

function migrateOneQualifierSheet(ss, tabName, passColLetter, nextPassColLetter) {
  var sh = ss.getSheetByName(tabName);
  if (!sh) {
    ss.toast('탭 "' + tabName + '" 없음 — 건너뜀', 'ℹ️', 4);
    return;
  }

  // 헤더 행 찾기 — A열에 '참가번호'가 있는 첫 행
  var data = sh.getDataRange().getValues();
  var headerRow = -1;
  for (var i = 0; i < Math.min(data.length, 15); i++) {
    if (String(data[i][0] || '').trim() === '참가번호') {
      headerRow = i + 1; // 1-based
      break;
    }
  }
  if (headerRow < 0) {
    ss.toast(tabName + ' 헤더 행("참가번호") 못 찾음', '⚠️', 5);
    return;
  }
  var firstDataRow = headerRow + 1;

  // 4.예선통과 컬럼 ↔ 3.참가자 컬럼 매핑
  // (A:참가번호, B:사진, C:팀명, D:대표자, E:장르, F:부문, G:연령대, H:소속, I:역할, J:다음라운드통과)
  var mapping = [
    { target: 1,  source: 'A' },   // 참가번호
    { target: 2,  source: 'B' },   // 사진
    { target: 3,  source: 'C' },   // 팀명/참가자명
    { target: 4,  source: 'D' },   // 대표자명
    { target: 5,  source: 'F' },   // 장르 (3.참가자 E=인원수 건너뛰고 F)
    { target: 6,  source: 'G' },   // 부문
    { target: 7,  source: 'H' },   // 연령대
    { target: 8,  source: 'M' },   // 소속(학교/크루)
    { target: 9,  source: 'J' },   // 역할
    { target: 10, source: nextPassColLetter }, // 다음 라운드 통과 (예선→AY, 본선→AZ)
  ];

  // 3.참가자 데이터 영역
  var sourceStart = 5;
  var sourceEnd = 134;

  // 기존 데이터 영역 클리어 (firstDataRow부터 끝까지 × 10컬럼)
  var maxRows = sh.getMaxRows();
  var clearRows = maxRows - firstDataRow + 1;
  if (clearRows > 0) {
    sh.getRange(firstDataRow, 1, clearRows, 10).clearContent();
  }

  // 새 FILTER 수식 — 각 컬럼 row=firstDataRow에 1개씩, 자동 spill
  // 조건: TRUE인 행만 가져옴. 3.참가자 AH/AY 컬럼은 TRUE/FALSE(체크박스 또는 boolean) 저장.
  mapping.forEach(function (m) {
    var sourceRange = "'3.참가자'!" + m.source + sourceStart + ":" + m.source + sourceEnd;
    var conditionRange = "'3.참가자'!" + passColLetter + sourceStart + ":" + passColLetter + sourceEnd;
    var formula =
      '=IFERROR(FILTER(' + sourceRange + ', ' + conditionRange + '=TRUE), "")';
    sh.getRange(firstDataRow, m.target).setFormula(formula);
  });

  // 재계산 강제
  SpreadsheetApp.flush();

  // 첫 셀(A_firstDataRow) 확인 — 결과가 비었으면 진단 정보 추가
  var firstCell = sh.getRange(firstDataRow, 1).getValue();
  var hasData = firstCell !== '' && firstCell !== null;
  var detail = hasData ? '데이터 있음' : '결과 비어있음 — 3.참가자 AH/AY 값 확인 필요';

  ss.toast(
    tabName + ' FILTER 적용 · 조건: 3.참가자.' + passColLetter + '=TRUE · ' + detail,
    hasData ? '✅' : '⚠️',
    7
  );
}

// ── 동점자 자동 표시 설치 (조건부 서식 + 보조 컬럼) ──────────────────────
// 1회 실행으로 3.참가자 시트에 영구적인 조건부 서식 규칙을 등록한다.
// 이후 시트 데이터가 바뀔 때마다 동점자가 자동으로 노란색 + "🟡 동점" 마커로 표시됨.
// 운영자가 별도 메뉴를 클릭할 필요 없음.
function installTieAutoFormat() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    ss.toast('탭 "' + SHEET_NAME + '" 없음', '⚠️', 5);
    return;
  }

  var data = sh.getDataRange().getValues();
  var headerRow = findParticipantHeader(data);
  if (headerRow < 0) {
    ss.toast('헤더 행 못 찾음', '⚠️', 5);
    return;
  }
  var headers = data[headerRow].map(function (h) {
    return String(h || '').replace(/^☑\s*/, '').trim();
  });

  var roleIdx = findColumnByKeywords(headers, ['역할', '역활']);
  var prelimPassIdx = findColumnByKeywords(headers, ['예선통과', '예선 통과']);
  var semiPassIdx = findColumnByKeywords(headers, ['본선통과', '본선 통과']);
  var prelimRankIdx = findColumnByKeywords(headers, ['예선 등수', '예선등수']);
  var semiRankIdx = findColumnByKeywords(headers, ['본선 등수', '본선등수']);

  var missing = [];
  if (roleIdx < 0) missing.push('역할');
  if (prelimPassIdx < 0) missing.push('예선통과');
  if (prelimRankIdx < 0) missing.push('예선 등수');
  if (missing.length > 0) {
    ss.toast('필요 컬럼 못 찾음: ' + missing.join(', '), '⚠️', 6);
    return;
  }

  // 데이터 시작 행 (헤더 다음 행, 1-based)
  var firstDataRow = headerRow + 2;
  var lastRow = Math.max(sh.getMaxRows(), 200);
  var lastCol = sh.getMaxColumns();

  // A1 표기로 변환 (1-based)
  function colA1(colIdx) {
    var n = colIdx + 1;
    var s = '';
    while (n > 0) {
      var rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  var roleCol = colA1(roleIdx);
  var prelimPassCol = colA1(prelimPassIdx);
  var prelimRankCol = colA1(prelimRankIdx);

  // 조건부 서식 수식 (예선)
  //   - 통과(TRUE)이고
  //   - 같은 역할의 통과자 중 가장 낮은 등수(MAXIFS = 등수 숫자가 큼)와 같고
  //   - 그 등수에 같은 역할 통과자가 2명 이상 (boundary 동점자)
  var prelimFormula =
    '=AND(' +
    '$' + prelimPassCol + firstDataRow + '=TRUE,' +
    '$' + prelimRankCol + firstDataRow + '=MAXIFS($' + prelimRankCol + ':$' + prelimRankCol + ',$' + roleCol + ':$' + roleCol + ',$' + roleCol + firstDataRow + ',$' + prelimPassCol + ':$' + prelimPassCol + ',TRUE),' +
    'COUNTIFS($' + roleCol + ':$' + roleCol + ',$' + roleCol + firstDataRow + ',$' + prelimRankCol + ':$' + prelimRankCol + ',$' + prelimRankCol + firstDataRow + ',$' + prelimPassCol + ':$' + prelimPassCol + ',TRUE)>1' +
    ')';

  // 본선용 (있는 경우만)
  var semiFormula = null;
  if (semiPassIdx >= 0 && semiRankIdx >= 0) {
    var semiPassCol = colA1(semiPassIdx);
    var semiRankCol = colA1(semiRankIdx);
    semiFormula =
      '=AND(' +
      '$' + semiPassCol + firstDataRow + '=TRUE,' +
      '$' + semiRankCol + firstDataRow + '=MAXIFS($' + semiRankCol + ':$' + semiRankCol + ',$' + roleCol + ':$' + roleCol + ',$' + roleCol + firstDataRow + ',$' + semiPassCol + ':$' + semiPassCol + ',TRUE),' +
      'COUNTIFS($' + roleCol + ':$' + roleCol + ',$' + roleCol + firstDataRow + ',$' + semiRankCol + ':$' + semiRankCol + ',$' + semiRankCol + firstDataRow + ',$' + semiPassCol + ':$' + semiPassCol + ',TRUE)>1' +
      ')';
  }

  // 기존 동점자 규칙 제거 (재실행 안전성)
  var existingRules = sh.getConditionalFormatRules();
  var filtered = existingRules.filter(function (rule) {
    var cond = rule.getBooleanCondition();
    if (!cond) return true;
    var v = cond.getCriteriaValues();
    if (!v || v.length === 0) return true;
    var f = String(v[0]);
    return f.indexOf('MAXIFS') < 0 || f.indexOf(prelimRankCol) < 0;
  });

  // 새 규칙 추가
  var range = sh.getRange(firstDataRow, 1, lastRow - firstDataRow + 1, lastCol);
  var bgColor = '#FFF4C2';
  var newRules = filtered.slice();

  var prelimRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(prelimFormula)
    .setBackground(bgColor)
    .setRanges([range])
    .build();
  newRules.push(prelimRule);

  if (semiFormula) {
    var semiRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(semiFormula)
      .setBackground(bgColor)
      .setRanges([range])
      .build();
    newRules.push(semiRule);
  }

  sh.setConditionalFormatRules(newRules);

  var msg = '예선 동점자 자동 표시 설치 완료';
  if (semiFormula) msg += ' (본선 포함)';
  msg += ' · 컬럼: 역할=' + roleCol + ' 통과=' + prelimPassCol + ' 등수=' + prelimRankCol;
  ss.toast(msg, '✅', 7);
}

/** installTieAutoFormat이 설치한 조건부 서식 규칙을 모두 제거. */
function uninstallTieAutoFormat() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) return;
  var existing = sh.getConditionalFormatRules();
  var kept = existing.filter(function (rule) {
    var cond = rule.getBooleanCondition();
    if (!cond) return true;
    var v = cond.getCriteriaValues();
    if (!v || v.length === 0) return true;
    var f = String(v[0]);
    // 우리가 만든 규칙(=AND(...MAXIFS...COUNTIFS...))만 제거
    return !(f.indexOf('MAXIFS') >= 0 && f.indexOf('COUNTIFS') >= 0);
  });
  var removed = existing.length - kept.length;
  sh.setConditionalFormatRules(kept);
  ss.toast('동점자 자동 표시 제거 완료 — 규칙 ' + removed + '개 삭제', '✅', 5);
}

/** 동점자 표시 해제 — 노란 배경 + 비고 마커 제거. */
function clearTieHighlights() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) return;
  var data = sh.getDataRange().getValues();
  var headerRow = findParticipantHeader(data);
  if (headerRow < 0) return;
  var headers = data[headerRow].map(function (h) {
    return String(h || '').replace(/^☑\s*/, '').trim();
  });
  var remarkIdx = findColumnByKeywords(headers, ['비고', '상태']);

  var cleared = 0;
  for (var i = headerRow + 1; i < data.length; i++) {
    var aCell = sh.getRange(i + 1, 1);
    var bg = aCell.getBackground();
    if (bg && bg.toUpperCase() === TIE_HIGHLIGHT_COLOR.toUpperCase()) {
      aCell.setBackground(null);
      cleared++;
    }
    if (remarkIdx >= 0) {
      var v = String(data[i][remarkIdx] || '');
      if (v.indexOf(TIE_REMARK_MARKER) >= 0) {
        var nv = v
          .replace(TIE_REMARK_MARKER + ' / ', '')
          .replace(' / ' + TIE_REMARK_MARKER, '')
          .replace(TIE_REMARK_MARKER, '')
          .trim();
        sh.getRange(i + 1, remarkIdx + 1).setValue(nv);
      }
    }
  }
  ss.toast('동점자 표시 해제 — ' + cleared + '행', '✅', 4);
}

/**
 * 진단: 3.참가자 시트를 읽어 헤더 위치, 컬럼 매핑, 헬퍼 행 개수를 popup으로 보고.
 * 헬퍼 자동 채움이 안 될 때 어디가 문제인지 정확히 알려줌.
 */
function diagnoseHelpers() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME);
  var lines = [];
  lines.push('[1] 시트 "' + SHEET_NAME + '" ' + (sh ? '발견 ✅' : '없음 ❌'));
  if (!sh) {
    SpreadsheetApp.getUi().alert(lines.join('\n'));
    return;
  }
  var data = sh.getDataRange().getValues();
  lines.push('[2] 총 ' + data.length + '행');

  var headerRow = findParticipantHeader(data);
  lines.push('[3] 헤더 행 인덱스: ' + headerRow + (headerRow < 0 ? ' ❌ (A열에 "참가번호" 셀이 없음)' : ' ✅'));
  if (headerRow < 0) {
    SpreadsheetApp.getUi().alert(lines.join('\n'));
    return;
  }

  var headers = data[headerRow].map(function (h) {
    return String(h || '').replace(/^☑\s*/, '').trim();
  });
  lines.push('[4] 헤더 행 내용 (1~12번째 컬럼):');
  lines.push('    ' + headers.slice(0, 12).map(function (h, i) {
    return String.fromCharCode(65 + i) + '=' + (h || '(빈)');
  }).join(' | '));

  var numIdx = headers.indexOf('참가번호');
  var nameIdx = -1, repIdx = -1, roleIdx = -1;
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    if (nameIdx < 0 && (h.indexOf('팀명') >= 0 || h.indexOf('참가자명') >= 0)) nameIdx = i;
    if (repIdx < 0 && h.indexOf('대표') >= 0) repIdx = i;
    if (roleIdx < 0 && (h.indexOf('역할') >= 0 || h.indexOf('역활') >= 0)) roleIdx = i;
  }
  lines.push('[5] 컬럼 매핑:');
  lines.push('    참가번호 = ' + (numIdx >= 0 ? String.fromCharCode(65 + numIdx) + '열' : '❌ 없음'));
  lines.push('    팀명/참가자명 = ' + (nameIdx >= 0 ? String.fromCharCode(65 + nameIdx) + '열 ("' + headers[nameIdx] + '")' : '❌ 없음'));
  lines.push('    대표자 = ' + (repIdx >= 0 ? String.fromCharCode(65 + repIdx) + '열 ("' + headers[repIdx] + '")' : '❌ 없음'));
  lines.push('    역할 = ' + (roleIdx >= 0 ? String.fromCharCode(65 + roleIdx) + '열 ("' + headers[roleIdx] + '")' : '❌ 없음'));

  if (roleIdx < 0) {
    lines.push('');
    lines.push('⚠️ 역할 컬럼을 못 찾음. 헤더 이름이 "역할"이 아닐 수 있음.');
    lines.push('    실제 헤더를 위 [4]에서 확인하세요. 다른 이름이면 알려주세요.');
    SpreadsheetApp.getUi().alert(lines.join('\n'));
    return;
  }

  // 모든 데이터 행의 역할 값 수집 + 분류 결과
  var roleValues = {};
  var byCat = { leader: 0, follower: 0, any: 0, none: 0 };
  var samples = { leader: [], follower: [], any: [] };
  for (var i = headerRow + 1; i < data.length; i++) {
    var role = String(data[i][roleIdx] || '').trim();
    if (!role) continue;
    roleValues[role] = (roleValues[role] || 0) + 1;
    var cat = classifyHelperRole(role);
    byCat[cat]++;
    if (cat !== 'none' && samples[cat].length < 3) {
      samples[cat].push({
        row: i + 1,
        num: String(data[i][numIdx] || ''),
        name: nameIdx >= 0 ? String(data[i][nameIdx] || '') : '',
        role: role,
      });
    }
  }

  lines.push('');
  lines.push('[6] 역할 컬럼의 모든 값 분포:');
  var roleKeys = Object.keys(roleValues);
  if (roleKeys.length === 0) {
    lines.push('    (역할 컬럼이 전부 비어있음) ❌');
  } else {
    roleKeys.forEach(function (k) {
      lines.push('    "' + k + '" × ' + roleValues[k] + '개  → ' + classifyHelperRole(k));
    });
  }

  lines.push('');
  lines.push('[7] 분류 결과 (헬퍼 풀):');
  lines.push('    헬퍼(리더) 풀: ' + byCat.leader + '명');
  lines.push('    헬퍼(팔로워) 풀: ' + byCat.follower + '명');
  lines.push('    공용 헬퍼 풀: ' + byCat.any + '명');

  ['leader', 'follower', 'any'].forEach(function (cat) {
    if (samples[cat].length === 0) return;
    lines.push('');
    lines.push('    [' + cat + '] 샘플:');
    samples[cat].forEach(function (h) {
      lines.push('      행' + h.row + ': 번호=' + h.num + ', 이름=' + h.name + ', 역할="' + h.role + '"');
    });
  });

  if (byCat.leader + byCat.follower + byCat.any === 0) {
    lines.push('');
    lines.push('⚠️ 헬퍼로 분류된 행이 0개. 역할 값에 "헬퍼"/"도우미" 키워드가 없음.');
    lines.push('    위 [6]의 실제 값을 알려주세요.');
  }

  SpreadsheetApp.getUi().alert(lines.join('\n'));
}

/**
 * 진단: 예선 페어링 범위의 빈 자리를 무조건 폴백 텍스트로 채움.
 * 헬퍼 조회 없이 단순 채우기 — 이게 작동하면 fillHelpers의 헬퍼 조회 단계가 문제임을 확정.
 */
function forceFillPrelim() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(PAIRING_TABS[0].name);
  if (!sheet) {
    ss.toast('탭 없음', '⚠️', 5);
    return;
  }
  var range = sheet.getRange(PAIRING_TABS[0].range);
  var formulas = range.getFormulas();
  var hasFormula = formulas.some(function (r) {
    return r.some(function (c) { return c; });
  });
  if (hasFormula) {
    ss.toast('수식 살아있음 — 박제 먼저', 'ℹ️', 5);
    return;
  }
  var values = range.getValues();
  var filled = 0;
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var hasLeader = String(row[2] || '').trim() !== '';
    var hasFollower = String(row[5] || '').trim() !== '';
    if (!hasLeader && !hasFollower) continue;
    if (hasLeader && hasFollower) continue;
    if (!hasLeader) {
      row[1] = HELPER_FALLBACK_NUM;
      row[2] = HELPER_FALLBACK_NAME;
      row[3] = HELPER_FALLBACK_NAME;
    } else {
      row[4] = HELPER_FALLBACK_NUM;
      row[5] = HELPER_FALLBACK_NAME;
      row[6] = HELPER_FALLBACK_NAME;
    }
    filled++;
  }
  if (filled === 0) {
    ss.toast('채울 빈 자리 없음 (감지 0건)', 'ℹ️', 5);
    return;
  }
  range.setValues(values);
  ss.toast('강제채움: ' + filled + '자리 (헬퍼유저/—)', '✅', 4);
}

// ── 헬퍼 자동 채움 ────────────────────────────────────────────────────────
function fillHelpersPrelim() { fillHelpersOne(PAIRING_TABS[0]); }
function fillHelpersSemi()   { fillHelpersOne(PAIRING_TABS[1]); }

/**
 * 3.참가자 시트의 역할 컬럼에서 '헬퍼'인 행을 모두 읽어 헬퍼 풀 반환.
 * 인식 패턴 (모두 대응):
 *   "헬퍼(리더)", "헬퍼 (리더)", "헬퍼（리더）" (전각 괄호), "리더 헬퍼", "헬퍼 리더" → leaders
 *   "헬퍼(팔로워)", "헬퍼（팔로워）", "팔로워 헬퍼", "헬퍼 팔로워"                  → followers
 *   "헬퍼", "도우미" (서브타입 없음)                                              → any (공용)
 *
 * 반환: { leaders: [...], followers: [...], any: [...] }
 *   각 항목 = { num, name, rep }
 */
function loadHelpersFromParticipants() {
  var empty = { leaders: [], followers: [], any: [] };
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME); // '3.참가자'
  if (!sh) return empty;

  var data = sh.getDataRange().getValues();
  var headerRow = findParticipantHeader(data);
  if (headerRow < 0) return empty;

  var headers = data[headerRow].map(function (h) {
    return String(h || '').replace(/^☑\s*/, '').trim();
  });

  var numIdx = headers.indexOf('참가번호');
  var nameIdx = -1, repIdx = -1, roleIdx = -1;
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    if (nameIdx < 0 && (h.indexOf('팀명') >= 0 || h.indexOf('참가자명') >= 0)) nameIdx = i;
    if (repIdx < 0 && h.indexOf('대표') >= 0) repIdx = i;
    if (roleIdx < 0 && (h.indexOf('역할') >= 0 || h.indexOf('역활') >= 0)) roleIdx = i;
  }
  if (numIdx < 0 || roleIdx < 0) return empty;

  var leaders = [], followers = [], any = [];
  for (var i = headerRow + 1; i < data.length; i++) {
    var roleRaw = String(data[i][roleIdx] || '').trim();
    if (!roleRaw) continue;
    var cat = classifyHelperRole(roleRaw);
    if (cat === 'none') continue;
    var num = String(data[i][numIdx] || '').trim();
    if (!num) continue;
    var entry = {
      num: num,
      name: nameIdx >= 0 ? String(data[i][nameIdx] || '').trim() : '',
      rep:  repIdx  >= 0 ? String(data[i][repIdx]  || '').trim() : '',
    };
    if (!entry.name) entry.name = HELPER_FALLBACK_NAME;
    if (!entry.rep)  entry.rep  = entry.name;
    if (cat === 'leader') leaders.push(entry);
    else if (cat === 'follower') followers.push(entry);
    else any.push(entry);
  }
  return { leaders: leaders, followers: followers, any: any };
}

/**
 * 역할 텍스트 1개를 분류. 반환: 'leader' | 'follower' | 'any' | 'none'
 * - 괄호(반각·전각·공백), 어순 차이 모두 정규화 후 매칭.
 */
function classifyHelperRole(role) {
  // 1) 정규화: 전각 괄호 → 반각, 모든 공백 제거
  var norm = role
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/\s+/g, '');
  // 2) 헬퍼/도우미 키워드 없으면 무시
  if (norm.indexOf('헬퍼') < 0 && norm.indexOf('도우미') < 0) return 'none';
  // 3) 리더 매칭: 헬퍼(리더), 리더헬퍼, 헬퍼리더 등
  if (/리더/.test(norm)) return 'leader';
  // 4) 팔로워 매칭
  if (/팔로워/.test(norm)) return 'follower';
  // 5) 헬퍼/도우미만 있고 서브타입 없음 → 공용
  return 'any';
}

// 헬퍼 풀에서 N번째 헬퍼 꺼냄 (모자라면 모듈러로 순환, 0명이면 폴백 텍스트).
function pickHelper(pool, n) {
  var preferred = pool && pool.length > 0 ? pool : null;
  if (preferred) return preferred[n % preferred.length];
  return { num: HELPER_FALLBACK_NUM, name: HELPER_FALLBACK_NAME, rep: HELPER_FALLBACK_NAME };
}

/**
 * 페어링 범위에서 한쪽이 비어있는 행을 찾아 3.참가자 시트의 헬퍼로 채움.
 * - 리더(C열)가 비고 팔로워(F열)가 있음 → 리더 자리에 헬퍼-리더
 * - 팔로워가 비고 리더가 있음 → 팔로워 자리에 헬퍼-팔로워
 * - 양쪽 다 비거나 양쪽 다 있으면 건너뜀
 * 박제(정적값) 상태에서 실행해야 의미 있음 — 수식이 살아있으면 안내 후 종료.
 */
function fillHelpersOne(tabConfig) {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(tabConfig.name);
  if (!sheet) {
    ss.toast('탭 "' + tabConfig.name + '" 없음', '⚠️', 5);
    return;
  }
  var range = sheet.getRange(tabConfig.range);
  var formulas = range.getFormulas();
  var hasFormula = formulas.some(function (r) {
    return r.some(function (c) { return c; });
  });
  if (hasFormula) {
    ss.toast(tabConfig.label + ' 수식 살아있음 — 박제 먼저 실행', 'ℹ️', 5);
    return;
  }

  var result = fillHelpersInValues(range);
  var poolMsg = '풀: L=' + result.poolLeader + ' F=' + result.poolFollower + ' A=' + result.poolAny;
  var idxMsg = result.idxFilled > 0 ? ' · 매칭번호 ' + result.idxFilled + '개 채움' : '';
  if (result.filled === 0 && result.idxFilled === 0) {
    ss.toast(tabConfig.label + ' 빈 자리 없음 · ' + poolMsg, 'ℹ️', 5);
    return;
  }
  var src = result.helpersFound ? '3.참가자 헬퍼' : '폴백';
  ss.toast(tabConfig.label + ' ' + result.filled + '자리 채움 (' + src + ')' + idxMsg + ' · ' + poolMsg, '✅', 7);
}

// 예선 페어링 행을 PRELIM_EXTEND_LAST_ROW까지 확장 — 2행의 수식을 그 이후 행에 복제(상대 참조 자동 보정).
// 이미 수식이 있는 행은 건너뜀.
function extendPrelimRows() {
  extendPairingRows(PAIRING_TABS[0], PRELIM_EXTEND_LAST_ROW);
}

// 본선 페어링 행을 SEMI_EXTEND_LAST_ROW까지 확장.
function extendSemiRows() {
  extendPairingRows(PAIRING_TABS[1], SEMI_EXTEND_LAST_ROW);
}

/**
 * 진단: 4-1.본선랜덤 시트의 row 2 수식을 그대로 popup으로 보여줌.
 * 행 확장 후에도 같은 10개만 반복되는지 확인하기 위함 — 원본 수식이
 * 5.본선통과!A2:A11 같은 fixed range를 참조하면 50행 확장해도 같은 데이터.
 */
function diagnoseSemiPairingFormula() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(PAIRING_TABS[1].name);
  if (!sh) {
    SpreadsheetApp.getUi().alert('탭 "' + PAIRING_TABS[1].name + '" 없음');
    return;
  }
  var range = sh.getRange('A2:G2');
  var formulas = range.getFormulas();
  var values = range.getValues();

  var lines = [];
  lines.push('4-1.본선랜덤 row 2 상태:');
  lines.push('');

  var hasFormula = false;
  for (var i = 0; i < 7; i++) {
    var letter = String.fromCharCode(65 + i);
    var f = formulas[0][i];
    var v = values[0][i];
    if (f) {
      hasFormula = true;
      lines.push('[' + letter + '2] 수식:');
      lines.push('  ' + f);
    } else {
      lines.push('[' + letter + '2] 정적값(박제됨): ' + JSON.stringify(v));
    }
    lines.push('');
  }

  lines.push('========');
  if (!hasFormula) {
    lines.push('⚠️ 모두 정적값 — 박제된 상태');
    lines.push('   → "박제 해제 (본선)" 먼저 실행 필요');
  } else {
    lines.push('✅ 수식 살아있음 — 행 확장 가능');
    lines.push('   수식의 소스 범위(예: 5.본선통과.A2:A11)가 fixed라면');
    lines.push('   행 확장해도 같은 데이터만 반복됨. 수식 직접 수정 필요.');
  }

  SpreadsheetApp.getUi().alert(lines.join('\n'));
}

/**
 * 본선랜덤 재생성 — 4.예선통과 시트에서 리더/팔로워를 읽어 무작위로 50쌍 페어링.
 * 결과는 4-1.본선랜덤에 정적 값으로 기록(수식 아님). 수식 깨짐/공백 문제 회피.
 * 재실행 시마다 새로 셔플됨.
 */
function rebuildSemiRandom50() {
  var ss = SpreadsheetApp.getActive();
  var srcSheet = ss.getSheetByName('4.예선통과');
  var dstSheet = ss.getSheetByName('4-1.본선랜덤');
  if (!srcSheet) {
    ss.toast('탭 "4.예선통과" 없음', '⚠️', 5);
    return;
  }
  if (!dstSheet) {
    ss.toast('탭 "4-1.본선랜덤" 없음', '⚠️', 5);
    return;
  }

  // 4.예선통과 데이터 읽기 — 헤더 행 찾고 그 이후 데이터 추출
  var srcData = srcSheet.getDataRange().getValues();
  var headerRow = -1;
  for (var i = 0; i < Math.min(srcData.length, 15); i++) {
    if (String(srcData[i][0] || '').trim() === '참가번호') {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) {
    ss.toast('4.예선통과 헤더 못 찾음', '⚠️', 5);
    return;
  }

  // 컬럼 매핑 (4.예선통과 기준): A=번호, C=팀명, D=대표자, I=역할
  var leaders = [];
  var followers = [];
  for (var i = headerRow + 1; i < srcData.length; i++) {
    var num = String(srcData[i][0] || '').trim();
    var name = String(srcData[i][2] || '').trim();
    var rep = String(srcData[i][3] || '').trim();
    var role = String(srcData[i][8] || '').trim();
    if (!num || !name) continue;
    var entry = { num: num, name: name, rep: rep || name };
    if (role === '리더') leaders.push(entry);
    else if (role === '팔로워') followers.push(entry);
  }

  if (leaders.length === 0 && followers.length === 0) {
    ss.toast('4.예선통과에 리더/팔로워 없음 — 통과자 시트 먼저 확인', '⚠️', 7);
    return;
  }

  // Fisher-Yates 셔플
  shuffleArray(leaders);
  shuffleArray(followers);

  // 최대 50쌍 — 부족한 쪽은 빈 값 (헬퍼 채우기 메뉴로 후처리)
  var maxPairs = Math.min(50, Math.max(leaders.length, followers.length));
  var output = [];
  for (var i = 0; i < maxPairs; i++) {
    var l = leaders[i] || { num: '', name: '', rep: '' };
    var f = followers[i] || { num: '', name: '', rep: '' };
    output.push([
      i + 1,        // A: 매칭번호
      l.num, l.name, l.rep,    // B,C,D: 리더
      f.num, f.name, f.rep,    // E,F,G: 팔로워
    ]);
  }

  // 기존 데이터 클리어 (헤더는 보존) — A2:G51 + 안전 여유
  var dstMaxRows = dstSheet.getMaxRows();
  if (dstMaxRows >= 2) {
    dstSheet.getRange(2, 1, dstMaxRows - 1, 7).clearContent();
  }

  // 새 데이터 쓰기
  if (output.length > 0) {
    dstSheet.getRange(2, 1, output.length, 7).setValues(output);
  }

  // 기존 백업 있으면 무효화 (혹시 또 unfreeze 누르면 깨진 수식 복원 안 되도록)
  var backup = ss.getSheetByName(BACKUP_SHEET_NAME);
  if (backup) {
    var backupData = backup.getDataRange().getValues();
    for (var i = backupData.length - 1; i >= 0; i--) {
      var key = String(backupData[i][0] || '');
      if (key.indexOf('4-1.본선랜덤') === 0) {
        backup.deleteRow(i + 1);
      }
    }
  }

  SpreadsheetApp.flush();
  ss.toast(
    '본선랜덤 재생성 완료: ' + output.length + '쌍 (리더 ' + leaders.length + '명 + 팔로워 ' + followers.length + '명 풀)',
    '✅',
    7
  );
}

/** Fisher-Yates shuffle (in-place). */
function shuffleArray(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

/**
 * 본선 50쌍 준비 자동화 — 박제 해제 → 행 확장 → 새 셔플을 순차 실행.
 * 박제는 운영자가 결과 확인 후 수동으로.
 */
function prepareSemi50() {
  var ss = SpreadsheetApp.getActive();
  var tabConfig = PAIRING_TABS[1];
  var sheet = ss.getSheetByName(tabConfig.name);
  if (!sheet) {
    ss.toast('탭 "' + tabConfig.name + '" 없음', '⚠️', 5);
    return;
  }

  var steps = [];

  // 1) 박제 해제 (필요한 경우)
  var range = sheet.getRange(tabConfig.range);
  var formulas = range.getFormulas();
  var hasFormula = formulas.some(function (row) {
    return row.some(function (cell) { return cell; });
  });
  if (!hasFormula) {
    var backupFormulas = loadBackup(tabConfig);
    if (backupFormulas) {
      sheet.getRange(tabConfig.range).setFormulas(backupFormulas);
      steps.push('박제 해제 ✅');
      SpreadsheetApp.flush();
    } else {
      ss.toast('박제 해제 실패 — 백업 없음. 수식 직접 입력 필요.', '⚠️', 7);
      return;
    }
  } else {
    steps.push('박제 해제 스킵(이미 수식 상태)');
  }

  // 2) 행 확장
  var ext = extendFormulasToRow(sheet, 'A2:G2', SEMI_EXTEND_LAST_ROW);
  if (ext.skipped) {
    ss.toast('행 확장 실패 — 2행에 수식 없음', '⚠️', 5);
    return;
  }
  steps.push('행 확장 ' + ext.filledRows + '개 ✅');

  // 3) 새 셔플
  var j1 = sheet.getRange('J1');
  var cur = Number(j1.getValue()) || 0;
  j1.setValue(cur + 1);
  SpreadsheetApp.flush();
  steps.push('새 셔플 J1=' + (cur + 1) + ' ✅');

  ss.toast('본선 50쌍 준비 완료: ' + steps.join(' · '), '✅', 8);
}

// 공용 페어링 행 확장 함수.
function extendPairingRows(tabConfig, lastRow) {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(tabConfig.name);
  if (!sheet) {
    ss.toast('탭 "' + tabConfig.name + '" 없음', '⚠️', 5);
    return;
  }
  var ext = extendFormulasToRow(sheet, 'A2:G2', lastRow);
  if (ext.skipped) {
    ss.toast(tabConfig.label + ' 2행에 수식이 없음 — 박제 해제 먼저 실행', 'ℹ️', 5);
    return;
  }
  ss.toast(
    tabConfig.label + ' 페어 행 ' + ext.filledRows + '개 확장 완료 (총 ' + ext.totalRows + '행, ~' + lastRow + '행)',
    '✅',
    4
  );
}

/**
 * sourceRange(A2:G2 등)의 수식을 lastRow까지 자동 채우기.
 * Range.autoFill을 사용해 상대 참조가 행별로 자동 보정되도록 함.
 * 이미 수식이 들어있는 행은 덮어쓰지 않음.
 */
function extendFormulasToRow(sheet, sourceRangeA1, lastRow) {
  var src = sheet.getRange(sourceRangeA1);
  var srcFormulas = src.getFormulas();
  var hasFormula = srcFormulas.some(function (row) {
    return row.some(function (cell) { return cell; });
  });
  if (!hasFormula) {
    return { skipped: true, filledRows: 0, totalRows: 0 };
  }

  var startRow = src.getLastRow() + 1; // 2행이 src면 3행부터 채움
  if (startRow > lastRow) {
    return { skipped: false, filledRows: 0, totalRows: 0 };
  }

  // 비어있지 않은 가장 큰 행 찾기 (이미 일부 확장되어 있으면 그 이후만 추가)
  var existing = sheet.getRange(startRow, src.getColumn(), lastRow - startRow + 1, src.getNumColumns()).getFormulas();
  var firstEmptyOffset = 0;
  for (var i = 0; i < existing.length; i++) {
    var rowHasFormula = existing[i].some(function (c) { return c; });
    if (rowHasFormula) firstEmptyOffset = i + 1;
  }
  var fillStart = startRow + firstEmptyOffset;
  if (fillStart > lastRow) {
    return { skipped: false, filledRows: 0, totalRows: lastRow - src.getRow() };
  }

  // autoFill: source + destination 범위가 연속이어야 함
  var dest = sheet.getRange(src.getRow(), src.getColumn(), lastRow - src.getRow() + 1, src.getNumColumns());
  src.autoFill(dest, SpreadsheetApp.AutoFillSeries.DEFAULT_SERIES);

  return {
    skipped: false,
    filledRows: lastRow - fillStart + 1,
    totalRows: lastRow - src.getRow(),
  };
}

// ── 공개 메뉴 함수 ────────────────────────────────────────────────────────
function shufflePrelim() { shuffleOne(PAIRING_TABS[0]); }
function shuffleSemi()   { shuffleOne(PAIRING_TABS[1]); }

function freezePrelim() { freezeOne(PAIRING_TABS[0]); }
function freezeSemi()   { freezeOne(PAIRING_TABS[1]); }
function freezeAll()    { PAIRING_TABS.forEach(freezeOne); SpreadsheetApp.getActive().toast('전체 박제 완료', '✅', 3); }

function shuffleAndFreezePrelim() { shuffleAndFreezeOne(PAIRING_TABS[0]); }
function shuffleAndFreezeSemi()   { shuffleAndFreezeOne(PAIRING_TABS[1]); }

function unfreezePrelim() { unfreezeOne(PAIRING_TABS[0]); }
function unfreezeSemi()   { unfreezeOne(PAIRING_TABS[1]); }
function unfreezeAll()    { PAIRING_TABS.forEach(unfreezeOne); SpreadsheetApp.getActive().toast('전체 박제 해제 완료', '✅', 3); }

// ── 핵심 로직 ─────────────────────────────────────────────────────────────

/**
 * 박제: 해당 범위의 수식을 현재 계산된 값으로 치환.
 * 원본 수식은 _pairing_formula_backup 시트에 백업.
 */
function freezeOne(tabConfig) {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(tabConfig.name);
  if (!sheet) {
    ss.toast('탭 "' + tabConfig.name + '" 없음', '⚠️ 박제 실패', 5);
    return;
  }

  var range = sheet.getRange(tabConfig.range);
  var formulas = range.getFormulas();
  var values = range.getValues();

  // 수식이 하나도 없으면 이미 박제된 상태
  var hasFormula = formulas.some(function (row) {
    return row.some(function (cell) { return cell; });
  });
  if (!hasFormula) {
    ss.toast(tabConfig.label + ' 이미 박제된 상태', 'ℹ️', 3);
    return;
  }

  // 원본 수식 백업
  saveBackup(tabConfig, formulas);

  // 수식을 정적 값으로 치환
  range.setValues(values);

  // 인원 불일치 자리(한쪽만 비어있는 행)에 3.참가자 시트의 헬퍼로 자동 채움.
  // 박제(setValues)로 정적 상태가 된 직후라 안전.
  var helperResult = fillHelpersInValues(range);

  var msg = tabConfig.label + ' 페어링 ' + formulas.length + '행 박제';
  if (helperResult.filled > 0) {
    var src = helperResult.helpersFound ? '3.참가자 헬퍼' : '폴백';
    msg += ' · ' + helperResult.filled + '자리 채움(' + src + ')';
  }
  if (helperResult.idxFilled > 0) {
    msg += ' · 매칭번호 ' + helperResult.idxFilled + '개 채움';
  }
  msg += ' · 풀: L=' + helperResult.poolLeader + ' F=' + helperResult.poolFollower + ' A=' + helperResult.poolAny;
  ss.toast(msg, '✅', 7);
}

// 박제 직후/메뉴에서 호출되는 내부 헬퍼.
// 반환: { filled, helpersFound, poolLeader, poolFollower, poolAny, idxFilled }
function fillHelpersInValues(range) {
  var pool = loadHelpersFromParticipants();
  var helpersFound = (pool.leaders.length + pool.followers.length + pool.any.length) > 0;
  // 리더 자리용 풀(우선순위): leaders → any → []. 팔로워 자리용: followers → any → [].
  var leaderPool = pool.leaders.length > 0 ? pool.leaders : pool.any;
  var followerPool = pool.followers.length > 0 ? pool.followers : pool.any;

  var values = range.getValues();
  var leaderIdx = 0, followerIdx = 0;
  var filled = 0;
  var idxFilled = 0;
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var hasLeader = String(row[2] || '').trim() !== '';
    var hasFollower = String(row[5] || '').trim() !== '';
    if (!hasLeader && !hasFollower) {
      // 빈 행은 매칭번호도 비워둠 (페어가 없음을 의미)
      continue;
    }
    if (hasLeader && hasFollower) {
      // 양쪽 다 있음 — 매칭번호만 비어있으면 채움
      if (!String(row[0] || '').toString().trim()) {
        row[0] = i + 1;
        idxFilled++;
      }
      continue;
    }

    if (!hasLeader) {
      var h = pickHelper(leaderPool, leaderIdx++);
      row[1] = h.num;
      row[2] = h.name;
      row[3] = h.rep;
    } else {
      var h = pickHelper(followerPool, followerIdx++);
      row[4] = h.num;
      row[5] = h.name;
      row[6] = h.rep;
    }
    // 헬퍼 채운 행도 매칭번호 비어있으면 같이 채움
    if (!String(row[0] || '').toString().trim()) {
      row[0] = i + 1;
      idxFilled++;
    }
    filled++;
  }
  if (filled > 0 || idxFilled > 0) range.setValues(values);
  return {
    filled: filled,
    idxFilled: idxFilled,
    helpersFound: helpersFound,
    poolLeader: pool.leaders.length,
    poolFollower: pool.followers.length,
    poolAny: pool.any.length,
  };
}

/**
 * 새 셔플: J1 셀을 변경해 RAND() 강제 재계산 (박제는 안 함).
 * 박제 전 단계에서 마음에 드는 셔플이 나올 때까지 반복 클릭 가능.
 * 박제 후 다시 셔플하려면 먼저 "박제 해제"를 실행해야 함.
 */
function shuffleOne(tabConfig) {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(tabConfig.name);
  if (!sheet) {
    ss.toast('탭 "' + tabConfig.name + '" 없음', '⚠️', 5);
    return;
  }

  // 박제된 상태(수식 없음)면 셔플해도 의미 없음 → 안내
  var range = sheet.getRange(tabConfig.range);
  var formulas = range.getFormulas();
  var hasFormula = formulas.some(function (row) {
    return row.some(function (cell) { return cell; });
  });
  if (!hasFormula) {
    ss.toast(tabConfig.label + ' 박제된 상태 — "박제 해제" 먼저 실행', 'ℹ️', 5);
    return;
  }

  var j1 = sheet.getRange('J1');
  var cur = Number(j1.getValue()) || 0;
  j1.setValue(cur + 1);
  SpreadsheetApp.flush(); // 재계산 강제

  ss.toast(tabConfig.label + ' 새 셔플 완료 (J1=' + (cur + 1) + ')', '🎲', 3);
}

/**
 * 셔플 후 박제: J1 셀을 변경해 RAND() 강제 재계산 → 박제.
 * J1 셀이 다른 수식을 참조한다면 단순히 1 증가시켜 셔플 트리거.
 */
function shuffleAndFreezeOne(tabConfig) {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(tabConfig.name);
  if (!sheet) {
    ss.toast('탭 "' + tabConfig.name + '" 없음', '⚠️', 5);
    return;
  }
  var j1 = sheet.getRange('J1');
  var cur = Number(j1.getValue()) || 0;
  j1.setValue(cur + 1);
  SpreadsheetApp.flush(); // 재계산 강제
  freezeOne(tabConfig);
}

/**
 * 박제 해제: 백업된 수식 복원.
 */
function unfreezeOne(tabConfig) {
  var ss = SpreadsheetApp.getActive();
  var backup = ss.getSheetByName(BACKUP_SHEET_NAME);
  if (!backup) {
    ss.toast('백업 없음 — 박제한 적이 없거나 백업 시트가 삭제됨', '⚠️', 5);
    return;
  }
  var sheet = ss.getSheetByName(tabConfig.name);
  if (!sheet) {
    ss.toast('탭 "' + tabConfig.name + '" 없음', '⚠️', 5);
    return;
  }

  var formulas = loadBackup(tabConfig);
  if (!formulas) {
    ss.toast(tabConfig.label + ' 백업 없음', '⚠️', 5);
    return;
  }

  sheet.getRange(tabConfig.range).setFormulas(formulas);
  ss.toast(tabConfig.label + ' 페어링 박제 해제 완료', '✅', 3);
}

// ── 백업 저장/조회 ────────────────────────────────────────────────────────

function getOrCreateBackupSheet() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(BACKUP_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(BACKUP_SHEET_NAME);
    sheet.hideSheet();
  }
  return sheet;
}

function saveBackup(tabConfig, formulas) {
  var sheet = getOrCreateBackupSheet();
  // 직렬화: tabName | range | JSON.stringify(formulas)
  var key = tabConfig.name + '|' + tabConfig.range;
  var data = sheet.getDataRange().getValues();
  // 기존 항목 제거
  for (var i = data.length - 1; i >= 0; i--) {
    if (data[i][0] === key) sheet.deleteRow(i + 1);
  }
  sheet.appendRow([key, JSON.stringify(formulas), new Date().toISOString()]);
}

function loadBackup(tabConfig) {
  var sheet = getOrCreateBackupSheet();
  var key = tabConfig.name + '|' + tabConfig.range;
  var data = sheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (row[0] === key) {
      try {
        return JSON.parse(row[1]);
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}
