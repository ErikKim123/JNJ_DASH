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

var PAIRING_TABS = [
  { name: '3-1.예선랜덤', range: 'A2:G21', label: '예선' },
  { name: '4-1.본선랜덤', range: 'A2:G11', label: '본선' },
];

// 박제 시 원본 수식을 백업할 숨김 시트 이름
var BACKUP_SHEET_NAME = '_pairing_formula_backup';

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
    .addToUi();
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

  ss.toast(tabConfig.label + ' 페어링 ' + formulas.length + '행 박제 완료', '✅', 3);
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
