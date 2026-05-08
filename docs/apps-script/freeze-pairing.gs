/**
 * JNJ Dash - 페어링 박제 Apps Script
 * ====================================
 *
 * 목적: 시트의 RAND() 휘발성 함수가 fetch마다 재계산되어 대시보드와 시트가
 *       어긋나는 문제를 해결. 셔플 결과를 정적 값으로 고정(박제).
 *
 * 설치 방법:
 *   1. 대상 시트 열기 (예: 잭앤질-001)
 *   2. 메뉴 → 확장 프로그램 → Apps Script
 *   3. 기본 코드 모두 지우고 이 파일 내용을 그대로 붙여넣기
 *   4. Ctrl+S 저장 → 프로젝트 이름 입력 (예: "JNJ Pairing Freeze")
 *   5. 시트로 돌아가서 새로고침(F5) → 메뉴에 "🎲 페어링 관리" 추가됨
 *
 * 사용 방법:
 *   메뉴 → 🎲 페어링 관리 → 선택:
 *     - "현재 페어링 박제": 지금 보이는 셔플 결과를 정적 값으로 고정
 *     - "셔플 후 박제": F9 셔플 1회 + 박제를 한 번에
 *     - "박제 해제 (수식 복원)": 백업해 둔 RAND() 수식 복원
 *
 * 적용 대상 탭:
 *   - 3-1.예선랜덤시트 (예선 페어링, A2:G21)
 *   - 4-1.본선랜덤    (본선 페어링, A2:G11)
 */

const PAIRING_TABS = [
  { name: '3-1.예선랜덤', range: 'A2:G21', label: '예선' },
  { name: '4-1.본선랜덤', range: 'A2:G11', label: '본선' },
];

// 박제 시 원본 수식을 백업할 숨김 시트 이름
const BACKUP_SHEET_NAME = '_pairing_formula_backup';

// ── 메뉴 등록 ─────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎲 페어링 관리')
    .addItem('현재 페어링 박제 (예선)',  'freezePrelim')
    .addItem('현재 페어링 박제 (본선)',  'freezeSemi')
    .addItem('현재 페어링 박제 (전부)',  'freezeAll')
    .addSeparator()
    .addItem('셔플 후 박제 (예선)',      'shuffleAndFreezePrelim')
    .addItem('셔플 후 박제 (본선)',      'shuffleAndFreezeSemi')
    .addSeparator()
    .addItem('박제 해제 (예선)',         'unfreezePrelim')
    .addItem('박제 해제 (본선)',         'unfreezeSemi')
    .addItem('박제 해제 (전부)',         'unfreezeAll')
    .addToUi();
}

// ── 공개 메뉴 함수 ────────────────────────────────────────────────────────
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
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(tabConfig.name);
  if (!sheet) {
    ss.toast(`탭 "${tabConfig.name}" 없음`, '⚠️ 박제 실패', 5);
    return;
  }

  const range = sheet.getRange(tabConfig.range);
  const formulas = range.getFormulas();
  const values = range.getValues();

  // 수식이 하나도 없으면 이미 박제된 상태
  const hasFormula = formulas.some(row => row.some(cell => cell));
  if (!hasFormula) {
    ss.toast(`${tabConfig.label} 이미 박제된 상태`, 'ℹ️', 3);
    return;
  }

  // 원본 수식 백업
  saveBackup(tabConfig, formulas);

  // 수식을 정적 값으로 치환
  range.setValues(values);

  ss.toast(`${tabConfig.label} 페어링 ${formulas.length}행 박제 완료`, '✅', 3);
}

/**
 * 셔플 후 박제: J1 셀을 변경해 RAND() 강제 재계산 → 박제.
 * J1 셀이 다른 수식을 참조한다면 단순히 1 증가시켜 셔플 트리거.
 */
function shuffleAndFreezeOne(tabConfig) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(tabConfig.name);
  if (!sheet) {
    ss.toast(`탭 "${tabConfig.name}" 없음`, '⚠️', 5);
    return;
  }
  const j1 = sheet.getRange('J1');
  const cur = Number(j1.getValue()) || 0;
  j1.setValue(cur + 1);
  SpreadsheetApp.flush(); // 재계산 강제
  freezeOne(tabConfig);
}

/**
 * 박제 해제: 백업된 수식 복원.
 */
function unfreezeOne(tabConfig) {
  const ss = SpreadsheetApp.getActive();
  const backup = ss.getSheetByName(BACKUP_SHEET_NAME);
  if (!backup) {
    ss.toast('백업 없음 — 박제한 적이 없거나 백업 시트가 삭제됨', '⚠️', 5);
    return;
  }
  const sheet = ss.getSheetByName(tabConfig.name);
  if (!sheet) {
    ss.toast(`탭 "${tabConfig.name}" 없음`, '⚠️', 5);
    return;
  }

  const formulas = loadBackup(tabConfig);
  if (!formulas) {
    ss.toast(`${tabConfig.label} 백업 없음`, '⚠️', 5);
    return;
  }

  sheet.getRange(tabConfig.range).setFormulas(formulas);
  ss.toast(`${tabConfig.label} 페어링 박제 해제 완료`, '✅', 3);
}

// ── 백업 저장/조회 ────────────────────────────────────────────────────────

function getOrCreateBackupSheet() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(BACKUP_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(BACKUP_SHEET_NAME);
    sheet.hideSheet();
  }
  return sheet;
}

function saveBackup(tabConfig, formulas) {
  const sheet = getOrCreateBackupSheet();
  // 직렬화: tabName | range | JSON.stringify(formulas)
  const key = `${tabConfig.name}|${tabConfig.range}`;
  const data = sheet.getDataRange().getValues();
  // 기존 항목 제거
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][0] === key) sheet.deleteRow(i + 1);
  }
  sheet.appendRow([key, JSON.stringify(formulas), new Date().toISOString()]);
}

function loadBackup(tabConfig) {
  const sheet = getOrCreateBackupSheet();
  const key = `${tabConfig.name}|${tabConfig.range}`;
  const data = sheet.getDataRange().getValues();
  for (const row of data) {
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
