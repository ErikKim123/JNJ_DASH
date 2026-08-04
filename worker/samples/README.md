# 샘플 영상 (AI Judge 사이클 1 검증용)

이 폴더에 검증용 영상을 넣어 주세요. **영상 파일은 git 에 커밋되지 않습니다** (`.gitignore` 처리).

## 필요한 파일 3개

파일명을 아래와 정확히 맞춰 주세요. 워커 CLI 와 pytest 가 이 이름으로 찾습니다.

| 파일명 | 내용 | 검증 목적 |
|--------|------|-----------|
| `solo_ok.mp4` | **정상 솔로** — 한 사람, 머리~발끝 전신이 계속 화면 안, 밝은 조명, 음악 있음 | 정상 경로 E2E. `confidence` = high/medium, 리포트 정상 산출 |
| `solo_bad_framing.mp4` | **화각 불량** — 상반신만 나오거나 전신이 자주 화면을 벗어남 | **confidence 게이트 검증.** `confidence='low'` + "분석 불가" 표시 확인 |
| `couple_ok.mp4` | **커플** — 두 사람, 전신, 음악 있음 | 2인 추적 · ID 스위칭 감지 · 싱크로 참고 지표 |

## 조건

- 형식: **mp4** 또는 **mov**
- 길이: **3분 이내** (초과 시 `DURATION_EXCEEDED`)
- 용량: **500MB 이내**
- 오디오: **음악이 들어 있어야 합니다.** 영상의 오디오 트랙에서 비트를 추출합니다
  (무음이면 `AUDIO_EXTRACT_FAILED` → 원곡 업로드 폴백 경로로 빠집니다)
- 촬영: 카메라 고정 권장. 세로/가로 무관

## 선택 — 있으면 좋은 것

| 파일명 | 내용 | 용도 |
|--------|------|------|
| `solo_no_audio.mp4` | 음악이 없는(무음) 영상 | `AUDIO_EXTRACT_FAILED` → 원곡 업로드 폴백 경로 검증 |
| `song.mp3` | 위 무음 영상에 대응하는 원곡 | 같은 폴백 경로 검증 |

## 넣은 뒤

파일을 넣으셨으면 알려 주세요. 아래로 검증합니다.

```bash
cd worker
python cli.py --video samples/solo_ok.mp4 --role leader
python cli.py --video samples/solo_bad_framing.mp4 --role leader   # confidence=low 기대
python cli.py --video samples/couple_ok.mp4 --role couple --leader-side left
```
