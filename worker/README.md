# AI Judge 분석 워커

영상을 분석해 온비트 지표와 AI 코칭 코멘트를 산출하는 **별도 프로세스**다. Next.js 앱과 코드를 공유하지 않고, **Supabase 테이블과 Storage 만을 계약면**으로 통신한다.

- 설계: [docs/02-design/features/ai-judge.design.md](../docs/02-design/features/ai-judge.design.md) §7
- 판정 기준: [docs/rubric.md](../docs/rubric.md) v1.0

## 절대 원칙

1. **Timing 축에만 점수를 부여한다.** Technique/Teamwork/Musicality 는 코멘트만. Claude 출력 스키마에 숫자 필드가 아예 없어 구조적으로 불가능하다.
2. **모든 결과에 `confidence` 를 포함한다.** `low` 면 지표를 숨긴다. 산출처는 `confidence.compute_confidence()` **단 하나**.
3. **순위·합격/불합격을 판정하지 않는다.**

---

## 설치

```bash
# 저장소 루트에서
python -m venv worker/.venv
worker/.venv/Scripts/activate          # Windows
# source worker/.venv/bin/activate     # macOS/Linux
pip install -r worker/requirements.txt
```

### 시스템 의존성 — ffmpeg

영상에서 오디오 트랙을 추출하는 데 필요하다. **PATH 에 있어야 한다.**

```powershell
winget install Gyan.FFmpeg
# 또는 https://www.gyan.dev/ffmpeg/builds/ 에서 full build 를 받아 bin/ 을 PATH 에 추가
```

설치 후 새 터미널에서 `ffmpeg -version` 이 나오는지 확인.

## 환경변수

저장소 루트의 `.env.local` 을 그대로 재사용하므로 로컬에서는 추가 설정이 거의 없다.
워커 전용 값만 덮어쓰려면 `worker/.env` 를 만든다 (`worker/.env.example` 참고).

| 변수 | 필수 | 용도 |
|------|:----:|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | project ref 추출 + Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Storage 접근 (RLS 우회) |
| `SUPABASE_DB_PASSWORD` | ✅ | Postgres 직접 접속 (큐/리포트) |
| `SUPABASE_DB_POOLER_HOST` | — | 기본 `aws-0-ap-northeast-1.pooler.supabase.com` |
| `ANTHROPIC_API_KEY` | 코멘트 단계 | Claude vision 코멘트 생성 |
| `RESEND_API_KEY` | 알림 단계 | 완료 이메일 |
| `AI_JUDGE_WORKER_ID` | — | 워커 식별자. 기본 `worker-<pid>` |
| `AI_JUDGE_POLL_SECONDS` | — | 폴링 주기. 기본 10 |
| `AI_JUDGE_STALE_MINUTES` | — | stale 잡 회수 기준. 기본 30 |

> ⚠️ Vercel 환경변수 등록 시 PowerShell 파이프를 쓰지 말 것 (BOM 오염). bash `printf` 사용.

## 실행

```bash
# 기동 점검 — 환경/DB/큐/Storage/ffmpeg/라이브러리
python -m worker.check

# 단건 분석 (사이클 1 검증)         ※ S3 에서 구현
python -m worker.cli --video worker/samples/solo_ok.mp4 --role leader

# 상시 폴링                          ※ S3 에서 구현
python -m worker.main
```

## 큐 동작

```
queued ──claim_job()──▶ pose ──▶ beat ──▶ comment ──▶ done
   ▲                                                    │
   └──── requeue_stale_jobs() (30분 방치 · attempts<3) ──┘
                          │
                          └──▶ failed (error_code 기록)
```

- **claim 은 원자적이다.** `ai_judge.claim_job()` 이 `FOR UPDATE SKIP LOCKED` 를 쓰므로 워커를 여러 대 띄워도 같은 잡을 두 번 처리하지 않는다.
- **`attempts >= 3` 인 잡은 자동 회수하지 않는다.** 무한 재시도를 막기 위한 것이며 수동 확인 대상이다.
- **코멘트 생성 실패는 잡을 실패시키지 않는다.** 지표는 이미 산출됐으므로 `comments_json={}` 으로 리포트를 저장하고 `done` 으로 둔다 (`errors.NON_FATAL_CODES`).

## 설계 데비에이션

| ID | 내용 | 근거 |
|----|------|------|
| **D-1** | 큐·리포트를 supabase-py 가 아닌 **psycopg 직접 접속**으로 처리 | PostgREST "Exposed schemas" 대시보드 수동 설정에 의존하지 않고, `FOR UPDATE SKIP LOCKED` 를 그대로 쓸 수 있다. Storage 는 계속 Supabase SDK 사용 |
| **D-2** | 포즈 모델(`.task`)을 최초 1회 **다운로드**해 `worker/models/` 에 캐시 | 설치된 mediapipe 1.0.0 은 레거시 `mp.solutions` 를 제거해 Tasks API 만 남았고, Tasks API 는 모델 파일을 번들하지 않는다. 커플 2인 추적(`num_poses=2`)도 Tasks API 에서만 가능하다. 오프라인 환경은 `AI_JUDGE_POSE_MODEL` 로 경로 지정 |
| **D-3** | 동작 온셋 피크 검출에 **scipy.signal.find_peaks** 사용 | 직접 구현한 국소최대 판정이 평탄역(평활화가 짧은 스파이크를 만드는 구간)에서 피크를 놓쳤다. 테스트로 확인된 실제 결함 |

## 파일

| 파일 | 역할 | 상태 |
|------|------|:----:|
| `config.py` | 환경변수 로딩 (.env.local 재사용) | ✅ |
| `thresholds.py` | **rubric v1.0 임계값의 유일한 코드 측 소유자** | ✅ |
| `errors.py` | 에러 코드 (design §6.1) | ✅ |
| `queue.py` | claim / 상태 전이 / stale 회수 | ✅ |
| `check.py` | 기동 점검 | ✅ |
| `assets.py` | MediaPipe `.task` 모델 확보 (최초 1회 다운로드) | ✅ |
| `media.py` | Storage 입출력 · 메타 · 오디오 추출 · 키프레임 | ✅ |
| `pose.py` | MediaPipe Tasks · 2인 슬롯 추적 · ID 스위칭 감지 | ✅ |
| `beat.py` | librosa 비트/온셋/RMS · 곡 구조 | ✅ |
| `metrics.py` | 온비트율(점수) · 오프셋 · 싱크로/활동량(참고) | ✅ |
| `segments.py` | 구간 태깅 · context · 감점 트리거 P-1~4 | ✅ |
| `confidence.py` | **절대 원칙 2 단일 산출처** | ✅ |
| `comments.py` | Claude vision + COMMENTS_SCHEMA | ✅ |
| `notify.py` | Resend 이메일 | ✅ |
| `pipeline.py` | 스테이지 오케스트레이션 | ✅ |
| `cli.py` / `main.py` | 진입점 | ✅ |

## 절대 원칙 자체 감사

```bash
npm run ajudge:audit     # = node scripts/ai-judge-audit.mjs
```

P1(Timing 외 축 점수 금지) · P2(confidence 단일 산출처) · P3(순위·합불 금지)를
소스에서 정적 검사한다. 위반 시 exit 1. Check 단계 필수.

## 테스트

```bash
python -m pytest worker/tests -v
```

검증용 영상은 [`samples/README.md`](samples/README.md) 참고.
