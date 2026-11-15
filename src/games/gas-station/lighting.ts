import Phaser from 'phaser';
import type { StationModel } from './model';
import { darkness } from './scenarios';
import { activeEvent } from './campaign-data';
import { bodies } from './state';
import { TILE } from './world';

export const LAMPS = [
  { x: 98, y: 115 },
  { x: 153, y: 120 },
  { x: 100, y: 149 },
  { x: 151, y: 149 },
];

/** Viewport-sized shade and bounded pixel light pools, never a world-size texture. */
export class StationLighting {
  private shade: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Graphics;
  private wet: Phaser.GameObjects.Graphics;
  private pools: Phaser.GameObjects.Image[] = [];
  private beams: Phaser.GameObjects.Image[] = [];
  constructor(
    private scene: Phaser.Scene,
    private model: StationModel,
  ) {
    this.shade = scene.add.graphics().setDepth(40);
    this.glow = scene.add
      .graphics()
      .setDepth(41)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.wet = scene.add.graphics().setDepth(4);
  }
  draw() {
    const s = this.model.state,
      camera = this.scene.cameras.main,
      origin = camera.getWorldPoint(0, 0),
      width = camera.width / camera.zoom,
      height = camera.height / camera.zoom;
    const dark = darkness(s),
      glow = this.glow;
    this.shade.clear();
    glow.clear();
    this.wet.clear();
    if (
      activeEvent(s, 'rain') ||
      s.campaign?.history.some(
        (e) => e.kind === 'rain' && s.tick - e.end < 1200,
      )
    ) {
      for (let i = 0; i < 12; i++) {
        const x = (102 + i * 4) * TILE,
          y = (131 + (i % 3) * 9) * TILE;
        this.wet
          .fillStyle(0x85b7b9, 0.2)
          .fillRect(x, y, 44, 8)
          .fillRect(x + 6, y - 3, 28, 14);
        this.wet.fillStyle(0xc4ded3, 0.3).fillRect(x + 8, y + 2, 20, 2);
      }
    }
    let pools = 0,
      beams = 0;
    const mask = (
      images: Phaser.GameObjects.Image[],
      index: number,
      texture: string,
    ) => {
      if (!images[index])
        images[index] = this.scene.add
          .image(0, 0, texture)
          .setDepth(41)
          .setBlendMode(Phaser.BlendModes.ADD);
      return images[index].setVisible(true).setAlpha(dark);
    };
    if (!dark) {
      for (const img of [...this.pools, ...this.beams]) img.setVisible(false);
      return;
    }
    this.shade
      .fillStyle(0x121f39, dark * 0.65)
      .fillRect(
        Math.floor(origin.x) - 2,
        Math.floor(origin.y) - 2,
        Math.ceil(width) + 4,
        Math.ceil(height) + 4,
      );
    const pool = (x: number, y: number, radius: number, color = 0xe9bf75) => {
      if (
        x + radius < origin.x ||
        x - radius > origin.x + width ||
        y + radius < origin.y ||
        y - radius > origin.y + height
      )
        return;
      mask(this.pools, pools++, 'light-pool')
        .setPosition(x, y)
        .setTint(color)
        .setDisplaySize(radius * 2, radius * 1.5);
    };
    // The shop keeps a low safety glow even when paid forecourt lights are off.
    pool(124 * TILE, 112 * TILE, 90, 0x80c6b5);
    if (s.campaign?.scenario?.lights) {
      for (const p of LAMPS) pool(p.x * TILE, p.y * TILE, 150);
      for (const [i, p] of this.model.pumps.entries())
        if (s.pumps[i].built) pool((p.x - 3) * TILE, p.y * TILE - 18, 100);
      for (const p of s.development?.sites ?? [])
        if (p.kind === 'wash' && !p.progress)
          pool(p.point.x * TILE, p.point.y * TILE, 140, 0x81d6c2);
      glow
        .fillStyle(0xf6d986, dark * 0.18)
        .fillRect(113 * TILE, 109 * TILE, 20 * TILE, 4 * TILE);
    }
    for (const m of bodies(s)) {
      if (m.kind === 'person') continue;
      const x = Math.round(m.x / 16),
        y = Math.round(m.y / 16);
      if (
        x < origin.x - 150 ||
        x > origin.x + width + 150 ||
        y < origin.y - 150 ||
        y > origin.y + height + 150
      )
        continue;
      const turn = ((m.nextHeading - m.heading + 6) % 4) - 2;
      const angle =
        ((m.heading + (m.turn ? turn * (1 - m.turn / 6) : 0)) * Math.PI) / 2;
      const dx = Math.cos(angle),
        dy = Math.sin(angle),
        nose = m.kind === 'truck' ? 43 : 23;
      const sx = x + dx * nose,
        sy = y + dy * nose;
      mask(this.beams, beams++, 'headlight')
        .setOrigin(0, 0.5)
        .setPosition(sx, sy)
        .setRotation(angle)
        .setTint(0xf7e4a3);
      glow.fillStyle(0xfbeec7, dark * 0.7);
      for (const side of [-1, 1])
        glow.fillRect(
          Math.round(sx - dy * side * 7) - 2,
          Math.round(sy + dx * side * 7) - 2,
          4,
          4,
        );
    }
    for (let i = pools; i < this.pools.length; i++)
      this.pools[i].setVisible(false);
    for (let i = beams; i < this.beams.length; i++)
      this.beams[i].setVisible(false);
  }
  destroy() {
    this.shade.destroy();
    this.glow.destroy();
    this.wet.destroy();
    for (const img of [...this.pools, ...this.beams]) img.destroy();
  }
}
