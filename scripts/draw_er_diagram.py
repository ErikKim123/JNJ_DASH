"""ER diagram one-shot renderer (PNG + JPG)."""
from __future__ import annotations
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "diagrams"
OUT_DIR.mkdir(parents=True, exist_ok=True)

W, H = 2800, 1900
BG = (250, 250, 252)
FG = (30, 30, 40)
MUTED = (110, 110, 125)
ACCENT = (60, 90, 200)

TABLE_COLORS = {
    "contests":      ("#1f3a8a", "#dbeafe"),
    "participants":  ("#065f46", "#d1fae5"),
    "pairings":      ("#92400e", "#fef3c7"),
    "qualifiers":    ("#5b21b6", "#ede9fe"),
    "final_results": ("#9f1239", "#ffe4e6"),
    "judges":        ("#1e40af", "#dbeafe"),
    "judge_votes":   ("#0e7490", "#cffafe"),
}

def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

FONT_PATH = "C:/Windows/Fonts/malgun.ttf"
FONT_BOLD = "C:/Windows/Fonts/malgunbd.ttf"

def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_PATH, size)

F_TITLE   = font(44, True)
F_SUB     = font(20)
F_TBL     = font(24, True)
F_PK      = font(17, True)
F_FIELD   = font(16)
F_NOTE    = font(14)
F_LEGEND  = font(18, True)
F_LEGEND_S= font(15)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# Header
d.text((40, 30), "JNJ Dash DB — ER Diagram", font=F_TITLE, fill=FG)
d.text((44, 90), "Supabase Postgres | Migrations 0001~0010 | 2026-05", font=F_SUB, fill=MUTED)
d.line([(40, 130), (W-40, 130)], fill=(200,200,210), width=2)

def draw_table(x, y, w, name, fields, note=None):
    header_color = hex2rgb(TABLE_COLORS[name][0])
    body_color   = hex2rgb(TABLE_COLORS[name][1])
    line_h = 26
    header_h = 44
    h_total = header_h + line_h * len(fields) + 14
    # shadow
    d.rounded_rectangle([x+5, y+5, x+w+5, y+h_total+5], radius=12, fill=(210,210,220))
    # body
    d.rounded_rectangle([x, y, x+w, y+h_total], radius=12, fill=body_color, outline=header_color, width=2)
    # header
    d.rounded_rectangle([x, y, x+w, y+header_h], radius=12, fill=header_color)
    d.rectangle([x, y+header_h-12, x+w, y+header_h], fill=header_color)
    d.text((x+16, y+8), name, font=F_TBL, fill=(255,255,255))
    # fields
    cy = y + header_h + 8
    for f in fields:
        is_pk = f.get("pk")
        is_fk = f.get("fk")
        label = f["name"]
        typ = f.get("type", "")
        marker = ""
        if is_pk: marker = "PK "
        elif is_fk: marker = "FK "
        d.text((x+14, cy), f"{marker}{label}", font=F_PK if (is_pk or is_fk) else F_FIELD,
               fill=(120,40,40) if is_pk else (40,80,40) if is_fk else FG)
        if typ:
            d.text((x+w-14 - d.textlength(typ, font=F_FIELD), cy), typ, font=F_FIELD, fill=MUTED)
        cy += line_h
    if note:
        d.text((x+14, y+h_total - 18), note, font=F_NOTE, fill=MUTED)
    return (x, y, x+w, y+h_total)

# ───────── Layout ─────────
# contests (center top, wide)
contests_box = draw_table(900, 160, 480, "contests", [
    {"name":"id", "type":"text 'JNJ-001'", "pk":True},
    {"name":"name", "type":"text"},
    {"name":"host_org / tagline / festival_header", "type":"text"},
    {"name":"period_start / period_end", "type":"date"},
    {"name":"design_template_number", "type":"int"},
    {"name":"prelim_pass_per_role / semi_pass_per_role", "type":"int"},
    {"name":"status", "type":"ready|live|done|archived"},
    {"name":"prelim_status / semi_status / final_status", "type":"round_status"},
    {"name":"scoring_items", "type":"jsonb[]"},
    {"name":"sponsor_logos / sponsor_logo_opacities", "type":"text[]/int[]"},
    {"name":"background_image / background_opacity", "type":"text/int"},
    {"name":"legacy_spreadsheet_id, created_at, updated_at", "type":""},
])

# participants (left top)
participants_box = draw_table(60, 700, 380, "participants", [
    {"name":"id", "type":"uuid", "pk":True},
    {"name":"contest_id", "type":"text", "fk":True},
    {"name":"num", "type":"text (UNIQ per contest)"},
    {"name":"team_name / representative", "type":"text"},
    {"name":"role", "type":"participant_role"},
    {"name":"photo_url", "type":"text"},
    {"name":"meta", "type":"jsonb"},
])

