import Phaser from 'phaser';
import type { SimulationLevel } from './types';
export class PointerInputService {
  private down?: {
    x: number;
    y: number;
    scrollX: number;
    scrollY: number;
    pan: boolean;
    dragged: boolean;
  };
  private dispose: (() => void)[] = [];
  constructor(
    private scene: Phaser.Scene,
    private level: SimulationLevel,
    hit: (x: number, y: number) => string | null,
    click: (id: string | null) => void,
    hover: (id: string | null) => void,
  ) {
    const camera = scene.cameras.main;
    const start = (p: Phaser.Input.Pointer) => {
      scene.game.canvas.focus({ preventScroll: true });
      if (p.rightButtonDown()) {
        click(null);
        this.down = undefined;
        return;
      }
      const world = camera.getWorldPoint(p.x, p.y);
      this.down = {
        x: p.x,
        y: p.y,
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
        pan: !hit(world.x, world.y),
        dragged: false,
      };
    };
    const move = (p: Phaser.Input.Pointer) => {
      if (this.down && p.isDown) {
        if (Math.hypot(p.x - this.down.x, p.y - this.down.y) >= 3)
          this.down.dragged = true;
        if (this.down.dragged && this.down.pan)
          camera.setScroll(
            this.down.scrollX - (p.x - this.down.x) / camera.zoom,
            this.down.scrollY - (p.y - this.down.y) / camera.zoom,
          );
      }
      this.clamp();
      const world = camera.getWorldPoint(p.x, p.y);
      hover(hit(world.x, world.y));
    };
    const end = (p: Phaser.Input.Pointer) => {
      const start = this.down;
      this.down = undefined;
      if (start && !start.dragged && p.button !== 2) {
        const world = camera.getWorldPoint(p.x, p.y);
        click(hit(world.x, world.y));
      }
    };
    const cancel = () => {
      this.down = undefined;
      hover(null);
    };
    const wheel = (
      p: Phaser.Input.Pointer,
      _over: unknown,
      _dx: number,
      dy: number,
    ) => {
      p.event?.preventDefault();
      this.zoom(dy > 0 ? -1 : 1, p.x, p.y);
    };
    const context = (event: Event) => event.preventDefault();
    let previousWidth = camera.width,
      previousHeight = camera.height;
    const resize = () => {
      cancel();
      this.focus(
        camera.scrollX + previousWidth / 2,
        camera.scrollY + previousHeight / 2,
      );
      previousWidth = camera.width;
      previousHeight = camera.height;
    };
    scene.scale.on('resize', resize);
    scene.input.on('pointerdown', start);
    scene.input.on('pointermove', move);
    scene.input.on('pointerup', end);
    scene.input.on('pointerupoutside', cancel);
    scene.input.on('gameout', cancel);
    scene.input.on('wheel', wheel);
    scene.game.canvas.addEventListener('contextmenu', context);
    this.dispose.push(() => {
      scene.scale.off('resize', resize);
      scene.input.off('pointerdown', start);
      scene.input.off('pointermove', move);
      scene.input.off('pointerup', end);
      scene.input.off('pointerupoutside', cancel);
      scene.input.off('gameout', cancel);
      scene.input.off('wheel', wheel);
      scene.game.canvas.removeEventListener('contextmenu', context);
    });
  }
  focus(x: number, y: number) {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      this.scene.cameras.main.centerOn(x, y);
      this.clamp();
    }
  }
  private clamp() {
    const c = this.scene.cameras.main,
      halfW = c.width / (2 * c.zoom),
      halfH = c.height / (2 * c.zoom);
    const x = Phaser.Math.Clamp(
      c.scrollX + c.width / 2,
      halfW,
      this.level.width * this.level.tileSize - halfW,
    );
    const y = Phaser.Math.Clamp(
      c.scrollY + c.height / 2,
      halfH,
      this.level.height * this.level.tileSize - halfH,
    );
    c.setScroll(x - c.width / 2, y - c.height / 2);
  }
  reset() {
    const camera = this.scene.cameras.main;
    camera
      .setZoom(this.level.camera.zoom)
      .centerOn(
        this.level.camera.center.x * this.level.tileSize,
        this.level.camera.center.y * this.level.tileSize,
      );
    this.clamp();
  }
  zoom(
    direction: number,
    x = this.scene.cameras.main.width / 2,
    y = this.scene.cameras.main.height / 2,
  ) {
    if (direction === 0) {
      this.reset();
      return;
    }
    const camera = this.scene.cameras.main,
      old = camera.zoom,
      next = Phaser.Math.Clamp(
        old * (direction > 0 ? 1.2 : 1 / 1.2),
        this.level.camera.minZoom,
        this.level.camera.maxZoom,
      );
    const wx = camera.scrollX + camera.width / 2 + (x - camera.width / 2) / old;
    const wy =
      camera.scrollY + camera.height / 2 + (y - camera.height / 2) / old;
    camera
      .setZoom(next)
      .setScroll(
        wx - camera.width / 2 - (x - camera.width / 2) / next,
        wy - camera.height / 2 - (y - camera.height / 2) / next,
      );
    this.clamp();
  }
  destroy() {
    this.down = undefined;
    this.dispose.forEach((dispose) => dispose());
  }
}
