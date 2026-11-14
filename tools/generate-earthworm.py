"""Deterministic vertical soil world. Original PNG atlases are committed separately."""

import json
import math
import random
from pathlib import Path

out = Path(__file__).resolve().parents[1] / "public/assets/games/earthworm/soil-world.json"
rng = random.Random(813)
positions = [
    (768, 528),
    (1056, 720),
    (1376, 928),
    (1696, 624),
    (2016, 864),
    (2336, 1104),
    (2656, 528),
    (2976, 752),
    (3296, 976),
    (3616, 720),
    (448, 1104),
    (1120, 1280),
]
roots = [
    dict(id=f"root-{i+1}", x=x, y=y, need=3 if i == 0 else 4, garden=i % 4)
    for i, (x, y) in enumerate(positions)
]
food = []
for i, (x, y) in enumerate(positions):
    offsets = [(-72, -40), (-32, -48), (32, -32), (64, 32), (-32, 64), (32, 80)]
    if i == 0:
        offsets = [(-88, -72), (-48, -40), (32, -32), (56, 32), (-32, 64), (32, 80)]
    for j, (dx, dy) in enumerate(offsets):
        food.append(dict(id=f"grub-{i+1}-{j+1}", x=x + dx, y=y + dy, kind=(i + j) % 3))
for i, (x, y) in enumerate(
    [
        (1312, 1392),
        (1888, 1904),
        (2144, 2176),
        (2512, 2432),
        (2752, 2816),
        (1024, 2600),
        (880, 2800),
        (1056, 3000),
        (1248, 3152),
        (1536, 3504),
    ]
):
    for j, (dx, dy) in enumerate([(-56, -24), (40, -40), (-48, 48), (48, 48)]):
        food.append(
            dict(id=f"deep-grub-{i}-{j}", x=x + dx, y=y + dy, kind=3 if j == 3 else j)
        )
pools = [dict(x=624, y=512, radius=32)]
pools += [dict(x=x - 96, y=y + 128, radius=32) for x, y in positions]
pools += [
    dict(x=x, y=y, radius=38)
    for x, y in [
        (1504, 1536),
        (1776, 1872),
        (2256, 2224),
        (2400, 2496),
        (1088, 2464),
        (960, 2784),
        (1168, 3072),
        (1376, 3408),
        (2256, 3616),
    ]
]
landmarks = [
    (640, 464),
    (1312, 1392),
    (1888, 1904),
    (2752, 2912),
    (2592, 2592),
    (2752, 2816),
    (1024, 2600),
    (880, 2800),
    (1056, 3000),
    (1248, 3152),
    (1216, 3264),
    (1104, 1056),
    (1664, 1536),
    (2144, 2128),
    (2752, 2656),
    (2864, 2944),
    (1536, 3200),
    (864, 3568),
    (2336, 3680),
]
protected = [
    *roots,
    *food,
    *pools,
    *[dict(x=x, y=y) for x, y in landmarks],
    dict(x=640, y=448),
]
rocks = []
for _ in range(260):
    x, y = rng.randrange(96, 4000), rng.randrange(472, 4000)
    radius = rng.randrange(12, 37)
    if 2440 < x < 2950 and 2380 < y < 3030:
        continue
    if all(math.hypot(x - p["x"], y - p["y"]) > radius + 78 for p in protected):
        rocks.append(dict(x=x, y=y, radius=radius))
predators = [
    dict(id=f"beetle-{i}", x=x, y=y, radius=72 + 4 * i, speed=32 + 2 * i)
    for i, (x, y) in enumerate(
        [
            (1728, 1488),
            (2180, 1856),
            (2500, 2200),
            (3008, 2776),
            (768, 3120),
            (1600, 2800),
            (2048, 3400),
            (3264, 3400),
            (3520, 2000),
        ]
    )
]
world = dict(
    schemaVersion=2,
    id="soil-garden",
    width=4096,
    height=4096,
    spawn=dict(x=640, y=448),
    roots=roots,
    pools=pools,
    rocks=rocks,
    food=food,
    predators=predators,
)
out.write_text(json.dumps(world, ensure_ascii=False, indent=2) + "\n")
print(
    f"Vertical soil: {len(roots)} roots, {len(food)} larvae, {len(rocks)} rocks, {len(predators)} predators"
)
