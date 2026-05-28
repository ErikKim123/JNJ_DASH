"""JNJ Dash 시스템 아키텍처 도식 — 참조 이미지(ticketon_clean_architecture) 스타일."""
from __future__ import annotations
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math

OUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "diagrams"
OUT_DIR.mkdir(parents=True, exist_ok=True)

W, H = 2600, 2000
BG = (255, 255, 255)
FG = (35, 35, 45)
MUTED = (110, 110, 125)
ARROW = (140, 140, 155)

# 카테고리별 색상 (header_text, fill, border)
C_USER     = ((90, 90, 100),  (235, 235, 238), (200, 200, 210))   # 회색 — 사용자
C_PUBLIC   = ((30, 64, 175),  (219, 234, 254), (147, 197, 253))   # 파랑 — 공개/표출
C_JOIN     = ((91, 33, 182),  (237, 233, 254), (196, 181, 253))   # 보라 — 참가자
C_ADMIN    = ((159, 18, 57),  (252, 231, 243), (244, 182, 218))   # 분홍 — 운영자
C_EXT      = ((146, 64, 14),  (254, 243, 199), (252, 211, 77))    # 주황 — 외부 연동
C_STORAGE  = ((6, 95, 70),    (209, 250, 229), (110, 231, 183))   # 초록 — 저장소

FONT = "C:/Windows/Fonts/malgun.ttf"
FONT_B = "C:/Windows/Fonts/malgunbd.ttf"
def font(s, b=False): return ImageFont.truetype(FONT_B if b else FONT, s)

F_H1   = font(42, True)
F_H2   = font(22, True)
F_SECT = font(24, True)
F_TBIG = font(28, True)
F_T    = font(22, True)
F_SUB  = font(18)
F_S    = font(16)
F_TINY = font(14)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# ── Title
d.text((40, 28), "JNJ Dash — 시스템 아키텍처", font=F_H1, fill=FG)
d.text((44, 84), "Next.js 15 + Supabase + Resend  |  댄스 컴페티션 채점·표출 플랫폼", font=F_SUB, fill=MUTED)
d.line([(40, 124), (W-40, 124)], fill=(220,220,225), width=2)

def box(x, y, w, h, palette, title=None, subtitle=None, body=None, body_lines=None, radius=14):
    txt_col, fill_col, border_col = palette
    # shadow
    d.rounded_rectangle([x+4, y+4, x+w+4, y+h+4], radius=radius, fill=(225,225,230))
    d.rounded_rectangle([x, y, x+w, y+h], radius=radius, fill=fill_col, outline=border_col, width=2)
    if title:
        # centered title
        tw = d.textlength(title, font=F_TBIG if not subtitle else F_T)
        d.text((x + (w-tw)/2, y + 14), title, font=F_TBIG if not subtitle else F_T, fill=txt_col)
    if subtitle:
        sw = d.textlength(subtitle, font=F_SUB)
        d.text((x + (w-sw)/2, y + 14 + 32), subtitle, font=F_SUB, fill=txt_col)
    if body:
        bw = d.textlength(body, font=F_S)
        d.text((x + (w-bw)/2, y + h - 28), body, font=F_S, fill=MUTED)
    if body_lines:
        cy = y + 60
        for line in body_lines:
            lw = d.textlength(line, font=F_S)
            d.text((x + (w-lw)/2, cy), line, font=F_S, fill=txt_col)
            cy += 24

def section_label(x, y, label):
    d.text((x, y), f"[ {label} ]", font=F_SECT, fill=FG)

def arrow_v(x, y1, y2, color=ARROW, width=3):
    d.line([(x, y1), (x, y2-10)], fill=color, width=width)
    d.polygon([(x, y2), (x-9, y2-13), (x+9, y2-13)], fill=color)

def arrow_h(x1, x2, y, color=ARROW, width=3):
    if x2 > x1:
        d.line([(x1, y), (x2-10, y)], fill=color, width=width)
        d.polygon([(x2, y), (x2-13, y-9), (x2-13, y+9)], fill=color)
    else:
        d.line([(x1, y), (x2+10, y)], fill=color, width=width)
        d.polygon([(x2, y), (x2+13, y-9), (x2+13, y+9)], fill=color)

# ─────────────────────────────────────────────────────────────────────
# 좌측: 공개 시스템 / 가운데: 참가자 / 우측: 운영자
# ─────────────────────────────────────────────────────────────────────
section_label(60,  160, "공개 표출")
section_label(900, 160, "참가자")
section_label(1700, 160, "운영자")

# ── Users row (y=210~330)
USER_Y, USER_H = 210, 130
# 공개 — 관객/심사위원
box(60,  USER_Y, 380, USER_H, C_USER, title="관객 · 심사위원", subtitle="대형 표출 / 모바일 조회")
# 참가자
box(900, USER_Y, 380, USER_H, C_USER, title="참가자", subtitle="대회 등록 · 사진 업로드")
# 운영자
box(1700, USER_Y, 380, USER_H, C_USER, title="운영자", subtitle="PIN 인증 (HMAC-SHA256)")

