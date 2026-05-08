// Design Ref: §10 — 서버 환경변수 검증.
// gviz CSV 엔드포인트 사용 → API Key 불필요.
// 실제 운영팀 시트는 탭 이름이 변동 가능하므로 gid(시트별 고유번호)를 우선 사용.
import { z } from 'zod';

const ServerEnvSchema = z.object({
  CONTEST_LIST_SHEET_ID: z.string().min(20, 'CONTEST_LIST_SHEET_ID is missing or invalid'),
  // 대회목록 탭의 gid (Google Sheets URL의 #gid=... 부분).
  // 이 시트에서 "대회 목록"이 위치한 탭 ID. 0이면 첫 번째 탭.
  CONTEST_LIST_SHEET_GID: z
    .string()
    .optional()
    .default('2102151233')
    .transform((v) => v),
  // 폴백용 탭 이름 (gid 미지정 시 사용 — 이전 버전 호환)
  CONTEST_LIST_SHEET_TAB: z.string().min(1).default('대회정보'),
  SHEETS_CACHE_TTL_SECONDS: z
    .string()
    .optional()
    .default('5')
    .transform((v) => Number.parseInt(v, 10))
    .pipe(z.number().int().min(1).max(300)),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid server environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
