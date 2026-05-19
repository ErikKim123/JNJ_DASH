// Design Ref: §10 — 서버 환경변수 검증.
// gviz CSV 엔드포인트 사용 → API Key 불필요.
// 실제 운영팀 시트는 탭 이름이 변동 가능하므로 gid(시트별 고유번호)를 우선 사용.
import { z } from 'zod';

// 대회목록 마스터 시트 ID 기본값.
// gviz CSV는 "링크 보유자 보기" 권한만 있으면 누구나 읽을 수 있는 공개 데이터이므로
// 코드에 박아도 보안 이슈 없음. 환경변수로 덮어쓰기 가능 (다른 마스터 시트로 전환 시).
const DEFAULT_CONTEST_LIST_SHEET_ID = '1bRclkuN8fuSfhoSrRUEtBjPPx6TePofxojE72qHV6iU';

const ServerEnvSchema = z.object({
  CONTEST_LIST_SHEET_ID: z
    .string()
    .min(20, 'CONTEST_LIST_SHEET_ID is missing or invalid')
    .optional()
    .default(DEFAULT_CONTEST_LIST_SHEET_ID),
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
  // Supabase — DB 중심 운영(Phase 1) 부터 사용. 표출 화면은 anon, 운영 API 는 service role.
  // 클라이언트 노출 가능 (NEXT_PUBLIC_*) 키는 노출되어도 RLS 로 막힘.
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  // 자료운영 UI(/admin) 보호용 PIN. 누락 시 인증 미들웨어가 throw → /admin 사용 불가.
  // 표출 화면은 영향 없음.
  ADMIN_PIN: z.string().min(4).optional(),
  ADMIN_SESSION_SECRET: z.string().optional(),
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
