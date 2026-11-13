"""Original deterministic PixelForge art and world; Python standard library only."""

import json
import math
import random
from pathlib import Path
from pixel_art import Image

OUT = Path(__file__).resolve().parents[1] / "public/assets/games/earthworm"
OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(707)


def line(im, x1, y1, x2, y2, color, width=1):
    steps = max(abs(int(x2 - x1)), abs(int(y2 - y1)), 1)
    for step in range(steps + 1):
        im.rect(
            round(x1 + (x2 - x1) * step / steps),
            round(y1 + (y2 - y1) * step / steps),
            width,
            width,
            color,
        )


def ellipse(im, x, y, rx, ry, color):
    for yy in range(int(y - ry), int(y + ry + 1)):
        dx = int(rx * math.sqrt(max(0, 1 - ((yy - y) / ry) ** 2)))
        im.rect(x - dx, yy, dx * 2 + 1, 1, color)


def leaf(im, x, y, color="#b6c67a", scale=1):
    line(
        im,
        x - 6 * scale,
        y + 4 * scale,
        x + 7 * scale,
        y - 6 * scale,
        "#354744",
        2 * scale,
    )
    for i in range(9):
        w = max(1, 5 - abs(4 - i))
        im.rect(
            x - 6 * scale + i * scale,
            y - 1 * scale - i * scale / 2,
            w * scale,
            6 * scale,
            color,
        )
    line(
        im, x - 5 * scale, y + 3 * scale, x + 5 * scale, y - 4 * scale, "#e0d69a", scale
    )


frames = [Image(32, 32) for _ in range(12)]
# Softly shaded segmented protagonist. Two eyes and a bright clitellum.
for f in [0, 1, 2]:
    im = frames[f]
    ellipse(im, 16, 18, 11 if f != 2 else 7, 7, "#3c283a")
    ellipse(im, 16, 16, 10 if f != 2 else 6, 7, "#a45777")
    ellipse(im, 16, 14, 9 if f != 2 else 5, 5, "#e08b98")
    im.rect(11, 11, 7, 2, "#f5b5ad")
    if f == 0:
        im.rect(21, 11, 4, 5, "#fff0cb")
        im.rect(23, 12, 2, 3, "#28313a")
        im.rect(21, 19, 4, 4, "#fff0cb")
        im.rect(23, 19, 2, 2, "#28313a")
        im.rect(25, 16, 3, 2, "#a45777")
    else:
        line(im, 13, 9, 12, 21, "#bc6a83")
        line(im, 18, 9, 19, 21, "#ef9fa2")
leaf(frames[3], 16, 17, "#d5b66e")
im = frames[4]
ellipse(im, 16, 20, 13, 8, "#2a2833")
ellipse(im, 16, 16, 12, 9, "#605464")
ellipse(im, 18, 13, 9, 6, "#887484")
im.rect(23, 14, 6, 4, "#c58b8b")
im.rect(21, 11, 2, 2, "#1d242c")
im.rect(22, 11, 1, 1, "#f2e4c4")
for x in [7, 11, 19]:
    line(im, x, 20, x - 4, 25, "#e2c7ab", 2)
im = frames[5]
ellipse(im, 16, 23, 12, 4, "#352b37")
ellipse(im, 16, 17, 12, 9, "#696168")
ellipse(im, 14, 14, 9, 6, "#908183")
im.rect(10, 10, 7, 2, "#b7a197")
im = frames[6]
im.rect(15, 15, 3, 12, "#d9c3a3")
ellipse(im, 16, 14, 12, 6, "#b8696f")
im.rect(7, 11, 7, 3, "#edbfa0")
im.rect(19, 12, 4, 2, "#edbfa0")
im = frames[7]
line(im, 16, 29, 16, 5, "#536b56", 2)
for y in [10, 16, 22]:
    leaf(im, 11, y, "#6e9167")
    leaf(im, 21, y - 3, "#a1b477")
im = frames[8]
for dx, dy in [(-4, 0), (4, 0), (0, -4), (0, 4)]:
    im.circle(16 + dx, 16 + dy, 4, "#db9eac")
im.circle(16, 16, 3, "#f3d98c")
im = frames[9]
ellipse(im, 16, 19, 5, 6, "#5dabb3")
line(im, 16, 10, 12, 18, "#82ccd0", 2)
im.rect(13, 18, 2, 3, "#c5e4d1")
im = frames[10]
leaf(im, 16, 17, "#76966c")
im = frames[11]
im.circle(16, 16, 5, "#f2cf8d")
im.rect(14, 12, 3, 2, "#fff0cb")
atlas = Image(32 * len(frames), 32)
for i, frame in enumerate(frames):
    atlas.blit(frame, i * 32, 0)
atlas.save(OUT / "creatures.png")

plants = []
for garden in range(4):
    for blooming in [False, True]:
        im = Image(64, 64)
        ellipse(im, 32, 51, 23, 9, "#3d3038")
        for a in [-2.6, -1.8, -1, -0.2, 0.5]:
            line(im, 32, 38, 32 + math.cos(a) * 24, 46 + math.sin(a) * 13, "#a18063", 3)
            line(im, 32, 39, 32 + math.cos(a) * 21, 46 + math.sin(a) * 11, "#d5b78b", 1)
        line(im, 32, 44, 32, 21, "#72835d" if blooming else "#8b7562", 3)
        if blooming:
            leaf(im, 23, 29, "#8caf70", 2)
            leaf(im, 38, 25, "#b2ca7e", 2)
            color = ["#eea0aa", "#e6bf6b", "#bdadd6", "#eac995"][garden]
            for a in range(5):
                im.circle(
                    32 + math.cos(a * math.tau / 5) * 8,
                    14 + math.sin(a * math.tau / 5) * 8,
                    6,
                    color,
                )
            im.circle(32, 14, 5, "#faf0c2")
            im.circle(32, 14, 2, "#d69d62")
        else:
            line(im, 33, 23, 39, 27, "#b4a077", 3)
            leaf(im, 24, 32, "#8a8965")
            ellipse(im, 40, 28, 5, 4, "#b89b78")
        plants.append(im)