# ── Frontend row (y=400~540)
FE_Y, FE_H = 400, 150
box(60,  FE_Y, 380, FE_H, C_PUBLIC,
    title="대시보드", subtitle="app/dashboard/[contestId]",
    body="Next.js SSR · i18n · Fullscreen")
box(900, FE_Y, 380, FE_H, C_JOIN,
    title="참가 신청 페이지", subtitle="app/join/[contestId]",
    body="공개 폼 · 사진 업로드")
box(1700, FE_Y, 380, FE_H, C_ADMIN,
    title="관리자 콘솔", subtitle="app/admin/contests/[contestId]",
    body="ContestTabs · ScalingFrame · LocaleSwitcher")

# arrows users → frontend
arrow_v(250, USER_Y+USER_H, FE_Y)
arrow_v(1090, USER_Y+USER_H, FE_Y)
arrow_v(1890, USER_Y+USER_H, FE_Y)

# ── Middleware bar (y=600 small strip across)
MW_Y = 600
d.rounded_rectangle([1700-4, MW_Y, 2080+4, MW_Y+50], radius=10,
                    fill=(255,240,245), outline=C_ADMIN[2], width=2)
mw_text = "middleware.ts — /admin/* · /api/admin/* 쿠키 검증"
d.text((1700 + (388 - d.textlength(mw_text, font=F_S))/2, MW_Y+14), mw_text,
       font=F_S, fill=C_ADMIN[0])

# arrows frontend → middleware/api
arrow_v(1890, FE_Y+FE_H, MW_Y)

# ── API row (y=700)
API_Y = 700
# 공개 API
public_api = box(60, API_Y, 380, 320, C_PUBLIC, title="공개 API", subtitle="/api/contests/*")
api_items_pub = [
    ("GET", "/contests", "대회 목록"),
    ("GET", "/contests/[id]/meta", "메타 + 페어링 + 결과"),
    ("GET", "/contests/[id]/round/[r]/step/[s]", "라운드별 표출 데이터"),
]
cy = API_Y + 80
for m, p, desc in api_items_pub:
    d.text((80, cy), m, font=F_S, fill=(20,120,40))
    d.text((150, cy), p, font=F_S, fill=C_PUBLIC[0])
    d.text((90, cy+22), desc, font=F_TINY, fill=MUTED)
    cy += 56

# 참가 API
box(900, API_Y, 380, 320, C_JOIN, title="참가 신청 API", subtitle="/api/join/*")
api_items_join = [
    ("POST", "/join/[id]/photo", "사진 presigned 업로드"),
    ("POST", "/join/[id]/submit", "참가 신청 + 이메일 발송"),
    ("GET",  "/join/competitions",  "공개 대회 목록"),
]
cy = API_Y + 80
for m, p, desc in api_items_join:
    d.text((920, cy), m, font=F_S, fill=(180,80,20))
    d.text((1010, cy), p, font=F_S, fill=C_JOIN[0])
    d.text((930, cy+22), desc, font=F_TINY, fill=MUTED)
    cy += 56

# 운영자 API
admin_h = 460
box(1700, API_Y, 380, admin_h, C_ADMIN, title="관리자 API", subtitle="/api/admin/*")
admin_modules = [
    "·  login        PIN → HMAC 쿠키 발급",
    "·  contests     대회 CRUD · 설정",
    "·  participants 참가자 명단",
    "·  pairings     예선/본선 셔플 · 확정",
    "·  judges       라운드별 심사위원 명단",
    "·  judging      votes / commit / reset / uncommit",
    "·  finals       결승 결과 입력",
    "·  uploads      photo · sponsor · background",
    "·  import/export  xlsx (대회 백업·복원)",
    "·  resend-email   참가확정 메일 재발송",
]
cy = API_Y + 70
for line in admin_modules:
    d.text((1720, cy), line, font=F_S, fill=C_ADMIN[0])
    cy += 38

# arrows frontend → API
arrow_v(250, FE_Y+FE_H, API_Y)
arrow_v(1090, FE_Y+FE_H, API_Y)
# Already drew FE→middleware. Now middleware→admin API
arrow_v(1890, MW_Y+50, API_Y)

# ── External integrations (between 참가 API and 운영자 API, vertical strip)
EXT_X = 1370
EXT_W = 280
ext_items = [
    ("Resend",  "이메일 발송",         "참가확정 메일"),
    ("Supabase\nStorage", "Presigned URL", "사진·로고·배경"),
    ("xlsx",    "Excel 입출력",        "import / export"),
    ("Google Sheets", "Legacy 어댑터", "lib/sheets (1회성)"),
]
ey = API_Y
for name, sub, hint in ext_items:
    box(EXT_X, ey, EXT_W, 100, C_EXT, title=name.replace("\n", " "), subtitle=sub, body=hint)
    ey += 120

