"""Deterministic JSON terrain sectors; no raster image manipulation."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'public/assets/games/winobranie-rts'
(ROOT / 'sectors').mkdir(parents=True, exist_ok=True)
refs = []
for sy in range(16):
    for sx in range(16):
        runs = []
        for y in range(sy * 32, sy * 32 + 32):
            for x in range(sx * 32, sx * 32 + 32):
                river = 120 + int(18 * math.sin(y / 45))
                noise = ((x * 73856093) ^ (y * 19349663)) & 65535
                frame = 0 if noise % 11 else 1
                if abs(x - river) < 5:
                    frame = 4 if abs(x - river) < 3 else 3
                if 256 <= y <= 260 or (64 <= y <= 66 and x < 300):
                    frame = 2 if abs(x - river) >= 5 else 5
                if 231 <= x <= 264 and 237 <= y <= 247:
                    frame = 6 if y % 4 == 2 else 0
                if runs and runs[-1][0] == frame:
                    runs[-1][1] += 1
                else:
                    runs.append([frame, 1])
        ident = f's{sx}-{sy}'
        refs.append(dict(id=ident, x=sx, y=sy, url=f'sectors/{ident}.json'))
        (ROOT / f'sectors/{ident}.json').write_text(json.dumps(dict(schemaVersion=1, id=ident, revision='vineyard-w1', layers=[dict(name='ground', runs=runs)]), separators=(',', ':')) + '\n')
world = dict(schemaVersion=2, id='vineyard-w1', width=512, height=512, tileSize=16, camera=dict(zoom=0.5, minZoom=0.5, maxZoom=2, center=dict(x=253, y=250)), terrain=dict(revision='vineyard-w1', sectorSize=32, texture='vineyard-ground', frames=7, fallbackColor=0x6b8645, cacheSectors=48, sectors=refs), scenario=dict(id='first-harvest', seconds=360, seed=731, initialCash=30000, goal=40000))
(ROOT / 'world.json').write_text(json.dumps(world, indent=2) + '\n')
print('256 sectors, 8192 × 8192 world')
