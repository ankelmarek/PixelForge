import Phaser from 'phaser';
import {
  SURFACE,
  ADULT_XP,
  NEST,
  PLUG,
  BABY,
  FLOOD,
  AIR_POCKETS,
  CHAMBER,
  FUNGI,
  DEEP_NEST,
  AMBER,
  gap,
  targets,
  rainMoisture,
  depthBand,
} from './adventure';
import type { WormModel } from './model';
interface WorldView {
  x: number;
  y: number;
  width: number;
  height: number;
}
export type SoilSprite = (
  id: string,
  x: number,
  y: number,
  texture: string,
  frame: number,
  depth: number,
  alpha?: number,
) => Phaser.GameObjects.Sprite | undefined;

/** Frames only: preserve the original atlases byte for byte, never stretch a whole world texture. */
export function registerSoilArt(scene: Phaser.Scene) {
  for (const name of ['garden', 'underground']) {
    const atlas = scene.textures.get(name),
      size = atlas.getSourceImage().width;
    for (let i = 0; i < 16; i++) {
      const x = Math.round(((i % 4) * size) / 4),
        y = Math.round((Math.floor(i / 4) * size) / 4);
      if (!atlas.has(String(i)))
        atlas.add(
          i,
          0,
          x,
          y,
          Math.round((((i % 4) + 1) * size) / 4) - x,
          Math.round(((Math.floor(i / 4) + 1) * size) / 4) - y,
        );
    }
    atlas.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  const worm = scene.textures.get('worm'),
    frames = [
      [45, 156, 545, 325],
      [658, 155, 555, 330],
      [31, 791, 548, 292],
      [643, 702, 586, 450],
    ];
  frames.forEach(([x, y, w, h], i) => {
    if (!worm.has(String(i))) worm.add(i, 0, x, y, w, h);
  });
  worm.setFilter(Phaser.Textures.FilterMode.NEAREST);
}
export function paintGround(
  ctx: CanvasRenderingContext2D,
  value: number,
  x: number,
  y: number,
  lx: number,
  ly: number,
) {
  const hash = Math.abs(((x * 374761393) ^ (y * 668265263)) >>> 0),
    py = y * 8,
    band = depthBand(py + Math.sin(x / 21) * 28 + Math.cos(x / 47) * 40),
    base = ['#896249', '#79503d', '#704a3c', '#51424a', '#383640'][band],
    speck = ['#b38b62', '#a37050', '#9b674c', '#79616b', '#5e5664'][band];
  if (value === 4) {
    ctx.fillStyle = py < 256 ? '#8fbbc0' : py < 320 ? '#b0c9b7' : '#c9d8b9';
    ctx.fillRect(lx, ly, 8, 8);
    if (py === SURFACE - 8) {
      ctx.fillStyle = '#75944d';
      ctx.fillRect(lx, ly + 5, 8, 3);
      ctx.fillRect(lx + (hash % 7), ly + 1, 1, 5);
    }
    return;
  }
  ctx.fillStyle =
    value === 2 ? '#6d6261' : value === 1 || value === 3 ? '#332a2b' : base;
  ctx.fillRect(lx, ly, 8, 8);
  ctx.fillStyle =
    value === 3
      ? '#b69356'
      : value === 2
        ? '#a09180'
        : value === 1
          ? '#4d3933'
          : speck;
  ctx.fillRect(
    lx + (hash % 7),
    ly + ((hash >>> 4) % 7),
    hash % 4 === 0 ? 2 : 1,
    1,
  );
  ctx.fillRect(lx + ((hash >>> 8) % 7), ly + ((hash >>> 12) % 7), 1, 1);
  if (!value && (y + Math.floor(Math.sin(x / 17) * 2)) % 19 === 0) {
    ctx.fillStyle = ['#72503e', '#643f34', '#5d3e36', '#423943', '#302e38'][
      band
    ];
    ctx.fillRect(lx, ly + 4, 8, 1);
  }
  if (py === SURFACE) {
    ctx.fillStyle = '#506f3b';
    ctx.fillRect(lx, ly, 8, 3);
    ctx.fillStyle = '#88aa54';
    ctx.fillRect(lx, ly, 8, 1);
  }
}

export function drawSoil(
  model: WormModel,
  sprite: SoilSprite,
  ground: Phaser.GameObjects.Graphics,
  fx: Phaser.GameObjects.Graphics,
  view: WorldView,
  visible: (x: number, y: number, margin?: number) => boolean,
  reduced: boolean,
) {
  const s = model.state,
    a = s.adventure,
    time = reduced ? 0 : s.seconds;
  const art = (
    id: string,
    x: number,
    y: number,
    frame: number,
    size: number,
    depth = 20,
    texture = 'underground',
  ) => sprite(id, x, y, texture, frame, depth)?.setDisplaySize(size, size);
  const glow = (
    x: number,
    y: number,
    color: number,
    radius: number,
    alpha = 0.16,
  ) => {
    ground.fillStyle(color, alpha / 3).fillCircle(x, y, radius * 1.5);
    ground.fillStyle(color, alpha).fillCircle(x, y, radius);
  };
  if (view.y < SURFACE) {
    for (let i = 0; i < 18; i++) {
      const x = i * 260 + 60 + Math.sin(i * 7) * 35,
        y = SURFACE - 120 - (i % 3) * 40;
      if (!visible(x, y)) continue;
      ground
        .fillStyle(0xe2e8cb, 0.7)
        .fillRoundedRect(x, y, 70, 15, 7)
        .fillRoundedRect(x + 20, y - 9, 32, 20, 8);
    }
    if (model.weather === 'rain' && !reduced)
      for (let i = 0; i < 60; i++) {
        const x = view.x + ((i * 71 + time * 13) % view.width),
          y = view.y + ((i * 47 + time * 105) % Math.max(1, SURFACE - view.y));
        fx.lineStyle(1, 0x6c9da6, 0.5).lineBetween(x, y, x - 2, y + 7);
      }
  }
  for (const [i, root] of model.world.roots.entries()) {
    const done = s.roots[i] === root.need,
      color = done ? 0xc39a61 : 0x9a704d;
    if (
      root.x > view.x - 100 &&
      root.x < view.x + view.width + 100 &&
      view.y < root.y + 100
    ) {
      ground.lineStyle(done ? 3 : 2, color, 0.85);
      let last = { x: root.x, y: SURFACE };
      for (let y = SURFACE + 24; y < root.y; y += 24) {
        const x = root.x + Math.sin(y * 0.025 + i) * 9;
        ground.lineBetween(last.x, last.y, x, y);
        ground
          .lineStyle(1, color, 0.6)
          .lineBetween(
            x,
            y,
            x + (Math.floor(y / 24) % 2 ? 1 : -1) * 22,
            y + 18,
          );
        ground.lineStyle(done ? 3 : 2, color, 0.85);
        last = { x, y };
      }
      ground.lineBetween(last.x, last.y, root.x, root.y);
    }
    art(
      'plant-' + i,
      root.x,
      SURFACE - 38,
      [2, 3, 5, 0][root.garden],
      done ? 96 : 62,
      10,
      'garden',
    )?.setTint(done ? 0xffffff : 0xaaa080);
    art(root.id, root.x, root.y - 8, 8, 76, -3)?.setTint(
      done ? 0xf1d68b : 0xc2a885,
    );
    if (!visible(root.x, root.y)) continue;
    if (done) {
      glow(root.x, root.y, 0xa8b46a, 42);
      if (!reduced)
        for (let j = 0; j < 4; j++)
          fx.fillStyle(0xe2cc87, 0.5).fillRect(
            root.x + Math.sin(time + j) * 24,
            root.y + 12 - ((time * 12 + j * 12) % 45),
            1,
            2,
          );
    } else
      for (let n = 0; n < root.need; n++) {
        fx.lineStyle(1, 0xd6b884).strokeCircle(
          root.x + (n - (root.need - 1) / 2) * 8,
          root.y + 29,
          3,
        );
        fx.fillStyle(n < s.roots[i] ? 0xd8c675 : 0x493329).fillCircle(
          root.x + (n - (root.need - 1) / 2) * 8,
          root.y + 29,
          2,
        );
      }
  }
  for (const [i, p] of model.world.pools.entries()) {
    if (!visible(p.x, p.y)) continue;
    ground
      .fillStyle(0x364f50, 0.8)
      .fillEllipse(p.x, p.y, p.radius * 2.3, p.radius * 1.1);
    ground
      .fillStyle(0x6eaaa0, 0.35)
      .fillEllipse(p.x, p.y, p.radius * 1.8, p.radius * 0.75);
    for (let j = 0; j < 3; j++)
      ground
        .lineStyle(1, 0xa5d6bf, 0.5)
        .lineBetween(
          p.x - p.radius / 2 + j * 9,
          p.y - 3 + j * 4,
          p.x - p.radius / 2 + j * 9 + 8,
          p.y - 3 + j * 4,
        );
    art('wet-stone-' + i, p.x - p.radius, p.y + 6, 10, p.radius * 0.9, -4);
  }
  for (const [i, r] of model.world.rocks.entries())
    art('rock-' + i, r.x, r.y, 10, r.radius * 2.7, 5)?.setTint(0xbba9a0);
  for (
    let row = Math.max(6, Math.floor(view.y / 96) - 1);
    row < Math.min(43, Math.ceil((view.y + view.height) / 96) + 1);
    row++
  )
    for (
      let col = Math.max(0, Math.floor(view.x / 96) - 1);
      col < Math.min(43, Math.ceil((view.x + view.width) / 96) + 1);
      col++
    ) {
      const hash = ((col * 71) ^ (row * 149)) >>> 0,
        x = col * 96 + (hash % 64),
        y = row * 96 + ((hash * 31) % 64);
      if (
        hash % 5 === 0 &&
        model.terrain.get(Math.floor(x / 8), Math.floor(y / 8)) === 0
      )
        art(
          'filament-' + col + '-' + row,
          x,
          y,
          y < 1500 ? 9 : 14,
          32 + (hash % 20),
          -6,
        )
          ?.setAlpha(0.36)
          .setTint(0xb5a497);
    }
  for (const [i, f] of model.world.food.entries())
    if (!s.food[i]) {
      const wiggle = reduced ? 0 : Math.sin(time * 3 + i) * 1.5;
      art(f.id, f.x + wiggle, f.y, f.kind, 25, 30)?.setFlipX(i % 2 === 0);
      if (f.kind === 3) glow(f.x, f.y, 0xe6b960, 18, 0.1);
    }
  for (const [i, p] of s.predators.entries()) {
    art('predator-' + i, p.x, p.y, i % 2 ? 5 : 4, 43, 180)?.setFlipX(
      Math.cos(time * 0.25 + i * 2) > 0,
    );
    if (p.alert > 0 && visible(p.x, p.y)) {
      fx.lineStyle(1, 0xf0a17b, p.alert * 0.7).strokeCircle(
        p.x,
        p.y,
        26 + p.alert * 7,
      );
      fx.fillStyle(0xffc79b)
        .fillRect(p.x - 1, p.y - 29, 2, 6)
        .fillRect(p.x - 1, p.y - 21, 2, 2);
    }
  }
  if (visible(PLUG.x, PLUG.y, 150)) {
    ground
      .lineStyle(6, a.plug === 3 ? 0x7bb8af : 0x3b5655)
      .lineBetween(PLUG.x, PLUG.y - 65, PLUG.x, PLUG.y + 45);
    art('clay-plug', PLUG.x, PLUG.y, 11, 70 - a.plug * 11, 20)?.setAlpha(
      a.plug === 3 ? 0.2 : 1,
    );
    if (a.plug === 3) {
      glow(PLUG.x, PLUG.y, 0x83c7be, 75);
      for (let j = 0; j < 7; j++)
        fx.fillStyle(0xb4e1d1, 0.65).fillRect(
          PLUG.x - 3,
          PLUG.y - 60 + ((time * 22 + j * 14) % 110),
          2,
          4,
        );
    } else
      for (let j = 0; j < 3; j++)
        fx.fillStyle(j < a.plug ? 0xc2e3b1 : 0x574335).fillCircle(
          PLUG.x + (j - 1) * 10,
          PLUG.y + 36,
          3,
        );
  }
  const baby =
    a.baby === 'following'
      ? model.segments[model.segments.length - 1]
      : a.baby === 'home'
        ? { x: NEST.x + 25, y: NEST.y + 5 }
        : BABY;
  art('baby', baby.x - 12, baby.y + 8, 6, 27, 190);
  if (a.baby === 'lost' && visible(BABY.x, BABY.y)) {
    glow(BABY.x, BABY.y, 0xf4c698, 35, 0.13);
    fx.lineStyle(1, 0xf4c698, 0.55).strokeCircle(
      BABY.x,
      BABY.y,
      20 + Math.sin(time * 2) * 2,
    );
  }
  if (visible(FLOOD.x + FLOOD.width / 2, FLOOD.y + FLOOD.height / 2, 400)) {
    ground
      .fillStyle(0x1f3541, 0.9)
      .fillRoundedRect(FLOOD.x, FLOOD.y, FLOOD.width, FLOOD.height, 28);
    ground
      .fillStyle(0x3c8296, 0.38)
      .fillRoundedRect(
        FLOOD.x + 5,
        FLOOD.y + 8,
        FLOOD.width - 10,
        FLOOD.height - 16,
        24,
      );
    ground
      .lineStyle(2, 0x7cc4c4, 0.7)
      .lineBetween(
        FLOOD.x + 24,
        FLOOD.y + 9,
        FLOOD.x + FLOOD.width - 24,
        FLOOD.y + 9,
      );
    AIR_POCKETS.forEach((p, i) => {
      ground.fillStyle(0x2d292b).fillEllipse(p.x, p.y, 72, 62);
      ground.lineStyle(1, 0xb0d6cb, 0.8).strokeEllipse(p.x, p.y, 62, 54);
      art('air-fungi-' + i, p.x, p.y + 32, 14, 56, -3);
      for (let j = 0; j < 3; j++)
        fx.lineStyle(1, 0xb5dddd, 0.5).strokeCircle(
          p.x + Math.sin(time + j) * 10,
          p.y + 15 - ((time * 12 + j * 14) % 30),
          2,
        );
    });
    if (!a.chamber) {
      art('deep-cocoon', CHAMBER.x, CHAMBER.y, 7, 52, 30);
      glow(CHAMBER.x, CHAMBER.y, 0xf8d795, 42);
    }
  }
  FUNGI.forEach((p, i) => {
    if (!visible(p.x, p.y)) return;
    art('fungus-' + i, p.x, p.y, 14, 64, 12)?.setTint(
      a.fungi[i] ? 0xffffff : 0x706a7e,
    );
    if (a.fungi[i]) {
      glow(p.x, p.y, 0x7dc6d8, 58);
      const next = FUNGI[i + 1] ?? DEEP_NEST;
      ground.lineStyle(2, 0x80b7be, 0.5).lineBetween(p.x, p.y, next.x, next.y);
    } else {
      fx.lineStyle(1, 0xc9c89a).strokeCircle(p.x, p.y + 30, 4);
      fx.fillStyle(0x887653).fillEllipse(p.x, p.y + 30, 3, 5);
    }
  });
  AMBER.forEach((p, i) => {
    if (!a.amber[i]) {
      art('amber-' + i, p.x, p.y, 12, 30, 15);
      if (visible(p.x, p.y)) glow(p.x, p.y, 0xebbf72, 20, 0.1);
    }
  });
  [NEST, ...(a.fungi.every(Boolean) ? [DEEP_NEST] : [])].forEach((p, i) => {
    const adult = model.experience >= ADULT_XP;
    art('nest-' + i, p.x, p.y, 15, 72, 8);
    if (adult || a.finale) glow(p.x, p.y, 0xf6d693, 60, 0.22);
    if (a.finale && gap(s, p) < 45) {
      art(
        'adult-cocoon',
        p.x,
        p.y - 7,
        7,
        55 + Math.min(1, a.finale / 4) * 15,
        230,
      )?.setAlpha(Math.max(0, 1 - a.finale / 4));
      for (let j = 0; j < 24; j++)
        fx.fillStyle(0xffdc94, 0.8).fillRect(
          p.x + Math.cos(j * 2.4 + time) * a.finale * 14,
          p.y + Math.sin(j * 2.4 + time) * a.finale * 10,
          2,
          2,
        );
    }
  });
  if (rainMoisture(s.y, s.seconds) && !reduced)
    for (let i = 0; i < 14; i++) {
      const x = view.x + ((i * 83) % view.width),
        y = view.y + ((i * 61 + time * 18) % view.height);
      if (y > SURFACE) fx.fillStyle(0x8dbab2, 0.45).fillRect(x, y, 1, 3);
    }
  const near = targets(a)
    .filter((p) => gap(s, p) < 55)
    .sort((p, q) => gap(s, p) - gap(s, q))[0];
  if (near)
    fx.lineStyle(1, 0xf1d4a0, 0.6).strokeCircle(
      near.x,
      near.y,
      25 + Math.sin(time * 4) * 2,
    );
  if (model.stage >= 2) glow(s.x, s.y, 0xe2ba83, 34, 0.12);
}
