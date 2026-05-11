// 모든 라운드 × 스텝 화면을 PNG로 캡처해 screenshots/ 폴더에 저장.
// 사용: npx playwright install chromium && node scripts/capture-steps.mjs
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.DASH_BASE || 'http://localhost:3000';
const CONTEST = process.env.CONTEST_ID || 'JNJ-001';
const OUT_DIR = path.resolve('screenshots');

// 라운드별 스텝 목록 (lib/sheets/types.ts STEPS_BY_ROUND와 동일)
const STEPS = {
  prelim: ['prep', 'pairing', 'pairingB', 'pairingC', 'open', 'live', 'wrapup', 'close', 'result'],
  semi:   ['prep', 'pairing', 'open', 'live', 'wrapup', 'close', 'result'],
  final:  ['prep', 'pairing', 'open', 'live', 'wrapup', 'close', 'result', 'ceremony'],
};

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  const summary = [];
  for (const round of Object.keys(STEPS)) {
    for (const step of STEPS[round]) {
      const url = `${BASE}/dashboard/${CONTEST}?round=${round}&step=${step}`;
      const filename = `${CONTEST}__${round}__${step}.png`;
      const outPath = path.join(OUT_DIR, filename);
      console.log(`→ ${round}/${step}  ${url}`);
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        // 페이지 내 SVG/사진 로딩 + 애니메이션 첫 프레임 대기
        await page.waitForTimeout(2500);
        await page.screenshot({ path: outPath, fullPage: false });
        summary.push({ round, step, ok: true, file: filename });
      } catch (e) {
        console.error(`  FAIL: ${e.message}`);
        summary.push({ round, step, ok: false, error: String(e.message || e) });
      }
    }
  }

  await browser.close();
  console.log('\n===== Capture summary =====');
  for (const s of summary) {
    console.log(`${s.ok ? '✅' : '❌'}  ${s.round}/${s.step}  ${s.ok ? s.file : '— ' + s.error}`);
  }
  console.log(`\n저장 경로: ${OUT_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
