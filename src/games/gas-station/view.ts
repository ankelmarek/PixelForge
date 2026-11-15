import Phaser from 'phaser';
import { PUMPS, PARKING, SHOP, TILE, UNIT, paved } from './world';
import { bodies } from './state';
import type { StationModel } from './model';
import type { Motion } from './types';
import { extraPump, PARCELS, ENTRY, EXIT } from './development';
import { roadBounds, siteBounds, island, type BuildRequest } from './placement';
import { activeEvent, pumpWorking } from './campaign-data';
import { inside } from '../../engine/api/strategy';
import { StationLighting, LAMPS } from './lighting';

/** Presentation only: hiding a sprite never stops its simulation. */
export class StationView {
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private positions = new Map<
    string,
    { x: number; y: number; previousX: number; previousY: number }
  >();
  private lastTick = -1;
  private siteImages = new Map<string, Phaser.GameObjects.Image>();
  private pumps: Phaser.GameObjects.Image[] = [];
  private canopies: Phaser.GameObjects.Image[] = [];
  private lighting: StationLighting;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private effects: Phaser.GameObjects.Graphics;
  private doors: Phaser.GameObjects.Rectangle[] = [];
  private grounds: Phaser.GameObjects.Graphics;
  private developments: Phaser.GameObjects.Graphics;
  private tenantSign: Phaser.GameObjects.Image;
  private shopLabel: Phaser.GameObjects.Text;
  private priceLabels: Phaser.GameObjects.Text[] = [];
  private trees: { x: number; y: number; image: Phaser.GameObjects.Image }[] =
    [];
  private roadRevision = -1;
  constructor(
    private scene: Phaser.Scene,
    private model: StationModel,
  ) {
    this.lighting = new StationLighting(scene, model);
    const g = scene.add.graphics().setDepth(2);
    this.grounds = scene.add.graphics().setDepth(3);
    this.developments = scene.add.graphics().setDepth(16);
    this.objects.push(this.grounds, this.developments);
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
    this.shopLabel = text(118 * TILE, 106 * TILE + 8, 'O R L A R', 16);
    this.tenantSign = scene.add
      .image(SHOP.x * TILE, SHOP.y * TILE, 'skoczka')
      .setOrigin(0)
      .setDepth(11)
      .setVisible(false);
    this.objects.push(this.tenantSign);
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
      const canopy = scene.add
        .image((p.x - 2) * TILE, (p.y - 1) * TILE, 'canopy')
        .setOrigin(0.5, 1)
        .setDepth(15);
      this.canopies.push(canopy);
      this.objects.push(canopy);
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
    this.priceLabels.push(text(99 * TILE + 7, 139 * TILE + 29, 'E95 6.00', 8));
    this.priceLabels.push(text(99 * TILE + 7, 139 * TILE + 46, 'ON  5.80', 8));
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
        const tree = scene.add
          .image(q.x * TILE, q.y * TILE, 'tree')
          .setOrigin(0.5, 0.8)
          .setDepth(5)
          .setFlipX(x % 3 === 0);
        this.objects.push(tree);
        this.trees.push({ ...q, image: tree });
      }
    this.effects = scene.add.graphics().setDepth(80);
    this.objects.push(this.effects);
    for (const p of LAMPS)
      this.objects.push(
        scene.add
          .image(p.x * TILE, p.y * TILE, 'lamp')
          .setOrigin(0.5, 0.9)
          .setDepth(32),
      );
  }
  draw(selection: string, build: boolean, project: BuildRequest | null = null) {
    const { scene, model } = this,
      s = model.state,
      g = this.effects;
    g.clear();
    this.drawDevelopment(project);
    const present = new Set<string>();
    for (const m of bodies(s)) {
      present.add(m.id);
      const customer = s.customers.find((c) => c.id === m.id),
        worker = s.workers.find((w) => w.motion.id === m.id);
      const texture =
        m.kind === 'car'
          ? 'cars'
          : m.kind === 'van'
            ? 'van'
            : m.kind === 'truck'
              ? customer
                ? customer.journey?.bus
                  ? 'bus'
                  : 'freight'
                : 'truck'
              : 'people';
      const turning = m.turn ? this.turnFrame(m) : m.heading * 2;
      const phase = m.route.length ? Math.floor(s.tick / 4) % 4 : 0;
      const frame =
        m.kind === 'car' || m.kind === 'van'
          ? (customer?.color ?? 0) * 16 +
            turning * 2 +
            Number(!!m.turn || m.blocked > 0)
          : m.kind === 'truck'
            ? turning
            : (worker ? 0 : m.id.startsWith('tenant-') ? 1 : 2) * 16 +
              phase * 4 +
              m.heading;
      let img = this.sprites.get(m.id);
      if (!img) {
        img = scene.add
          .image(0, 0, texture, frame)
          .setOrigin(0.5, m.kind === 'person' ? 0.85 : 0.5);
        this.sprites.set(m.id, img);
      }
      const x = (m.x / UNIT) * TILE,
        y = (m.y / UNIT) * TILE;
      if (customer?.driver) {
        const side = m.kind === 'truck' ? 29 : 12;
        g.lineStyle(3, 0x3b676b).lineBetween(
          x + side,
          y - 5,
          x + side + 10,
          y + 2,
        );
        g.lineStyle(2, 0xc2d5bd).lineBetween(
          x + side,
          y - 5,
          x + side + 7,
          y - 1,
        );
      }
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
          const p = model.pumps[customer.pump];
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
    for (let i = s.pumps.length; i < this.pumps.length; i++)
      this.pumps[i].setVisible(false);
    s.pumps.forEach((p, i) => {
      if (i < 3) this.canopies[i].setVisible(p.built);
      const site = model.pumps[i],
        extension = extraPump(s, i);
      if (!this.pumps[i]) {
        const p = island(extension!)!;
        this.pumps[i] = scene.add
          .image(p.x * TILE, (p.y + 1) * TILE, 'pump', 0)
          .setOrigin(0.45, 0.8)
          .setDepth(30)
          .setAngle(extension!.rotation * 90);
        this.objects.push(this.pumps[i]);
      }
      if (extension) {
        const a = island(extension)!;
        this.pumps[i]
          .setPosition(a.x * TILE, (a.y + 1) * TILE)
          .setAngle(extension.rotation * 90);
      }
      this.pumps[i]
        .setVisible(p.built)
        .setFrame(
          p.open && pumpWorking(s, i)
            ? s.customers.some((c) => c.pump === i && c.phase === 'fueling')
              ? Math.floor(s.tick / 5) % 4
              : 1
            : 0,
        )
        .setAlpha(p.open ? 1 : 0.55);
      if (!pumpWorking(s, i)) {
        g.fillStyle(s.tick % 20 < 10 ? 0xe88a59 : 0x6b4945).fillRect(
          (site.x - 4) * TILE,
          (site.y - 3) * TILE,
          18,
          18,
        );
        g.lineStyle(3, 0xffe6a0).lineBetween(
          (site.x - 4) * TILE + 5,
          (site.y - 3) * TILE + 4,
          (site.x - 4) * TILE + 13,
          (site.y - 3) * TILE + 14,
        );
      }
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
    if (activeEvent(s, 'rain')) {
      const camera = scene.cameras.main,
        origin = camera.getWorldPoint(0, 0),
        width = camera.width / camera.zoom,
        height = camera.height / camera.zoom;
      g.lineStyle(1 / camera.zoom, 0xaacac8, 0.65);
      for (let i = 0; i < 80; i++) {
        const x = origin.x + ((i * 157 + s.tick * 2) % width),
          y = origin.y + ((i * 83 + s.tick * 5) % height);
        g.lineBetween(
          Math.round(x),
          Math.round(y),
          Math.round(x - 3),
          Math.round(y + 9),
        );
      }
    }
    if (s.delivery?.phase === 'unloading')
      g.lineStyle(4, 0x30494a).lineBetween(
        139 * TILE,
        110 * TILE,
        144 * TILE,
        110 * TILE,
      );
    this.lighting.draw();
  }
  private drawDevelopment(project: BuildRequest | null) {
    const s = this.model.state,
      d = s.development,
      g = this.developments;
    g.clear();
    this.tenantSign.setVisible(
      d?.tenant.phase === 'leased' || d?.tenant.phase === 'returning',
    );
    this.shopLabel
      .setText(this.tenantSign.visible ? 'SKOCZKA' : 'O R L A R')
      .setColor(this.tenantSign.visible ? '#e8dca5' : '#f4e6bd');
    if (!d) return;
    this.priceLabels.forEach((p, i) =>
      p.setText(
        `${i ? 'ON ' : 'E95'} ${(d.prices[i ? 'on' : 'e95'] / 100).toFixed(2)}`,
      ),
    );
    if (this.roadRevision !== s.topology) {
      const ground = this.grounds;
      ground.clear();
      this.roadRevision = s.topology;
      for (const road of d.roads) {
        const r = roadBounds(road);
        ground
          .fillStyle(0x8e9f98)
          .fillRect(r.x * TILE, r.y * TILE, r.width * TILE, r.height * TILE);
        ground
          .lineStyle(2, 0xd3ccb2)
          .strokeRect(
            r.x * TILE + 2,
            r.y * TILE + 2,
            r.width * TILE - 4,
            r.height * TILE - 4,
          );
        const dx = Math.sign(road.to.x - road.from.x),
          dy = Math.sign(road.to.y - road.from.y);
        for (
          let n = 4;
          n <
          Math.abs(road.to.x - road.from.x) + Math.abs(road.to.y - road.from.y);
          n += 8
        ) {
          const x = (road.from.x + dx * n) * TILE,
            y = (road.from.y + dy * n) * TILE;
          ground
            .lineStyle(3, 0xe7dec1)
            .lineBetween(x - dx * 12, y - dy * 12, x + dx * 12, y + dy * 12);
          ground
            .lineBetween(x + dx * 12, y + dy * 12, x - dy * 7, y + dx * 7)
            .lineBetween(x + dx * 12, y + dy * 12, x + dy * 7, y - dx * 7);
        }
      }
      for (const tree of this.trees)
        tree.image.setVisible(
          !PARCELS.some(
            (p) =>
              p.id !== 'start' && d.parcels.includes(p.id) && inside(tree, p),
          ),
        );
    }
    const activeSites = new Set(d.sites.map((p) => p.id));
    for (const [id, img] of this.siteImages)
      if (!activeSites.has(id)) {
        img.destroy();
        this.siteImages.delete(id);
      }
    for (const p of d.sites) {
      const r = siteBounds(p);
      if (p.kind === 'wash' && !p.progress) {
        let image = this.siteImages.get(p.id);
        if (!image) {
          image = this.scene.add
            .image(p.point.x * TILE, p.point.y * TILE, 'wash')
            .setAngle(p.rotation * 90)
            .setDepth(17);
          this.siteImages.set(p.id, image);
        }
        const w = s.campaign?.wash;
        const car = s.customers.find((c) => c.id === w?.customer);
        if (car?.phase === 'washing') {
          const f = this.effects,
            x = p.point.x * TILE,
            y = p.point.y * TILE;
          const t = w!.progress / 500;
          f.fillStyle(0xc8f0de, 0.75);
          for (let i = 0; i < 24; i++) {
            const a = ((i * 17 + Math.floor(s.tick / 3) * 7) % 49) - 24;
            const b = ((i * 29 + Math.floor(s.tick / 4) * 5) % 57) - 28;
            f.fillRect(x + a, y + b, 5 + (i % 3), 4);
          }
          f.fillStyle(0x243c42)
            .fillRect(x - 34, y + 46, 68, 5)
            .fillStyle(0x6bd2a9)
            .fillRect(x - 34, y + 46, 68 * t, 5);
          for (const side of [-1, 1]) {
            const bx = x + side * (25 + 4 * Math.sin(s.tick / 6));
            f.fillStyle(0x447c94).fillRect(Math.round(bx), y - 23, 12, 48);
            for (let n = 0; n < 10; n++)
              f.fillStyle(n % 2 ? 0x7cc6bf : 0xabcfc2).fillRect(
                Math.round(bx) - 3,
                y - 21 + n * 5,
                17,
                2,
              );
          }
        }
      } else if (p.kind === 'parking') {
        g.lineStyle(2, 0xf0e2b9).strokeRect(
          (p.point.x - 3) * TILE,
          (p.point.y - 4) * TILE,
          6 * TILE,
          8 * TILE,
        );
        g.lineBetween(
          (p.point.x - 2) * TILE,
          (p.point.y - 4) * TILE,
          (p.point.x + 2) * TILE,
          (p.point.y - 4) * TILE,
        );
      } else if (p.kind === 'tank') {
        g.fillStyle(0x354f51).fillRoundedRect(
          r.x * TILE,
          r.y * TILE,
          r.width * TILE,
          r.height * TILE,
          12,
        );
        g.fillStyle(0xa8bbb0).fillRoundedRect(
          r.x * TILE + 5,
          r.y * TILE + 5,
          r.width * TILE - 10,
          r.height * TILE - 16,
          10,
        );
        g.fillStyle(p.fuel === 'e95' ? 0x48aa9a : 0xefb851).fillRect(
          r.x * TILE + 8,
          (r.y + 2) * TILE,
          r.width * TILE - 16,
          12,
        );
        g.fillStyle(0xe7dec1).fillCircle(
          p.point.x * TILE,
          (p.point.y - 1) * TILE,
          10,
        );
      }
      if (p.progress) {
        g.lineStyle(3, 0xefb851).strokeRect(
          r.x * TILE,
          r.y * TILE,
          r.width * TILE,
          r.height * TILE,
        );
        for (let x = r.x; x < r.x + r.width; x += 2)
          g.fillStyle(0xefb851).fillTriangle(
            x * TILE,
            r.y * TILE,
            (x + 1) * TILE,
            r.y * TILE,
            (x + 0.5) * TILE,
            (r.y - 1) * TILE,
          );
        g.fillStyle(0x48aa9a).fillRect(
          r.x * TILE,
          (r.y + r.height) * TILE,
          r.width * TILE * (1 - p.progress / 300),
          4,
        );
      }
    }
    if (d.secondCheckout)
      g.fillStyle(0xdeb874).fillRect(128 * TILE - 16, 112 * TILE - 12, 32, 12);
    if (['closing', 'refitting', 'restoring'].includes(d.tenant.phase)) {
      g.fillStyle(0x755b63, 0.8).fillRect(
        SHOP.x * TILE,
        SHOP.y * TILE,
        SHOP.width * TILE,
        32,
      );
      for (let x = SHOP.x; x < SHOP.x + SHOP.width; x += 2)
        g.fillStyle(0xefb851).fillRect(x * TILE, SHOP.y * TILE, 16, 6);
    }
    if (project) {
      for (const p of PARCELS)
        g.lineStyle(
          2,
          d.parcels.includes(p.id) ? 0x77cca5 : 0xd4a273,
          0.8,
        ).strokeRect(p.x * TILE, p.y * TILE, p.width * TILE, p.height * TILE);
      for (const [p, color] of [
        [ENTRY, 0x77cca5],
        [EXIT, 0xefb851],
      ] as const)
        g.lineStyle(4, color).strokeCircle(p.x * TILE, p.y * TILE, 20);
      const plan = this.model.previewBuild(project),
        r = plan.bounds,
        c = plan.valid ? 0x73d5ad : 0xd8766c;
      g.fillStyle(c, 0.2)
        .fillRect(r.x * TILE, r.y * TILE, r.width * TILE, r.height * TILE)
        .lineStyle(3, c)
        .strokeRect(r.x * TILE, r.y * TILE, r.width * TILE, r.height * TILE);
      const dx = [0, -1, 0, 1][project.rotation],
        dy = [-1, 0, 1, 0][project.rotation],
        x = project.point.x * TILE,
        y = project.point.y * TILE;
      g.lineBetween(x, y, x + dx * 26, y + dy * 26);
    }
  }
  private turnFrame(m: Motion) {
    const delta = (m.nextHeading - m.heading + 4) % 4,
      mid = (m.heading * 2 + (delta === 3 ? -1 : 1) + 8) % 8;
    return m.turn > (m.kind === 'truck' ? 8 : 4) ? m.heading * 2 : mid;
  }
  destroy() {
    this.lighting.destroy();
    this.objects.forEach((o) => o.destroy());
    this.siteImages.forEach((o) => o.destroy());
    this.sprites.forEach((o) => o.destroy());
    this.labels.forEach((o) => o.destroy());
  }
}