# pairings (left middle)
pairings_box = draw_table(60, 1080, 380, "pairings", [
    {"name":"id", "type":"uuid", "pk":True},
    {"name":"contest_id", "type":"text", "fk":True},
    {"name":"round", "type":"prelim | semi"},
    {"name":"pair_idx", "type":"int"},
    {"name":"leader_num / leader_name", "type":"text"},
    {"name":"follower_num / follower_name", "type":"text"},
    {"name":"status", "type":"draft | confirmed"},
    {"name":"shuffled_at / confirmed_at", "type":"timestamptz"},
])

# qualifiers (left bottom)
qualifiers_box = draw_table(60, 1480, 380, "qualifiers", [
    {"name":"id", "type":"uuid", "pk":True},
    {"name":"contest_id", "type":"text", "fk":True},
    {"name":"round", "type":"prelim | semi"},
    {"name":"participant_num / team_name", "type":"text"},
    {"name":"role / photo_url", "type":""},
    {"name":"passed / votes / display_order", "type":"bool/int"},
    {"name":"meta", "type":"jsonb"},
])

# final_results (center bottom)
final_box = draw_table(900, 1080, 460, "final_results", [
    {"name":"id", "type":"uuid", "pk":True},
    {"name":"contest_id", "type":"text", "fk":True},
    {"name":"participant_num / team_name", "type":"text"},
    {"name":"role", "type":"leader | follower"},
    {"name":"final_rank", "type":"int"},
    {"name":"total_score / average", "type":"numeric"},
    {"name":"photo_url, meta", "type":""},
])

# judges (right top)
judges_box = draw_table(1800, 700, 440, "judges", [
    {"name":"id", "type":"uuid", "pk":True},
    {"name":"contest_id", "type":"text", "fk":True},
    {"name":"round", "type":"prelim | semi | final"},
    {"name":"display_order", "type":"int"},
    {"name":"name / alias", "type":"text"},
    {"name":"specialty / career", "type":"text"},
    {"name":"phone / email / memo", "type":"text"},
    {"name":"max_votes", "type":"int"},
    {"name":"target_role", "type":"leader|follower|both"},
])

# judge_votes (right middle)
votes_box = draw_table(1800, 1190, 440, "judge_votes", [
    {"name":"id", "type":"uuid", "pk":True},
    {"name":"judge_id", "type":"uuid", "fk":True},
    {"name":"participant_num", "type":"text"},
    {"name":"vote_mark", "type":"O | X  (예선·본선)"},
    {"name":"basic_score", "type":"fundamentals"},
    {"name":"connectivity_score", "type":"connection"},
    {"name":"musicality_score", "type":"musicality"},
    {"name":"creativity_score", "type":"numeric"},
    {"name":"crowd_reaction_score", "type":"numeric"},
    {"name":"showmanship_score", "type":"numeric"},
])