atlas = Image(64 * len(plants), 64)
for i, im in enumerate(plants):
    atlas.blit(im, i * 64, 0)
atlas.save(OUT / "plants.png")

pool = Image(112, 80)
ellipse(pool, 56, 44, 54, 34, "#263336")
ellipse(pool, 56, 40, 49, 30, "#415954")
ellipse(pool, 56, 38, 44, 26, "#3a7177")
ellipse(pool, 56, 36, 36, 21, "#548f93")
for _ in range(35):
    x, y = rng.randrange(17, 95), rng.randrange(17, 58)
    if ((x - 56) / 37) ** 2 + ((y - 36) / 22) ** 2 < 1:
        pool.rect(
            x, y, rng.randrange(2, 9), 1, rng.choice(["#72b3b1", "#62a3a5", "#498186"])
        )
for x, y in [(14, 24), (20, 64), (92, 49)]:
    leaf(pool, x, y, "#829667")
pool.save(OUT / "pool.png")

soil = Image(8 * 12, 8)
for i in range(12):
    palette = (
        ["#5c4846", "#624b46", "#584547", "#684e47"]
        if i < 4
        else (
            ["#302c35", "#332d36", "#352d35", "#322c32"]
            if i < 8
            else ["#686068", "#6f666c", "#615b63", "#776c6e"]
        )
    )
    soil.rect(i * 8, 0, 8, 8, palette[i % 4])
    for j in range(5):
        soil.rect(
            i * 8 + rng.randrange(8),
            rng.randrange(8),
            1,
            1,
            "#806355" if i < 4 else "#4c3c40" if i < 8 else "#95848a",
        )
soil.save(OUT / "soil.png")

# Fixed garden layout, with explicit safe opening and stepping-stone dew pools.
positions = [
    (552, 536),
    (848, 656),
    (560, 1008),
    (2848, 512),
    (3392, 720),
    (3040, 1104),
    (3376, 2912),
    (3072, 3360),
    (2640, 3008),
    (864, 3360),
    (448, 2912),
    (1232, 2784),
]
roots = [
    dict(id=f"root-{i+1}", x=x, y=y, need=3 if i == 0 else 4, garden=i // 3)
    for i, (x, y) in enumerate(positions)
]
food = []
for i, (x, y) in enumerate(positions):
    offsets = [(-64, -24), (-24, -48), (36, -44), (72, 24), (-48, 64), (32, 80)]
    for j, (dx, dy) in enumerate(offsets):
        food.append(dict(id=f"leaf-{i+1}-{j+1}", x=x + dx, y=y + dy))
pools = [dict(x=472, y=576, radius=44)]
for i, (x, y) in enumerate(positions):
    if i:
        pools.append(dict(x=x - 120, y=y + 112, radius=44))
for x, y in [
    (1408, 704),
    (2096, 592),
    (3392, 1696),
    (3312, 2304),
    (2000, 3328),
    (1520, 3136),
    (512, 2080),
    (560, 1536),
    (1760, 1920),
]:
    pools.append(dict(x=x, y=y, radius=52))
protected = [*roots, *food, *pools, dict(x=464, y=536)]
rocks = []
for _ in range(160):
    x, y = rng.randrange(80, 4016), rng.randrange(80, 4016)
    radius = rng.randrange(12, 37)
    if all(math.hypot(x - p["x"], y - p["y"]) > radius + 90 for p in protected):
        rocks.append(dict(x=x, y=y, radius=radius))
predators = [
    dict(id=f"mole-{i}", x=x, y=y, radius=90, speed=40)
    for i, (x, y) in enumerate(
        [(3104, 736), (3376, 3040), (624, 3120), (2024, 3200), (3300, 2100)]
    )
]
world = dict(
    schemaVersion=1,
    id="under-garden",
    width=4096,
    height=4096,
    spawn=dict(x=464, y=536),
    roots=roots,
    pools=pools,
    rocks=rocks,
    food=food,
    predators=predators,
)
(OUT / "world.json").write_text(json.dumps(world, ensure_ascii=False, indent=2) + "\n")

cover = Image(480, 270, "#302c35")
for y in range(0, 270, 8):
    for x in range(0, 480, 8):
        cover.rect(x, y, 8, 8, rng.choice(["#5c4846", "#624b46", "#584547", "#684e47"]))
        cover.rect(x + rng.randrange(8), y + rng.randrange(8), 1, 1, "#806355")
for i in range(260):
    x = 50 + i * 1.5
    y = 166 + math.sin(i / 45) * 43
    cover.circle(x, y, 17, "#3b3037")
    cover.circle(x, y, 12, "#302c35")
for _ in range(40):
    cover.blit(
        frames[rng.choice([5, 6, 7, 10])],
        rng.randrange(-12, 480),
        rng.randrange(-12, 270),
    )
cover.blit(pool, 20, 158)
cover.blit(plants[1], 70, 38)
cover.blit(plants[5], 370, 88)
cover.blit(plants[3], 301, 12)
for i in range(18, -1, -1):
    x = 190 + i * 4
    y = 145 + math.sin(i / 4) * 12
    cover.blit(frames[0 if i == 0 else 1], int(x), int(y))
for x, y in [(170, 101), (338, 209), (124, 179)]:
    cover.blit(frames[3], x, y)
cover.save(OUT / "cover.png")
print(
    f"Generated {len(roots)} roots, {len(food)} food patches and original art in {OUT}"
)
