import Phaser from 'phaser';
import type { VineyardModel, Plan } from './model';
import { SPRINKLER_RADIUS } from './water';

export function registerSeasonArt(scene: Phaser.Scene) {
  if (scene.textures.exists('vineyard-water')) return;
  const t = scene.textures.createCanvas('vineyard-water', 96, 32)!,
    c = t.context;
  const rect = (color: string, x: number, y: number, w: number, h: number) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  // Three small, integer-pixel sprites: riveted tank, motor pump, brass sprinkler.
  rect('#233b32', 5, 26, 22, 3);
  rect('#324f51', 6, 9, 20, 17);
  rect('#587d80', 8, 6, 16, 21);
  rect('#7da1a0', 10, 7, 3, 18);
  rect('#3e6268', 21, 8, 3, 17);
  rect('#a8c1ae', 8, 6, 16, 2);
  rect('#30494d', 6, 11, 20, 2);
  rect('#30494d', 6, 22, 20, 2);
  rect('#b7c3a0', 7, 12, 2, 1);
  rect('#b7c3a0', 23, 12, 2, 1);
  rect('#223f48', 14, 12, 4, 9);
  rect('#8cc6d3', 15, 13, 2, 7);
  rect('#d6d9bc', 14, 3, 5, 3);
  rect('#41625e', 23, 20, 5, 3);
  rect('#344a35', 37, 25, 22, 4);
  rect('#806c49', 39, 23, 18, 3);
  rect('#6a8461', 39, 13, 15, 11);
  rect('#a1ae79', 40, 12, 13, 3);
  rect('#47624a', 40, 17, 12, 2);
  rect('#47624a', 40, 21, 12, 2);
  rect('#b8b5a0', 54, 15, 4, 8);
  rect('#597b7c', 56, 18, 6, 4);
  rect('#b7cebb', 57, 18, 5, 1);
  rect('#405951', 35, 18, 4, 5);
  rect('#d9bf6e', 46, 8, 4, 4);
  rect('#8e7549', 47, 6, 2, 2);
  rect('#334f38', 73, 27, 15, 2);
  rect('#8d8060', 78, 13, 4, 14);
  rect('#ccb882', 79, 14, 2, 10);
  rect('#496c6c', 73, 12, 16, 3);
  rect('#b4d0bc', 73, 11, 16, 2);
  rect('#e4d39a', 78, 8, 5, 4);
  rect('#6c887d', 70, 9, 4, 5);
  rect('#9db9a8', 88, 12, 4, 5);
  rect('#d3dbc2', 70, 8, 4, 2);
  for (let i = 0; i < 3; i++) t.add(i, 0, i * 32, 0, 32, 32);
  t.refresh();
  t.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

export class SeasonRenderer {
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  constructor(
    private scene: Phaser.Scene,
    private model: VineyardModel,
  ) {
    registerSeasonArt(scene);
  }
  draw(
    g: Phaser.GameObjects.Graphics,
    e: Phaser.GameObjects.Graphics,
    view: { x: number; y: number; width: number; height: number },
    selection: string[],
    plan?: Plan,
  ) {
    const s = this.model.state,
      env = s.environment,
      seen = new Set<string>();
    if (env) {
      const visible = (x: number, y: number, margin = 32) =>
        x >= view.x - margin &&
        x <= view.x + view.width + margin &&
        y >= view.y - margin &&
        y <= view.y + view.height + margin;
      const w = this.model.climate.at(s.tick),
        water = this.model.water!;
      const showPipes =
        (!!plan && ['pipe', 'tank', 'pump', 'sprinkler'].includes(plan.tool)) ||
        env.water.devices.some((d) => selection.includes(d.id));
      const pipes = new Set(
        [...env.water.pipes, ...env.water.devices].map((p) => `${p.x},${p.y}`),
      );
      for (const p of env.water.pipes)
        if (visible(p.x * 16, p.y * 16)) {
          const x = p.x * 16 + 8,
            y = p.y * 16 + 8;
          g.lineStyle(
            showPipes ? 4 : 2,
            showPipes ? 0x8fbfca : 0x628e87,
            showPipes ? 0.9 : 0.5,
          );
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ])
            if (pipes.has(`${p.x + dx},${p.y + dy}`))
              g.lineBetween(x, y, x + dx * 8, y + dy * 8);
          g.fillStyle(0xd1d4af, showPipes ? 0.9 : 0.4);
          g.fillRect(x - 1, y - 1, 2, 2);
        }
      for (const d of env.water.devices) {
        const x = d.x * 16 + 8,
          y = d.y * 16 + 8,
          flow = water.flow.get(d.id) ?? 0;
        if (!visible(x, y, SPRINKLER_RADIUS * 16)) continue;
        seen.add(d.id);
        let sprite = this.sprites.get(d.id);
        if (!sprite) {
          sprite = this.scene.add.image(
            x,
            y,
            'vineyard-water',
            { tank: 0, pump: 1, sprinkler: 2 }[d.kind],
          );
          this.sprites.set(d.id, sprite);
        }
        sprite
          .setPosition(x, y - 7)
          .setDisplaySize(32, 32)
          .setDepth(y);
        if (d.kind === 'tank') {
          e.fillStyle(0x263e3c);
          e.fillRect(x - 11, y + 11, 22, 3);
          e.fillStyle(d.volume < 50000 ? 0xebac75 : 0x8dc9cc);
          e.fillRect(x - 11, y + 11, Math.ceil((22 * d.volume) / 1000000), 3);
        }
        if (d.kind === 'pump' && water.running.has(d.id)) {
          e.fillStyle(0xc4dd83, 0.7);
          e.fillRect(x - 1, y - 17, 2, 2);
        }
        if (d.kind === 'sprinkler' && flow) {
          const r = SPRINKLER_RADIUS * 16;
          g.fillStyle(0x70a8ae, 0.04 * flow);
          g.fillCircle(x, y, r);
          for (let i = 0; i < 20; i++) {
            const phase = (s.tick * 0.035 + i * 0.181) % 1,
              angle = i * 2.4 + s.tick * 0.007,
              dist = phase * r;
            e.fillStyle(
              w.kind === 'frost' ? 0xd6eced : 0xafd9dc,
              (1 - phase) * 0.65 * flow,
            );
            e.fillRect(
              Math.round(x + Math.cos(angle) * dist),
              Math.round(
                y + Math.sin(angle) * dist - 14 * Math.sin(phase * Math.PI),
              ),
              2,
              2,
            );
          }
        }
        if (selection.includes(d.id)) {
          e.lineStyle(2, 0xf4d47c, 0.9);
          e.strokeRect(d.x * 16 - 3, d.y * 16 - 15, 22, 32);
          if (d.kind === 'sprinkler') {
            e.lineStyle(1, 0xd3edf0, 0.7);
            e.strokeCircle(x, y, SPRINKLER_RADIUS * 16);
          }
        }
        if (showPipes && d.kind === 'sprinkler' && !water.connected.has(d.id)) {
          e.fillStyle(0xf1b17a);
          e.fillRect(x + 8, y - 20, 4, 4);
        }
      }
      if (plan?.tool === 'sprinkler') {
        g.fillStyle(plan.valid ? 0x9fd2da : 0xe6ab8f, 0.09);
        g.fillCircle(
          plan.from.x * 16 + 8,
          plan.from.y * 16 + 8,
          SPRINKLER_RADIUS * 16,
        );
        e.lineStyle(1, plan.valid ? 0xb7d8db : 0xe6ab8f, 0.75);
        e.strokeCircle(
          plan.from.x * 16 + 8,
          plan.from.y * 16 + 8,
          SPRINKLER_RADIUS * 16,
        );
      }
      if (w.kind === 'frost') {
        e.fillStyle(0x93bed5, 0.1);
        e.fillRect(view.x, view.y, view.width, view.height);
      }
      if (w.kind === 'drought') {
        e.fillStyle(0xe1b367, 0.07);
        e.fillRect(view.x, view.y, view.width, view.height);
      }
      if (w.rain) {
        e.lineStyle(1, 0xb4d3db, 0.35);
        // Bounded viewport particles, never a full-world texture or sprite set.
        for (let i = 0; i < 60 * w.rain; i++) {
          const x = Math.floor(
              view.x + ((i * 127 + s.tick * 2) % (view.width + 20)),
            ),
            y = Math.floor(
              view.y + ((i * 73 + s.tick * 5) % (view.height + 20)),
            );
          e.lineBetween(x, y, x - 2, y + 6);
        }
      }
    }
    for (const [id, sprite] of this.sprites)
      if (!seen.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
      }
  }
  destroy() {
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }
}