# ───────── Arrows ─────────
def arrow(p1, p2, color=ACCENT, width=3, label=None, label_off=(0,-18), dashed=False):
    if dashed:
        # simple dashed
        import math
        x1,y1 = p1; x2,y2 = p2
        dx,dy = x2-x1, y2-y1
        dist = math.hypot(dx,dy)
        steps = int(dist // 14)
        for i in range(0, steps, 2):
            t1 = i/steps; t2 = min((i+1)/steps, 1.0)
            d.line([(x1+dx*t1, y1+dy*t1), (x1+dx*t2, y1+dy*t2)], fill=color, width=width)
    else:
        d.line([p1, p2], fill=color, width=width)
    # arrowhead
    import math
    angle = math.atan2(p2[1]-p1[1], p2[0]-p1[0])
    ah = 14
    a1 = angle + math.radians(150)
    a2 = angle - math.radians(150)
    d.polygon([
        p2,
        (p2[0]+ah*math.cos(a1), p2[1]+ah*math.sin(a1)),
        (p2[0]+ah*math.cos(a2), p2[1]+ah*math.sin(a2)),
    ], fill=color)
    if label:
        lx = (p1[0]+p2[0])/2 + label_off[0]
        ly = (p1[1]+p2[1])/2 + label_off[1]
        tw = d.textlength(label, font=F_NOTE)
        d.rectangle([lx-4, ly-2, lx+tw+4, ly+16], fill=BG)
        d.text((lx, ly), label, font=F_NOTE, fill=color)

# contests → 5 children (CASCADE solid)
cx, cy = (contests_box[0]+contests_box[2])//2, contests_box[3]
arrow((contests_box[0]+80, contests_box[3]), (participants_box[0]+200, participants_box[1]), label="contest_id CASCADE")
arrow((contests_box[0]+40, contests_box[3]+0),  (pairings_box[0]+150, pairings_box[1]), label="contest_id CASCADE", label_off=(-160, 100))
arrow((contests_box[0]+20, contests_box[3]+0),  (qualifiers_box[0]+250, qualifiers_box[1]), label="contest_id CASCADE", label_off=(-260, 200))
arrow((cx, contests_box[3]), ((final_box[0]+final_box[2])//2, final_box[1]), label="contest_id CASCADE")
arrow((contests_box[2]-80, contests_box[3]), (judges_box[0]+200, judges_box[1]), label="contest_id CASCADE")

# judges → judge_votes
arrow(((judges_box[0]+judges_box[2])//2, judges_box[3]), ((votes_box[0]+votes_box[2])//2, votes_box[1]), label="judge_id CASCADE")

# logical FK (dashed) participants.num → others
arrow((participants_box[2], participants_box[1]+120), (pairings_box[2]-40, pairings_box[1]+10), color=(140,90,40), dashed=True, label="num (논리 FK)")
arrow((participants_box[2]-20, participants_box[3]),  (qualifiers_box[2]-40, qualifiers_box[1]+10), color=(140,90,40), dashed=True, label="num (논리 FK)", label_off=(20, -20))
arrow((participants_box[2]+10, participants_box[3]-40), (final_box[0], final_box[1]+50), color=(140,90,40), dashed=True, label="participant_num (논리 FK)", label_off=(0, -32))
arrow((participants_box[2]+30, participants_box[1]+60), (votes_box[0], votes_box[1]+60), color=(140,90,40), dashed=True, label="participant_num (논리 FK)", label_off=(0, -22))

# ───────── Legend (bottom) ─────────
LX, LY = 460, 1480
d.rounded_rectangle([LX, LY, LX+420, LY+390], radius=10, fill=(255,255,255), outline=(200,200,210), width=2)
d.text((LX+16, LY+12), "ENUMs", font=F_LEGEND, fill=FG)
enums = [
    ("participant_role",  "leader | follower | helper_leader | helper_follower"),
    ("pairing_round",     "prelim | semi"),
    ("pairing_status",    "draft | confirmed"),
    ("qualifier_round",   "prelim | semi"),
    ("final_role",        "leader | follower"),
    ("judging_round",     "prelim | semi | final"),
    ("judge_target_role", "leader | follower | both"),
    ("round_status",      "prep → pairing → open → live → calculate → close → result"),
]
ey = LY + 44
for k, v in enums:
    d.text((LX+16, ey), k, font=F_PK, fill=(60,40,120))
    d.text((LX+200, ey), v, font=F_LEGEND_S, fill=FG)
    ey += 26

# Storage buckets
BX, BY = 900, 1480
d.rounded_rectangle([BX, BY, BX+440, BY+200], radius=10, fill=(255,255,255), outline=(200,200,210), width=2)
d.text((BX+16, BY+12), "Supabase Storage Buckets (public read)", font=F_LEGEND, fill=FG)
buckets = [
    ("participant-photos",  "5MB  jpg/png/webp/gif",        "0006"),
    ("contest-sponsors",    "3MB  +svg",                    "0007"),
    ("contest-backgrounds", "8MB  jpg/png/webp",            "0009"),
]
by = BY + 44
for n, info, mig in buckets:
    d.text((BX+16, by), "▣", font=F_LEGEND, fill=ACCENT)
    d.text((BX+44, by), n, font=F_PK, fill=FG)
    d.text((BX+260, by), info, font=F_LEGEND_S, fill=MUTED)
    d.text((BX+400, by), mig, font=F_NOTE, fill=(200,80,80))
    by += 36
d.text((BX+16, by+8), "RLS: anon=SELECT only · service_role=write", font=F_LEGEND_S, fill=MUTED)
d.text((BX+16, by+30), "pairings 는 status='confirmed' 만 anon SELECT", font=F_LEGEND_S, fill=MUTED)

# Legend for arrow types
d.text((1380, 1490), "─── 실선 : FK (CASCADE)", font=F_LEGEND_S, fill=ACCENT)
d.text((1380, 1516), "┄┄┄ 점선 : 논리 FK (텍스트 매칭)", font=F_LEGEND_S, fill=(140,90,40))
d.text((1380, 1542), "PK 빨강 · FK 초록 · 일반 검정", font=F_LEGEND_S, fill=MUTED)

# Footer
d.text((40, H-40), "Generated by scripts/draw_er_diagram.py", font=F_NOTE, fill=MUTED)
d.text((W-340, H-40), "참조: db/migrations/0001~0010.sql", font=F_NOTE, fill=MUTED)

png_path = OUT_DIR / "er_diagram.png"
jpg_path = OUT_DIR / "er_diagram.jpg"
img.save(png_path, "PNG")
img.convert("RGB").save(jpg_path, "JPEG", quality=92)
print(f"WROTE: {png_path}")
print(f"WROTE: {jpg_path}")
