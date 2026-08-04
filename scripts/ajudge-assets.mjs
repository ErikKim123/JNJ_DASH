#!/usr/bin/env node
/**
 * AI Judge 브라우저 자산 준비 — MediaPipe WASM + 포즈 모델.
 *
 * 사용: npm run ajudge:assets
 *
 * 촬영 화면(스펙 4.1)에서 '전신이 가이드 박스 안에 있을 때만 녹화 가능' 을
 * 판정하려면 브라우저에서 MediaPipe 를 돌려야 한다.
 * 자산이 39MB 라 저장소에 커밋하지 않고(.gitignore) 이 스크립트로 내려받는다.
 *
 * CDN 직접 참조 대신 자체 호스팅하는 이유:
 *   · 오프라인/폐쇄망 대회장에서도 동작
 *   · CDN 버전이 바뀌어 조용히 깨지는 것 방지
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_WASM = path.join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const DEST = path.join(ROOT, 'public', 'ajudge', 'mediapipe');
const DEST_WASM = path.join(DEST, 'wasm');

// lite 를 쓴다 — 브라우저 가이드는 '전신이 들어왔는지'만 보면 되므로
// 정확도보다 로딩 속도/발열이 중요하다. 서버 분석은 full 을 쓴다(worker/assets.py).
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/' +
  'pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const MODEL_DEST = path.join(DEST, 'pose_landmarker_lite.task');

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(SRC_WASM))) {
    console.error('✗ @mediapipe/tasks-vision 가 설치되어 있지 않습니다. npm install 을 먼저 실행하세요.');
    process.exit(1);
  }

  await fs.mkdir(DEST_WASM, { recursive: true });
  const files = await fs.readdir(SRC_WASM);
  let copied = 0;
  for (const f of files) {
    await fs.copyFile(path.join(SRC_WASM, f), path.join(DEST_WASM, f));
    copied++;
  }
  console.log(`✓ WASM ${copied}개 복사 → public/ajudge/mediapipe/wasm/`);

  if (await exists(MODEL_DEST)) {
    const st = await fs.stat(MODEL_DEST);
    console.log(`· 모델 이미 있음 (${(st.size / 1024 / 1024).toFixed(1)} MB)`);
  } else {
    console.log(`▶ 모델 다운로드: ${MODEL_URL}`);
    const res = await fetch(MODEL_URL);
    if (!res.ok) {
      console.error(`✗ 다운로드 실패 ${res.status}`);
      process.exit(1);
    }
    await fs.writeFile(MODEL_DEST, Buffer.from(await res.arrayBuffer()));
    const st = await fs.stat(MODEL_DEST);
    console.log(`✓ 모델 저장 (${(st.size / 1024 / 1024).toFixed(1)} MB)`);
  }

  console.log('\n✅ 준비 완료 — /ajudge 촬영 화면의 전신 가이드가 동작합니다.');
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
