// 페어링 데이터 스냅샷 — RAND() 휘발성 함수가 fetch마다 재계산되어 시트와 대시보드가
// 불일치하는 문제를 해결하기 위한 서버 사이드 락.
//
// 동작:
//   1. getPairingSnapshot(contestId, round): 파일이 있으면 그대로 반환, 없으면 null
//   2. savePairingSnapshot(...): 파일에 JSON 저장
//   3. clearPairingSnapshot(...): 파일 삭제 (운영자가 시트에서 재로드 요청 시)
//
// 저장 위치:
//   - 로컬: <project>/data/snapshots/
//   - Vercel: /tmp/jnj-dash-snapshots/  (서버리스의 빌드 디렉토리는 읽기 전용,
//     /tmp만 쓰기 가능. 인스턴스별이라 cold start 시 사라지지만 RAND() 락 용도로는 충분)
// 쓰기 실패 시에는 throw하지 않고 경고 로그만 남겨 요청 자체는 살림.
import { promises as fs } from 'fs';
import path from 'path';
import type { Pair, RoundKey } from './types';

// Vercel/AWS Lambda 등 서버리스 환경 감지. process.cwd()가 읽기 전용일 수 있음.
const IS_SERVERLESS = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const SNAPSHOT_DIR = IS_SERVERLESS
  ? path.join('/tmp', 'jnj-dash-snapshots')
  : path.join(process.cwd(), 'data', 'snapshots');

function snapshotPath(contestId: string, round: RoundKey): string {
  // contestId 안전 문자만 통과 (JNJ-001 형식). 경로 주입 방지.
  const safeId = contestId.replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(SNAPSHOT_DIR, `${safeId}-${round}-pairing.json`);
}

export interface PairingSnapshot {
  contestId: string;
  round: RoundKey;
  /** 박제 당시 마스터시트 ID. 운영팀이 마스터를 교체하면 자동 무효화 트리거. */
  spreadsheetId?: string;
  pairs: Pair[];
  savedAt: string;
}

export async function getPairingSnapshot(
  contestId: string,
  round: RoundKey
): Promise<PairingSnapshot | null> {
  try {
    const raw = await fs.readFile(snapshotPath(contestId, round), 'utf8');
    return JSON.parse(raw) as PairingSnapshot;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export async function savePairingSnapshot(
  contestId: string,
  round: RoundKey,
  pairs: Pair[],
  spreadsheetId?: string
): Promise<PairingSnapshot> {
  const snapshot: PairingSnapshot = {
    contestId,
    round,
    spreadsheetId,
    pairs,
    savedAt: new Date().toISOString(),
  };
  try {
    await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
    await fs.writeFile(snapshotPath(contestId, round), JSON.stringify(snapshot, null, 2), 'utf8');
  } catch (e) {
    // 읽기 전용 FS(EROFS) / 권한 부족(EACCES) — 락 기능은 약화되지만 요청은 살림.
    // 페어링은 시트에서 박제(combined.gs)되었다면 어차피 매번 같은 값이 옴.
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM') {
      console.warn(
        `[snapshot] write failed (${code}) — skipping persistence. ` +
          'On Vercel this is expected for non-/tmp paths.'
      );
      return snapshot;
    }
    throw e;
  }
  return snapshot;
}

export async function clearPairingSnapshot(
  contestId: string,
  round: RoundKey
): Promise<boolean> {
  try {
    await fs.unlink(snapshotPath(contestId, round));
    return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return false;
    if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM') return false;
    throw e;
  }
}
