// 페어링 데이터 스냅샷 — RAND() 휘발성 함수가 fetch마다 재계산되어 시트와 대시보드가
// 불일치하는 문제를 해결하기 위한 서버 사이드 락.
//
// 동작:
//   1. getPairingSnapshot(contestId, round): 파일이 있으면 그대로 반환, 없으면 null
//   2. savePairingSnapshot(...): 파일에 JSON 저장
//   3. clearPairingSnapshot(...): 파일 삭제 (운영자가 시트에서 재로드 요청 시)
//
// 저장 위치: data/snapshots/{contestId}-{round}-pairing.json
import { promises as fs } from 'fs';
import path from 'path';
import type { Pair, RoundKey } from './types';

const SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'snapshots');

function snapshotPath(contestId: string, round: RoundKey): string {
  // contestId 안전 문자만 통과 (JNJ-001 형식). 경로 주입 방지.
  const safeId = contestId.replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(SNAPSHOT_DIR, `${safeId}-${round}-pairing.json`);
}

export interface PairingSnapshot {
  contestId: string;
  round: RoundKey;
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
  pairs: Pair[]
): Promise<PairingSnapshot> {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
  const snapshot: PairingSnapshot = {
    contestId,
    round,
    pairs,
    savedAt: new Date().toISOString(),
  };
  await fs.writeFile(snapshotPath(contestId, round), JSON.stringify(snapshot, null, 2), 'utf8');
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
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw e;
  }
}
