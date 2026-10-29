"""앱 아이콘 · 시작 화면 그리기 — 「지평선 위를 건너가는 인생의 해」

짙은 밤하늘, 왼쪽 지평선(태어남)에서 떠오른 해가 3분의 2쯤 건너온 자리에서 빛난다.
지나온 길은 금빛 실선, 남은 길은 점선. 지평선 아래로 해 그림자가 번진다.

만드는 것(android/app/src/main/res 아래, 원래 있던 파일 크기를 그대로 따른다)
- mipmap-*/ic_launcher.png · ic_launcher_round.png   (안드로이드 7 이하용 완성 아이콘)
- mipmap-*/ic_launcher_foreground.png · ic_launcher_background.png · ic_launcher_monochrome.png (적응형 아이콘 층)
- drawable*/splash.png                                 (안드로이드 11 이하 시작 화면)
- store/icon-512.png · store/feature-1024x500.png       (스토어용)
실행: python scripts/make-icons.py
"""
import math
import os
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"
P = 0.64            # 해가 건너온 비율
SS = 4              # 안티앨리어싱용 확대 배율

GOLD = (255, 205, 120)
PALE = (255, 244, 222)


def lerp(a, b, t):
    return tuple(int(round(x + (y - x) * t)) for x, y in zip(a, b))


