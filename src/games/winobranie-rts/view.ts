import Phaser from 'phaser';
import { cameraView } from '../../engine/api';
import { type VineyardModel, type Plan, STORE, houseAt } from './model';
import { varieties, riverAt } from './world';

export function registerArt(scene: Phaser.Scene) {
  const objects = scene.textures.get('objects'),
    source = objects.getSourceImage() as HTMLImageElement;
  for (let i = 0; i < 16; i++)
    if (!objects.has(String(i))) {
      const x = Math.round(((i % 4) * source.width) / 4),
        y = Math.round((Math.floor(i / 4) * source.height) / 4);
      objects.add(
        i,
        0,
        x,
        y,
        Math.round((((i % 4) + 1) * source.width) / 4) - x,
        Math.round(((Math.floor(i / 4) + 1) * source.height) / 4) - y,
      );
    }
  objects.setFilter(Phaser.Textures.FilterMode.NEAREST);
  if (scene.textures.exists('vineyard-ground')) return;
  const texture = scene.textures.createCanvas('vineyard-ground', 112, 16)!,
    ctx = texture.context;
  const colors = [
    '#738d49',
    '#78954e',
    '#b9a67c',
    '#8a9c66',
    '#608b95',
    '#baad8d',
    '#99865d',
  ];
  colors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * 16, 0, 16, 16);
    for (let j = 0; j < 38; j++) {
      const x = (j * 13 + i * 3) % 16,
        y = (j * 7 + Math.floor(j / 3)) % 16;
      ctx.fillStyle =
        i === 4
          ? j % 2
            ? '#6c9fa5'
            : '#5c858d'
          : j % 2
            ? 'rgba(255,234,170,.10)'
            : 'rgba(38,58,31,.10)';
      ctx.fillRect(i * 16 + x, y, j % 5 === 0 ? 3 : 1, 1);
    }
    if (i === 5) {
      ctx.fillStyle = '#877b67';
      for (let y = 0; y < 16; y += 4) ctx.fillRect(i * 16, y, 16, 1);
    }
    if (i === 6) {
      ctx.fillStyle = '#826c48';
      ctx.fillRect(i * 16, 7, 16, 2);
    }
    texture.add(i, 0, i * 16, 0, 16, 16);
  });
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}
export class VineyardViewRenderer {
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  private ground: Phaser.GameObjects.Graphics;
  private effects: Phaser.GameObjects.Graphics;
  rendered = 0;
  constructor(
    private scene: Phaser.Scene,
    private model: VineyardModel,
  ) {
    this.ground = scene.add.graphics().setDepth(0);
    this.effects = scene.add.graphics().setDepth(10000);
  }
  draw(
    selection: string[],
    plan: Plan | undefined,
    box?: { x: number; y: number; width: number; height: number },
  ) {
    const view = cameraView(this.scene.cameras.main),
      state = this.model.state,
      g = this.ground,
      e = this.effects,
      wanted = new Set<string>();
    g.clear();
    e.clear();
    const visible = (x: number, y: number, margin = 160) =>
      x >= view.x - margin &&
      y >= view.y - margin &&
      x <= view.x + view.width + margin &&
      y <= view.y + view.height + margin;
    const sprite = (
      id: string,
      x: number,
      y: number,
      frame: number,
      width: number,
      height: number,
      alpha = 1,
    ) => {
      if (!visible(x, y)) return;
      wanted.add(id);
      let s = this.sprites.get(id);
      if (!s) {
        s = this.scene.add.image(x, y, 'objects', frame);
        this.sprites.set(id, s);
      }
      s.setFrame(frame)
        .setPosition(Math.round(x), Math.round(y))
        .setDisplaySize(width, height)
        .setDepth(y)
        .setAlpha(alpha);
      return s;
    };
    for (const parcel of state.parcels) {
      g.lineStyle(1, 0xd6df95, 0.65);
      g.strokeRect(
        parcel.x * 16,
        parcel.y * 16,
        parcel.width * 16,
        parcel.height * 16,
      );
      for (const [x, y] of [
        [parcel.x, parcel.y],
        [parcel.x + parcel.width, parcel.y],
        [parcel.x, parcel.y + parcel.height],
        [parcel.x + parcel.width, parcel.y + parcel.height],
      ]) {
        g.fillStyle(0xb0a070);
        g.fillRect(x * 16 - 2, y * 16 - 7, 4, 8);
        g.fillStyle(0xe3d3a3);
        g.fillRect(x * 16 - 3, y * 16 - 9, 6, 3);
      }
    }
    for (const p of state.roads)
      if (visible(p.x * 16, p.y * 16, 16)) {
        g.fillStyle((p.x + p.y) % 3 ? 0xb8a379 : 0xc1ad84);
        g.fillRect(p.x * 16, p.y * 16, 16, 16);
        g.fillStyle(0xd7c69a, 0.5);
        g.fillRect(p.x * 16 + 3, p.y * 16 + 5, 3, 1);
        g.fillRect(p.x * 16 + 12, p.y * 16 + 11, 2, 1);
      }
    // Deterministic, culled scenery. Never allocate the whole world's sprites.
    for (
      let cy = Math.max(0, Math.floor(view.y / 128) - 2);
      cy <= Math.min(63, Math.ceil((view.y + view.height) / 128) + 2);
      cy++
    )
      for (
        let cx = Math.max(0, Math.floor(view.x / 128) - 2);
        cx <= Math.min(63, Math.ceil((view.x + view.width) / 128) + 2);
        cx++
      ) {
        const n = ((cx * 73856093) ^ (cy * 19349663)) >>> 0,
          x = cx * 128 + (n % 97),
          y = cy * 128 + ((n >>> 8) % 97),
          cell = { x: Math.floor(x / 16), y: Math.floor(y / 16) };
        const farm = state.parcels.some(
          (p) =>
            cell.x >= p.x &&
            cell.y >= p.y &&
            cell.x < p.x + p.width &&
            cell.y < p.y + p.height,
        );
        if (!this.model.walkable(cell) || (cell.y >= 254 && cell.y <= 262))
          continue;
        if (!farm && n % 3 === 0)
          sprite(`tree-${cx}-${cy}`, x, y, 14, 100, 110);
        else if (n % 2 === 0 && Math.abs(cell.x - riverAt(cell.y)) > 6)
          sprite(`grass-${cx}-${cy}`, x, y, 15, 28, 28, 0.65);
      }
    for (const r of state.rows) {
      const color = varieties[r.variety].color;
      for (let i = 0; i < r.cells.length; i += 2) {
        const p = r.cells[i];
        if (!visible(p.x * 16, p.y * 16, 64)) continue;
        g.fillStyle(0x876b48, 0.7);
        g.fillEllipse(p.x * 16 + 8, p.y * 16 + 12, 34, 12);
        const s = sprite(
          `${r.id}-${i}`,
          p.x * 16 + 8,
          p.y * 16 + 2,
          r.mature ? varieties[r.variety].frame : 11,
          45,
          40,
          r.work ? 0.55 : 1,
        );
        if (s) s.setTint(r.stock || !r.mature ? 0xffffff : 0xa5bb72);
      }
      if (selection.includes(r.id)) {
        e.lineStyle(2, color, 0.9);
        for (const p of r.cells)
          e.lineBetween(p.x * 16, p.y * 16 + 15, p.x * 16 + 16, p.y * 16 + 15);
      }
    }
    sprite('warehouse', (STORE.x + 4) * 16, (STORE.y + 2.5) * 16, 1, 148, 120);
    for (const b of state.buildings) {
      const x = (b.x + b.width / 2) * 16,
        y = (b.y + b.height / 2) * 16;
      sprite(b.id, x, y - 9, 0, b.width * 19, b.height * 20, b.work ? 0.5 : 1);
      g.fillStyle(0x6b6551, 0.6);
      g.fillRect(b.access.x * 16, b.access.y * 16, 16, 16);
      g.lineStyle(1, 0xdfd3a8, 0.5);
      g.strokeRect((b.dock.x - 1) * 16, (b.dock.y - 1) * 16, 48, 48);
      if (selection.includes(b.id)) {
        e.lineStyle(2, 0xf4d47c);
        e.strokeRoundedRect(
          b.x * 16 - 2,
          b.y * 16 - 2,
          b.width * 16 + 4,
          b.height * 16 + 4,
          4,
        );
      }
      const amount = Object.values(b.must).reduce((a, n) => a + n, 0),
        grapes = Object.values(b.stock).reduce((a, n) => a + n, 0);
      if (amount) sprite(`${b.id}-barrel`, x + 34, y + 26, 13, 28, 33);
      if (grapes) sprite(`${b.id}-crate`, x - 34, y + 30, 12, 27, 25);
      if (b.work || b.batch) {
        const p = b.work
          ? 1 - b.work / 120
          : b.batch!.work
            ? 1 - b.batch!.work / 60
            : 1 - b.batch!.remaining / 100;
        e.fillStyle(0x263d30, 0.8);
        e.fillRoundedRect(x - 22, y - 54, 44, 5, 2);
        e.fillStyle(b.work ? 0xe0c98a : 0xb0d187);
        e.fillRect(x - 21, y - 53, p * 42, 3);
      }
    }
    if (Object.values(state.warehouse).some((n) => n > 0))
      sprite('stock', (STORE.x + 2) * 16, (STORE.y + 5) * 16, 12, 35, 30);
    for (const u of state.units) {
      const x = (u.x + 0.5) * 16,
        y = (u.y + 0.5) * 16,
        moving = u.path.length > 0,
        carrying = Object.values(u.cargo).some((n) => n > 0);
      const bob = moving
        ? Math.sin(state.tick * 0.8) * 1.2
        : u.job?.kind === 'harvest' || u.job?.kind === 'press'
          ? Math.sin(state.tick * 0.35)
          : 0;
      g.fillStyle(0x34482d, 0.3);
      g.fillEllipse(
        x,
        y + 7,
        u.kind === 'tractor' ? 40 : 15,
        u.kind === 'tractor' ? 15 : 6,
      );
      const frame =
        u.kind === 'tractor'
          ? Math.abs((u.path[0]?.y ?? u.y) - u.y) > 0.1
            ? 3
            : 2
          : carrying
            ? 6
            : moving && state.tick % 10 < 5
              ? 5
              : 4;
      const s = sprite(
        u.id,
        x,
        y - 6 + bob,
        frame,
        u.kind === 'tractor' ? 64 : 40,
        u.kind === 'tractor' ? 52 : 42,
      );
      if (s) s.setFlipX((u.path[0]?.x ?? u.x) < u.x);
      if (carrying && u.kind === 'tractor')
        sprite(`${u.id}-cargo`, x + 15, y - 9, 12, 20, 19);
      if (selection.includes(u.id)) {
        e.lineStyle(1.5, 0xffe6a1);
        e.strokeEllipse(
          x,
          y + 7,
          u.kind === 'tractor' ? 52 : 24,
          u.kind === 'tractor' ? 23 : 11,
        );
      }
      if (u.blocked) {
        e.fillStyle(0xe7a05c);
        e.fillCircle(x, y - 25, 3);
      } else if (u.job && !moving) {
        e.fillStyle(0xf9db83, 0.7);
        e.fillCircle(x + 11, y - 15, 1.5 + Math.sin(state.tick * 0.15));
      }
    }
    if (plan) {
      e.fillStyle(plan.valid ? 0xb7e49a : 0xf1927d, 0.23);
      e.lineStyle(1, plan.valid ? 0xd3f4a6 : 0xffb59c, 0.8);
      for (const p of plan.cells) {
        e.fillRect(p.x * 16, p.y * 16, 16, 16);
        e.strokeRect(p.x * 16, p.y * 16, 16, 16);
      }
      if (plan.tool === 'house' || plan.tool === 'move')
        sprite(
          'ghost',
          plan.from.x * 16,
          plan.from.y * 16 - 8,
          0,
          128,
          116,
          0.55,
        );
    }
    if (plan && (plan.tool === 'house' || plan.tool === 'move')) {
      const building = houseAt(plan.from, plan.rotation);
      e.lineStyle(2, plan.valid ? 0xe8e5a8 : 0xe4a194, 0.85);
      e.strokeRect(
        (building.dock.x - 1) * 16,
        (building.dock.y - 1) * 16,
        48,
        48,
      );
      e.lineBetween(
        (building.access.x + 0.5) * 16,
        (building.access.y + 0.5) * 16,
        (building.dock.x + 0.5) * 16,
        (building.dock.y + 0.5) * 16,
      );
      e.strokeCircle(
        (building.dock.x + 0.5) * 16,
        (building.dock.y + 0.5) * 16,
        5,
      );
    }
    if (box) {
      e.fillStyle(0xd7e9a6, 0.12);
      e.fillRect(box.x, box.y, box.width, box.height);
      e.lineStyle(1, 0xf3e0aa);
      e.strokeRect(box.x, box.y, box.width, box.height);
    }
    for (const [id, s] of this.sprites)
      if (!wanted.has(id)) {
        s.destroy();
        this.sprites.delete(id);
      }
    this.rendered = this.sprites.size;
  }
  destroy() {
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
    this.ground.destroy();
    this.effects.destroy();
  }
}