# arrows API → external (join API → Resend ; admin API → all)
arrow_h(900+380, EXT_X, API_Y+50)      # join API → Resend
arrow_h(1700, EXT_X+EXT_W, API_Y+170, color=ARROW)  # admin API → Storage (right to left)
arrow_h(1700, EXT_X+EXT_W, API_Y+290, color=ARROW)  # admin API → xlsx
arrow_h(1700, EXT_X+EXT_W, API_Y+410, color=ARROW)  # admin API → sheets

# ── Data layer band (y=1200)
DL_Y = 1200
DL_H = 100
d.rounded_rectangle([60, DL_Y, W-60, DL_Y+DL_H], radius=14,
                    fill=(240, 245, 255), outline=(180, 200, 230), width=2)
title = "코어 데이터 레이어 — lib/db (pg / Supabase JS)"
sub   = "Repository: contests · participants · pairings · qualifiers · judges · judge_votes · final_results"
d.text((60 + (W-120 - d.textlength(title, font=F_T))/2, DL_Y+14), title, font=F_T, fill=(40,60,120))
d.text((60 + (W-120 - d.textlength(sub, font=F_S))/2, DL_Y+50), sub, font=F_S, fill=MUTED)

# arrows API/Public → data layer
arrow_v(250,  API_Y+320, DL_Y)
arrow_v(1090, API_Y+320, DL_Y)
arrow_v(1890, API_Y+admin_h, DL_Y)

# ── Storage row (y=1380)
ST_Y, ST_H = 1380, 280
# Postgres
pg_fields = [
    "contests (10 mig)",
    "participants",
    "pairings · qualifiers",
    "judges · judge_votes",
    "final_results",
    "ENUMs: round_status 외 7종",
    "RLS: anon SELECT · service_role write",
]
box(60, ST_Y, 700, ST_H, C_STORAGE, title="Supabase Postgres", subtitle="주 데이터  |  pg 8.20",
    body_lines=pg_fields)

# Supabase Storage
buckets = [
    "participant-photos   5MB   jpg/png/webp/gif",
    "contest-sponsors     3MB   + svg",
    "contest-backgrounds  8MB   jpg/png/webp",
    "",
    "RLS: public read",
    "service_role 만 write",
]
box(800, ST_Y, 700, ST_H, C_STORAGE, title="Supabase Storage", subtitle="파일 저장소 · CDN",
    body_lines=buckets)

# Caching / 부가
extra_lines = [
    "lru-cache  (메모리 캐시)",
    "Next.js  Route Handler",
    "  · Edge runtime middleware",
    "  · Node runtime API",
    "",
    "i18n  (ko/en/ja)",
    "Zod  스키마 검증",
]
box(1540, ST_Y, 540, ST_H, C_STORAGE, title="런타임 · 부가", subtitle="Node 20+  ·  Vercel/자체호스팅",
    body_lines=extra_lines)

# arrows data layer → storage
arrow_v(400,  DL_Y+DL_H, ST_Y)
arrow_v(1150, DL_Y+DL_H, ST_Y)
arrow_v(1810, DL_Y+DL_H, ST_Y)

# ── Legend (bottom)
LG_Y = 1720
d.rounded_rectangle([60, LG_Y, W-60, LG_Y+90], radius=12, fill=(248,248,250),
                    outline=(220,220,225), width=1)
legend_items = [
    ("공개 표출", C_PUBLIC),
    ("참가자",     C_JOIN),
    ("운영자",     C_ADMIN),
    ("외부 연동", C_EXT),
    ("저장소",     C_STORAGE),
    ("사용자",     C_USER),
]
lx = 100
for label, (tc, fc, bc) in legend_items:
    d.rounded_rectangle([lx, LG_Y+30, lx+40, LG_Y+60], radius=8, fill=fc, outline=bc, width=2)
    d.text((lx+54, LG_Y+34), label, font=F_T, fill=FG)
    lx += 380

# Footer notes
d.text((60, LG_Y+105),
       "참고:  • PIN 세션 = HMAC-SHA256, 12h TTL, HttpOnly+SameSite=Lax  "
       "• Storage presigned URL = service_role 발급  "
       "• 표출은 anon SELECT 만 (pairings 는 status='confirmed' 만 공개)",
       font=F_S, fill=MUTED)
d.text((60, LG_Y+135),
       "참고 스타일:  Ticketon clean architecture 도식 형식 (사용자 → 화면 → API → 데이터 / 좌:공개·중:참가·우:운영)",
       font=F_TINY, fill=MUTED)

# Footer
d.text((40, H-40), "Generated by scripts/draw_system_architecture.py", font=F_TINY, fill=MUTED)
d.text((W-360, H-40), "참조: app/, lib/, db/migrations/, package.json", font=F_TINY, fill=MUTED)

png_path = OUT_DIR / "system_architecture.png"
jpg_path = OUT_DIR / "system_architecture.jpg"
img.save(png_path, "PNG")
img.convert("RGB").save(jpg_path, "JPEG", quality=92)
print(f"WROTE: {png_path}")
print(f"WROTE: {jpg_path}")