def sky(w, h, cx, cy, horizon):
    """밤하늘: 해 쪽이 조금 따뜻한 남색, 가장자리는 거의 검정. 지평선 아래는 더 어둡게."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx - cx) / w) ** 2 + ((yy - cy) / h) ** 2)
    t = np.clip(d / 0.75, 0, 1)[..., None]
    top = np.array([38, 40, 104], np.float32)      # 해 근처 — 남보라
    edge = np.array([7, 9, 28], np.float32)        # 가장자리 — 깊은 남색
    img = top * (1 - t) ** 1.4 + edge * (1 - (1 - t) ** 1.4)
    below = (yy >= horizon)[..., None]
    img = np.where(below, img * 0.38 + np.array([3, 4, 12], np.float32), img)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def glow(size, cx, cy, r, color, alpha):
    """부드러운 빛 덩어리(가우시안)."""
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    a = np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * (r / 2.2) ** 2))) * alpha
    layer = np.zeros((h, w, 4), np.float32)
    layer[..., :3] = color
    layer[..., 3] = a * 255
    return Image.fromarray(np.clip(layer, 0, 255).astype(np.uint8), "RGBA")


def mark(size, box, mono=False, stars=True):
    """box = (x0, y0, x1, y1): 해·길·지평선이 들어갈 네모(안전 영역). 투명 바탕 RGBA 를 돌려준다."""
    W, H = size[0] * SS, size[1] * SS
    x0, y0, x1, y1 = (v * SS for v in box)
    bw = x1 - x0
    cx = (x0 + x1) / 2
    hy = y0 + (y1 - y0) * 0.66          # 지평선
    R = bw * 0.42                        # 해가 지나는 반원
    lw = max(2, bw * 0.026)

    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ang = math.pi * (1 + P)              # 왼쪽 끝(π) → 오른쪽 끝(2π)
    sx, sy = cx + R * math.cos(ang), hy + R * math.sin(ang)

    if not mono:
        img.alpha_composite(glow((W, H), sx, sy, bw * 0.7, (255, 170, 90), 0.22))
        img.alpha_composite(glow((W, H), sx, sy, bw * 0.32, (255, 214, 150), 0.6))
        if stars:
            rnd = random.Random(7)
            d = ImageDraw.Draw(img)
            for _ in range(26):
                px, py = x0 + rnd.random() * bw, y0 + rnd.random() * (hy - y0) * 0.9
                if math.hypot(px - sx, py - sy) < bw * 0.22:
                    continue
                r = (0.5 + rnd.random() * 1.1) * bw / 420
                a = int(90 + rnd.random() * 120)
                d.ellipse((px - r, py - r, px + r, py + r), fill=(255, 255, 255, a))

    d = ImageDraw.Draw(img)
    white = (255, 255, 255, 255)

    # 남은 길: 점선(해 바로 옆은 비운다)
    n = max(3, int(R * (2 * math.pi - ang) / (lw * 2.8)))
    for i in range(1, n + 1):
        a = ang + (2 * math.pi - ang) * i / n
        px, py = cx + R * math.cos(a), hy + R * math.sin(a)
        if math.hypot(px - sx, py - sy) < bw * 0.12:
            continue
        r = lw * 0.36
        d.ellipse((px - r, py - r, px + r, py + r), fill=white if mono else (255, 255, 255, 120))

    # 지나온 길: 실선, 왼쪽은 희미한 흰색 → 해 쪽은 금빛
    steps = 220
    for i in range(steps):
        t = i / steps
        a = math.pi + (ang - math.pi) * t
        px, py = cx + R * math.cos(a), hy + R * math.sin(a)
        col = white if mono else (*lerp(PALE, GOLD, t ** 1.5), int(150 + 105 * t))
        r = lw / 2
        d.ellipse((px - r, py - r, px + r, py + r), fill=col)

    # 지평선
    hl = R * 1.28
    d.rounded_rectangle((cx - hl, hy - lw * 0.28, cx + hl, hy + lw * 0.28), radius=lw * 0.28,
                        fill=white if mono else (255, 255, 255, 150))
    # 해 그림자(지평선 아래 물결 줄)
    if not mono:
        for k in range(5):
            yy = hy + lw * (2.2 + k * 1.9)
            half = bw * (0.085 - k * 0.013)
            a = int(150 - k * 26)
            d.rounded_rectangle((sx - half, yy - lw * 0.22, sx + half, yy + lw * 0.22), radius=lw * 0.22,
                                fill=(*GOLD, a))

    # 해
    sr = bw * 0.085
    if mono:
        d.ellipse((sx - sr, sy - sr, sx + sr, sy + sr), fill=white)
    else:
        sun = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sun)
        for k in range(40, 0, -1):     # 가운데가 더 밝은 원판
            t = k / 40
            rr = sr * t
            sd.ellipse((sx - rr, sy - rr, sx + rr, sy + rr), fill=(*lerp((255, 250, 235), GOLD, t ** 2), 255))
        img.alpha_composite(sun)

    return img.resize(size, Image.LANCZOS)


def full_icon(px, round_mask=False):
    """완성 아이콘(배경+그림). round_mask 면 동그라미로 오린다."""
    S = px * SS
    bg = sky(S, S, S * 0.6, S * 0.45, S * (0.17 + 0.66 * 0.66))
    bg = bg.resize((px, px), Image.LANCZOS)
    m = mark((px, px), (px * 0.17, px * 0.17, px * 0.83, px * 0.83))
    bg.alpha_composite(m)
    mask = Image.new("L", (px * SS, px * SS), 0)
    md = ImageDraw.Draw(mask)
    if round_mask:
        md.ellipse((0, 0, px * SS - 1, px * SS - 1), fill=255)
    else:
        md.rounded_rectangle((0, 0, px * SS - 1, px * SS - 1), radius=px * SS * 0.22, fill=255)
    bg.putalpha(mask.resize((px, px), Image.LANCZOS))
    return bg


def adaptive_layers(px):
    """적응형 아이콘: 108dp 캔버스, 가운데 66dp(약 61%)가 늘 보이는 안전 영역."""
    lo, hi = px * (0.5 - 0.30), px * (0.5 + 0.30)
    S = px * SS
    bg = sky(S, S, S * 0.6, S * 0.45, S * (0.20 + 0.60 * 0.66)).resize((px, px), Image.LANCZOS)
    fg = mark((px, px), (lo, lo, hi, hi))
    mono = mark((px, px), (lo, lo, hi, hi), mono=True)
    return fg, bg, mono


def splash(w, h):
    S = (w * SS, h * SS)
    bg = sky(S[0], S[1], S[0] * 0.5, S[1] * 0.46, S[1] * 2).resize((w, h), Image.LANCZOS)
    s = min(w, h) * 0.34
    m = mark((w, h), (w / 2 - s / 2, h / 2 - s / 2 - s * 0.08, w / 2 + s / 2, h / 2 + s / 2 - s * 0.08), stars=False)
    bg.alpha_composite(m)
    return bg.convert("RGB")


def main():
    made = 0
    for d in sorted(RES.glob("mipmap-*dpi")):
        legacy = d / "ic_launcher.png"
        if not legacy.exists():
            continue
        px = Image.open(legacy).size[0]
        full_icon(px).save(legacy)
        full_icon(px, round_mask=True).save(d / "ic_launcher_round.png")
        fpx = Image.open(d / "ic_launcher_foreground.png").size[0]
        fg, bg, mono = adaptive_layers(fpx)
        fg.save(d / "ic_launcher_foreground.png")
        bg.convert("RGB").save(d / "ic_launcher_background.png")
        mono.save(d / "ic_launcher_monochrome.png")
        made += 5
    for f in sorted(RES.glob("drawable*/splash.png")):
        w, h = Image.open(f).size
        splash(w, h).save(f)
        made += 1
    store = ROOT / "store"
    store.mkdir(exist_ok=True)
    full_icon(512).save(store / "icon-512.png")
    # 스토어 그래픽 이미지(1024x500)
    W, H = 1024, 500
    bg = sky(W * SS, H * SS, W * SS * 0.5, H * SS * 0.5, H * SS * 0.79).resize((W, H), Image.LANCZOS)
    bg.alpha_composite(mark((W, H), (W / 2 - 250, 20, W / 2 + 250, 520)))
    bg.convert("RGB").save(store / "feature-1024x500.png")
    print(f"그림 {made + 2}개 만들었어요")


if __name__ == "__main__":
    main()
