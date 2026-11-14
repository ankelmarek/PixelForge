import Phaser from 'phaser';
import { PUMPS, PARKING, SHOP, TILE, UNIT, paved } from './world';
import { bodies } from './state';
import type { StationModel } from './model';
import type { Motion } from './types';

/** Presentation only: hiding a sprite never stops its simulation. */
export class StationView {
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private positions = new Map<
    string,
    { x: number; y: number; previousX: number; previousY: number }
  >();
  private lastTick = -1;
  private pumps: Phaser.GameObjects.Image[] = [];
  private objects: Phaser.GameObjects.GameObject[] = [];
  private effects: Phaser.GameObjects.Graphics;
  private doors: Phaser.GameObjects.Rectangle[] = [];
  constructor(
    private scene: Phaser.Scene,
    private model: StationModel,
  ) {
    const g = scene.add.graphics().setDepth(2);
    this.objects.push(g);
    const rect = (x: number, y: number, w: number, h: number, c: number) =>
      g.fillStyle(c).fillRect(x, y, w, h);
    // Road paint and kerbs are part of the setting, never collision overlays.
    for (let x = 0; x < 4096; x += 64) {
      rect(x, 160 * TILE, 36, 3, 0xe5d6a9);
      rect(x, 153 * TILE, 60, 3, 0xbdc7ad);
      rect(x, 166 * TILE, 60, 3, 0xbdc7ad);
    }
    for (const p of PARKING) {
      g.lineStyle(2, 0xf0e2b9, 0.8).strokeRect(
        (p.x - 3) * TILE,
        (p.y - 3) * TILE,
        6 * TILE,
        6 * TILE,
      );
      rect((p.x - 2) * TILE, (p.y - 3) * TILE, 4 * TILE, 4, 0x586e68);
    }
    // Inbound arrow and separate service yard.
    for (const [x, y] of [
      [106, 151],
      [106, 136],
      [148, 141],
    ]) {
      g.lineStyle(3, 0xe8e1c2, 0.8).lineBetween(
        x * TILE,
        (y - 2) * TILE,
        x * TILE,
        (y + 2) * TILE,
      );
      const d = x === 148 ? 1 : -1;
      g.lineBetween(
        x * TILE,
        (y + d * 2) * TILE,
        (x - 1) * TILE,
        (y + d) * TILE,
      ).lineBetween(
        x * TILE,
        (y + d * 2) * TILE,
        (x + 1) * TILE,
        (y + d) * TILE,
      );
    }
    g.lineStyle(2, 0xe8d699, 0.7).strokeRect(
      140 * TILE,
      106 * TILE,
      8 * TILE,
      8 * TILE,
    );
    for (let i = 0; i < 4; i++)
      rect((140 + i * 2) * TILE, 114 * TILE, 16, 3, 0xe8d699);
    // Short pedestrian crossing in front of the shop.
    for (let x = 121; x < 129; x += 2)
      rect(x * TILE, 115 * TILE, 16, 40, 0xcbd4ba);
    const shop = scene.add
      .image(SHOP.x * TILE, SHOP.y * TILE, 'shop')
      .setOrigin(0)
      .setDepth(10);
    this.objects.push(shop);
    const text = (
      x: number,
      y: number,
      value: string,
      size = 14,
      color = '#f4e6bd',
    ) => {
      const t = scene.add
        .text(x, y, value, {
          fontFamily: 'monospace',
          fontSize: `${size}px`,
          color,
          fontStyle: 'bold',
          resolution: 1,
        })
        .setDepth(12);
      this.objects.push(t);
      return t;
    };
    text(118 * TILE, 106 * TILE + 8, 'O R L A R', 16);
    text(129 * TILE, 106 * TILE + 12, '24h', 10, '#efb851');
    text(112 * TILE + 18, 110 * TILE, 'KAWA', 8, '#304d4b');
    text(128 * TILE + 10, 110 * TILE, 'SKLEP', 8, '#304d4b');
    this.doors = [0, 1].map((i) =>
      scene.add
        .rectangle(
          (121.5 + i * 3.8) * TILE,
          113 * TILE + 7,
          48,
          18,
          0x86b8ae,
          0.48,
        )
        .setStrokeStyle(1, 0xe4dcb5)
        .setDepth(14),
    );
    this.objects.push(...this.doors);
    for (const [i, p] of PUMPS.entries()) {
      const img = scene.add
        .image((p.x - 3) * TILE, p.y * TILE, 'pump', 0)
        .setOrigin(0.45, 0.8)
        .setDepth(30);
      this.pumps.push(img);
      this.objects.push(img);
      text((p.x - 3) * TILE - 4, p.y * TILE - 32, String(i + 1), 8, '#213b41');
    }
    // Price pylon, two buried tank caps, original geometric eagle sign.
    rect(101 * TILE, 143 * TILE, 6, 94, 0x344c4a);
    rect(99 * TILE, 139 * TILE, 72, 74, 0x243c42);
    rect(99 * TILE, 139 * TILE, 72, 5, 0xefb851);
    text(99 * TILE + 7, 139 * TILE + 9, 'ORLAR', 11, '#efb851');
    text(99 * TILE + 7, 139 * TILE + 29, 'E95 6.00', 8);
    text(99 * TILE + 7, 139 * TILE + 46, 'ON  5.80', 8);
    for (const [i, x] of [137, 140].entries()) {
      g.fillStyle(0x687f78)
        .fillCircle(x * TILE, 102 * TILE, 17)
        .fillStyle(i ? 0x243c42 : 0x48aa9a)
        .fillCircle(x * TILE, 102 * TILE, 10);
      text(x * TILE - 9, 102 * TILE - 4, i ? 'ON' : 'E95', 7);
    }
    // Tables, bins, flowering planters and a fenced meadow.
    for (const x of [108, 110, 135]) {
      rect(x * TILE, 114 * TILE, 21, 16, 0x81664b);
      rect(x * TILE, 114 * TILE - 3, 21, 10, 0x456b4a);
      for (let i = 0; i < 3; i++)
        rect(
          x * TILE + i * 6 + 2,
          114 * TILE - 4,
          3,
          3,
          i % 2 ? 0xf0d37c : 0xd98068,
        );
    }
    for (const x of [107, 110]) {
      rect(x * TILE, 110 * TILE, 28, 6, 0x6b654d);
      rect(x * TILE + 2, 110 * TILE - 3, 24, 5, 0xe0bc7a);
      rect(x * TILE + 2, 110 * TILE + 10, 24, 4, 0xba935f);
      rect(x * TILE + 2, 110 * TILE - 12, 24, 4, 0xba935f);
    }
    for (let x = 96; x < 162; x += 4)
      if (x < 136 || x > 160) {
        rect(x * TILE, 103 * TILE, 4, 20, 0x8d7d58);
        rect(x * TILE, 103 * TILE + 4, 64, 3, 0xb7a67b);
      }
    for (let y = 16; y < 244; y += 12)
      for (let x = 10; x < 248; x += 14) {
        const q = { x: x + (y % 7), y };
        if (
          paved(q) ||
          (q.x > 94 && q.x < 164 && q.y > 92 && q.y < 170) ||
          (q.x > 175 && q.x < 235 && q.y > 52 && q.y < 112)
        )
          continue;
        if ((x + y) % 5 === 0) continue;
        this.objects.push(
          scene.add
            .image(q.x * TILE, q.y * TILE, 'tree')
            .setOrigin(0.5, 0.8)
            .setDepth(5)
            .setFlipX(x % 3 === 0),
        );
      }
    this.effects = scene.add.graphics().setDepth(80);
    this.objects.push(this.effects);
  }
  draw(selection: string, build: boolean) {
    const { scene, model } = this,
      s = model.state,
      g = this.effects;
    g.clear();
    const present = new Set<string>();
    for (const m of bodies(s)) {
      present.add(m.id);
      const customer = s.customers.find((c) => c.id === m.id),
        worker = s.workers.find((w) => w.motion.id === m.id);
      const texture =
        m.kind === 'car' ? 'cars' : m.kind === 'truck' ? 'truck' : 'people';
      const turning = m.turn ? this.turnFrame(m) : m.heading * 2;
      const phase = m.route.length ? Math.floor(s.tick / 4) % 4 : 0;
      const frame =
        m.kind === 'car'
          ? (customer?.color ?? 0) * 16 +
            turning * 2 +
            Number(!!m.turn || m.blocked > 0)
          : m.kind === 'truck'
            ? turning
            : (worker ? 0 : 2) * 16 + phase * 4 + m.heading;
      let img = this.sprites.get(m.id);
      if (!img) {
        img = scene.add
          .image(0, 0, texture, frame)
          .setOrigin(0.5, m.kind === 'person' ? 0.85 : 0.5);
        this.sprites.set(m.id, img);
      }
      const x = (m.x / UNIT) * TILE,
        y = (m.y / UNIT) * TILE;
      let pos = this.positions.get(m.id);
      if (!pos) {
        pos = { x, y, previousX: x, previousY: y };
        this.positions.set(m.id, pos);
      }
      if (this.lastTick !== s.tick) {
        pos.previousX = pos.x;
        pos.previousY = pos.y;
        pos.x = x;
        pos.y = y;
      }
      const f = model.clock.remainder / 50,
        zoom = scene.cameras.main.zoom;
      img
        .setPosition(
          Math.round((pos.previousX + (x - pos.previousX) * f) * zoom) / zoom,
          Math.round((pos.previousY + (y - pos.previousY) * f) * zoom) / zoom,
        )
        .setFrame(frame)
        .setDepth(20 + m.y / UNIT / 16);
      const c = scene.cameras.main.getWorldPoint(0, 0),
        w = scene.cameras.main.width / scene.cameras.main.zoom,
        h = scene.cameras.main.height / scene.cameras.main.zoom;
      img.setVisible(
        img.x > c.x - 128 &&
          img.x < c.x + w + 128 &&
          img.y > c.y - 128 &&
          img.y < c.y + h + 128,
      );
      if (selection === m.id)
        g.lineStyle(2, 0xf6d47b).strokeCircle(
          img.x,
          img.y,
          m.kind === 'person' ? 14 : 35,
        );
      if (
        customer &&
        ['queue', 'preparing', 'fueling', 'checkout'].includes(customer.phase)
      ) {
        let label = this.labels.get(m.id);
        if (!label) {
          label = scene.add
            .text(0, 0, '', {
              fontFamily: 'monospace',
              fontSize: '9px',
              color: '#f6e6bd',
              backgroundColor: '#243c42',
              padding: { x: 4, y: 3 },
              resolution: 1,
            })
            .setOrigin(0.5)
            .setDepth(70);
          this.labels.set(m.id, label);
        }
        label
          .setPosition(img.x, img.y - 37)
          .setText(
            customer.phase === 'fueling'
              ? `${(customer.issued / 10).toFixed(1)} L`
              : customer.phase === 'checkout'
                ? '◈'
                : (customer.fuel?.toUpperCase() ?? '☕'),
          );
        if (customer.phase === 'fueling' && customer.pump !== null) {
          const p = PUMPS[customer.pump];
          g.lineStyle(3, 0x263d40).lineBetween(
            (p.x - 2) * TILE,
            p.y * TILE,
            img.x - 10,
            img.y + 3,
          );
          g.fillStyle(0x223d40)
            .fillRect(img.x - 18, img.y + 30, 36, 3)
            .fillStyle(0x6bd2a9)
            .fillRect(
              img.x - 18,
              img.y + 30,
              (36 * customer.issued) / customer.requested,
              3,
            );
        }
      } else {
        this.labels.get(m.id)?.destroy();
        this.labels.delete(m.id);
      }
    }
    for (const [id, img] of this.sprites)
      if (!present.has(id)) {
        img.destroy();
        this.sprites.delete(id);
        this.positions.delete(id);
        this.labels.get(id)?.destroy();
        this.labels.delete(id);
      }
    this.lastTick = s.tick;
    const distance = Math.min(
      ...s.customers
        .filter((c) => c.driver)
        .map((c) =>
          Math.hypot(c.driver!.x / UNIT - 124, c.driver!.y / UNIT - 113),
        ),
    );
    const door = distance < 3 ? 1 : distance < 5 ? 0.5 : 0;
    this.doors.forEach((d, i) =>
      d.setX((121.5 + i * 3.8 + (i ? 2.7 : -1.5) * door) * TILE),
    );
    s.pumps.forEach((p, i) => {
      const site = PUMPS[i];
      this.pumps[i]
        .setVisible(p.built)
        .setFrame(
          p.open
            ? s.customers.some((c) => c.pump === i && c.phase === 'fueling')
              ? Math.floor(s.tick / 5) % 4
              : 1
            : 0,
        )
        .setAlpha(p.open ? 1 : 0.55);
      if (p.construction || (i === 2 && build)) {
        const valid = model.previewPump().valid;
        g.fillStyle(
          p.construction ? 0xefb851 : valid ? 0x62c6a8 : 0xd57766,
          0.22,
        ).fillRect(
          (site.x - 4) * TILE,
          (site.y - 4) * TILE,
          6 * TILE,
          9 * TILE,
        );
        g.lineStyle(2, 0xefb851).strokeRect(
          (site.x - 4) * TILE,
          (site.y - 4) * TILE,
          6 * TILE,
          9 * TILE,
        );
        if (p.construction)
          g.fillStyle(0xefb851).fillRect(
            (site.x - 4) * TILE,
            (site.y + 5) * TILE,
            96 * (1 - p.construction / 300),
            4,
          );
      }
      if (selection === p.id)
        g.lineStyle(2, 0xf6d47b).strokeCircle(
          (site.x - 3) * TILE,
          site.y * TILE,
          33,
        );
    });
    if (s.delivery?.phase === 'unloading')
      g.lineStyle(4, 0x30494a).lineBetween(
        139 * TILE,
        110 * TILE,
        144 * TILE,
        110 * TILE,
      );
  }
  private turnFrame(m: Motion) {
    const delta = (m.nextHeading - m.heading + 4) % 4,
      mid = (m.heading * 2 + (delta === 3 ? -1 : 1) + 8) % 8;
    return m.turn > (m.kind === 'truck' ? 8 : 4) ? m.heading * 2 : mid;
  }
  destroy() {
    this.objects.forEach((o) => o.destroy());
    this.sprites.forEach((o) => o.destroy());
    this.labels.forEach((o) => o.destroy());
  }
}
