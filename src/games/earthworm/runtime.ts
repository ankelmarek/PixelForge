import Phaser from 'phaser';
import {
  createFlowScenes,
  VersionedSave,
  MutableTerrainRenderer,
  cameraView,
  pixelAlignedScroll,
  type ClientDefinition,
  type ClientContext,
  type ClientRuntime,
  type ClientCommand,
} from '../../engine/api';
import { WormModel, TILE, CAPACITY } from './model';
import { validateWorld } from './world';

const phases = {
  dew: { icon: '◒', label: 'Poranna rosa' },
  sun: { icon: '☀', label: 'Susza' },
  rain: { icon: '☂', label: 'Deszcz' },
  dusk: { icon: '☾', label: 'Wieczór' },
};
export function createEarthwormRuntime(
  definition: ClientDefinition,
  context: ClientContext,
  data: unknown,
): ClientRuntime {
  const world = validateWorld(data),
    model = new WormModel(world);
  const save = new VersionedSave(definition.id, 1, (value) =>
    model.validateSave(value),
  );
  let started = false,
    lastSave = 0,
    active: Gameplay | undefined;
  const persist = () => {
    if (!started) return true;
    lastSave = model.state.seconds;
    const ok = save.write(model.snapshot());
    if (!ok) context.message('Zapis lokalny jest niedostępny.');
    return ok;
  };
  class Gameplay extends Phaser.Scene {
    private terrain!: MutableTerrainRenderer;
    private sprites = new Map<string, Phaser.GameObjects.Sprite>();
    private body: Phaser.GameObjects.Sprite[] = [];
    private effects!: Phaser.GameObjects.Graphics;
    private emitted = 0;
    private follow = true;
    private drag?: {
      x: number;
      y: number;
      scrollX: number;
      scrollY: number;
      pan: boolean;
    };
    private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    private trail: { x: number; y: number }[] = [];
    private trailAt = -1;
    constructor() {
      super('Gameplay');
    }
    create() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      active = this;
      this.sprites.clear();
      this.body = [];
      this.drag = undefined;
      this.follow = true;
      this.emitted = 0;
      this.trailAt = -1;
      const soil = this.textures
        .get('soil')
        .getSourceImage() as HTMLImageElement;
      this.terrain = new MutableTerrainRenderer(
        this,
        model.terrain,
        (ctx, value, x, y, lx, ly) => {
          const variant = ((x * 31) ^ (y * 17)) & 3;
          ctx.drawImage(
            soil,
            ((value === 2 ? 8 : value === 1 ? 4 : 0) + variant) * TILE,
            0,
            TILE,
            TILE,
            lx,
            ly,
            TILE,
            TILE,
          );
          if (value === 1) {
            ctx.fillStyle = '#8c6b55';
            if (model.terrain.get(x, y - 1) === 0)
              ctx.fillRect(lx, ly, TILE, 1);
            if (model.terrain.get(x - 1, y) === 0)
              ctx.fillRect(lx, ly, 1, TILE);
          }
        },
      );
      const c = this.cameras.main;
      c.setBounds(0, 0, world.width, world.height)
        .setZoom(this.defaultZoom())
        .setBackgroundColor('#584547');
      this.body = model.segments.map((_, i) =>
        this.add
          .sprite(0, 0, 'creatures', i === 0 ? 0 : i === 14 ? 2 : 1)
          .setScale(i === 0 ? 0.7 : 0.56)
          .setDepth(200 - i),
      );
      this.effects = this.add.graphics().setDepth(300);
      const down = (p: Phaser.Input.Pointer) => {
        this.game.canvas.focus({ preventScroll: true });
        if (model.state.completed || model.state.failed) return;
        this.drag = {
          x: p.x,
          y: p.y,
          scrollX: c.scrollX,
          scrollY: c.scrollY,
          pan: p.rightButtonDown() || p.middleButtonDown(),
        };
        if (this.drag.pan) {
          this.follow = false;
          return;
        }
        const point = c.getWorldPoint(p.x, p.y);
        if (Math.hypot(point.x - model.state.x, point.y - model.state.y) < 14)
          model.toggleHide();
        else {
          model.steer(point.x, point.y);
          this.follow = true;
        }
      };
      const move = (p: Phaser.Input.Pointer) => {
        if (
          !this.drag ||
          !p.isDown ||
          model.state.completed ||
          model.state.failed
        )
          return;
        if (this.drag.pan) {
          c.setScroll(
            this.drag.scrollX - (p.x - this.drag.x) / c.zoom,
            this.drag.scrollY - (p.y - this.drag.y) / c.zoom,
          );
          this.align();
        } else {
          const point = c.getWorldPoint(p.x, p.y);
          model.steer(point.x, point.y);
        }
      };
      const up = () => {
        this.drag = undefined;
      };
      const wheel = (
        _p: Phaser.Input.Pointer,
        _over: unknown,
        _dx: number,
        dy: number,
      ) => this.command({ type: 'zoom', direction: dy > 0 ? -1 : 1 });
      const prevent = (e: Event) => e.preventDefault();
      this.game.canvas.addEventListener('contextmenu', prevent);
      this.game.canvas.addEventListener('wheel', prevent, { passive: false });
      this.input.on('pointerdown', down);
      this.input.on('pointermove', move);
      this.input.on('pointerup', up);
      this.input.on('pointerupoutside', up);
      this.input.on('gameout', up);
      this.input.on('wheel', wheel);
      this.events.on(Phaser.Scenes.Events.PAUSE, up);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.game.canvas.removeEventListener('contextmenu', prevent);
        this.game.canvas.removeEventListener('wheel', prevent);
        this.input.off('pointerdown', down);
        this.input.off('pointermove', move);
        this.input.off('pointerup', up);
        this.input.off('pointerupoutside', up);
        this.input.off('gameout', up);
        this.input.off('wheel', wheel);
        this.events.off(Phaser.Scenes.Events.PAUSE, up);
        this.terrain.destroy();
        this.sprites.clear();
        active = undefined;
      });
      this.render();
      this.emit();
    }
    private defaultZoom() {
      return matchMedia('(pointer: coarse)').matches ? 1.5 : 1;
    }
    private align() {
      const c = this.cameras.main;
      c.setScroll(
        pixelAlignedScroll(c.scrollX, c.width, world.width, c.zoom),
        pixelAlignedScroll(c.scrollY, c.height, world.height, c.zoom),
      );
    }
    command(command: ClientCommand) {
      const c = this.cameras.main;
      if (command.type === 'interact') model.toggleHide();
      if (command.type === 'focus') {
        this.follow = !command.point;
        const p = command.point ?? model.state;
        c.centerOn(p.x, p.y);
      }
      if (command.type === 'zoom') {
        const center = c.getWorldPoint(c.width / 2, c.height / 2);
        c.setZoom(
          command.direction === 0
            ? this.defaultZoom()
            : Phaser.Math.Clamp(
                c.zoom * (command.direction > 0 ? 1.2 : 1 / 1.2),
                0.5,
                2,
              ),
        );
        c.centerOn(center.x, center.y);
      }
      this.align();
      this.render();
      this.emit();
    }
    update(_time: number, delta: number) {
      const input = context.input;
      if (input.consume('interact')) model.toggleHide();
      const direction = {
        x: Number(input.down('right')) - Number(input.down('left')),
        y: Number(input.down('down')) - Number(input.down('up')),
      };
      if (direction.x || direction.y) this.follow = true;
      model.tick(delta / 1000, direction);
      const events = model.events.splice(0);
      for (const event of events) context.audio.play(event);
      if (events.length || model.state.seconds - lastSave >= 10) persist();
      this.render();
      this.emitted += delta;
      if (this.emitted >= 100 || events.length) {
        this.emitted = 0;
        this.emit();
      }
    }
    private render() {
      const c = this.cameras.main,
        s = model.state;
      if (this.follow) c.centerOn(s.x, s.y);
      this.align();
      const view = cameraView(c),
        wanted = new Set<string>();
      this.terrain.update(view);
      const visible = (x: number, y: number, margin = 90) =>
        x > view.x - margin &&
        y > view.y - margin &&
        x < view.x + view.width + margin &&
        y < view.y + view.height + margin;
      const sprite = (
        id: string,
        x: number,
        y: number,
        texture: string,
        frame: number,
        depth: number,
        alpha = 1,
      ) => {
        if (!visible(x, y)) return;
        wanted.add(id);
        let image = this.sprites.get(id);
        if (!image) {
          image = this.add.sprite(x, y, texture, frame);
          this.sprites.set(id, image);
        }
        image
          .setPosition(Math.round(x), Math.round(y))
          .setFrame(frame)
          .setDepth(depth)
          .setAlpha(alpha);
        return image;
      };
      for (const [i, p] of world.pools.entries()) {
        const image = sprite(`pool-${i}`, p.x, p.y, 'pool', 0, -10);
        image?.setScale(p.radius / 48);
      }
      for (
        let y = Math.max(0, Math.floor(view.y / 128) - 1);
        y <
        Math.min(
          world.height / 128,
          Math.ceil((view.y + view.height) / 128) + 1,
        );
        y++
      )
        for (
          let x = Math.max(0, Math.floor(view.x / 128) - 1);
          x <
          Math.min(
            world.width / 128,
            Math.ceil((view.x + view.width) / 128) + 1,
          );
          x++
        ) {
          const hash = (x * 71 + y * 149) % 97,
            px = x * 128 + hash,
            py = y * 128 + ((hash * 31) % 100);
          if (
            model.terrain.get(Math.floor(px / TILE), Math.floor(py / TILE)) ===
              0 &&
            !world.roots.some((r) => Math.hypot(r.x - px, r.y - py) < 60) &&
            !world.pools.some(
              (p) => Math.hypot(p.x - px, p.y - py) < p.radius + 20,
            )
          )
            sprite(
              `decor-${x}-${y}`,
              px,
              py,
              'creatures',
              [5, 6, 7, 10][hash % 4],
              -5,
              0.7,
            );
        }
      const g = this.effects;
      g.clear();
      for (const [i, root] of world.roots.entries()) {
        const done = s.roots[i] === root.need;
        sprite(
          root.id,
          root.x,
          root.y - 15,
          'plants',
          root.garden * 2 + Number(done),
          root.y > s.y + 10 ? 210 : 10,
        );
        if (!visible(root.x, root.y)) continue;
        if (done) {
          g.lineStyle(1, 0xa9c985, 0.25);
          g.strokeCircle(root.x, root.y, 36);
        } else {
          for (let n = 0; n < root.need; n++) {
            g.fillStyle(n < s.roots[i] ? 0xbacf85 : 0x302c35);
            g.fillCircle(
              root.x + (n - (root.need - 1) / 2) * 8,
              root.y + 25,
              3,
            );
            g.lineStyle(1, 0xc2aa80);
            g.strokeCircle(
              root.x + (n - (root.need - 1) / 2) * 8,
              root.y + 25,
              3,
            );
          }
          if (Math.hypot(root.x - s.x, root.y - s.y) < 70 && s.nutrients > 0) {
            g.lineStyle(1, s.hydration >= 25 ? 0xe2ca8f : 0x76b9bf, 0.6);
            g.strokeCircle(
              root.x,
              root.y,
              30 + (this.reduced ? 0 : Math.sin(s.seconds * 4) * 2),
            );
          }
        }
      }
      for (const [i, f] of world.food.entries())
        if (!s.food[i]) {
          const image = sprite(
            f.id,
            f.x,
            f.y + (this.reduced ? 0 : Math.sin(s.seconds * 2 + i) * 1.5),
            'creatures',
            3,
            12,
          );
          image?.setScale(0.85);
        }
      for (const [i, p] of s.predators.entries()) {
        sprite(`mole-${i}`, p.x, p.y, 'creatures', 4, 180);
        if (p.alert > 0 && visible(p.x, p.y)) {
          g.lineStyle(1, 0xeaa087, p.alert * 0.7);
          g.strokeCircle(p.x, p.y, 24 + p.alert * 8);
          g.fillStyle(0xffc398);
          g.fillRect(p.x - 1, p.y - 27, 2, 6);
          g.fillRect(p.x - 1, p.y - 19, 2, 2);
        }
      }
      for (const [id, image] of this.sprites)
        if (!wanted.has(id)) {
          image.destroy();
          this.sprites.delete(id);
        }
      for (const [i, b] of this.body.entries()) {
        const p = model.segments[i],
          previous = model.segments[Math.max(0, i - 1)];
        const coil = s.hiding
          ? {
              x: s.x + Math.cos(i * 0.6) * i * 0.65,
              y: s.y + Math.sin(i * 0.6) * i * 0.65,
            }
          : p;
        b.setPosition(Math.round(coil.x), Math.round(coil.y)).setRotation(
          i === 0 ? s.heading : Math.atan2(previous.y - p.y, previous.x - p.x),
        );
        b.setAlpha(s.invulnerable > 0 ? 0.55 : 1);
        b.setTint(
          s.hydration < 20
            ? 0xdbb07b
            : i === 4 || i === 5
              ? 0xffd2b0
              : 0xffffff,
        );
      }
      if (model.target && visible(model.target.x, model.target.y)) {
        g.lineStyle(1, 0xe5caa0, 0.7);
        g.strokeCircle(model.target.x, model.target.y, 6);
        g.fillStyle(0xe5caa0, 0.7);
        g.fillRect(model.target.x - 1, model.target.y - 1, 2, 2);
      }
      if (model.weather === 'rain' && !this.reduced) {
        g.lineStyle(1, 0x87bec3, 0.25);
        for (let i = 0; i < 24; i++) {
          const x = view.x + ((i * 91 + s.seconds * 11) % view.width),
            y = view.y + ((i * 43 + s.seconds * 83) % view.height);
          g.lineBetween(x, y, x - 2, y + 5);
        }
      }
      // Edge flowers guide exploration without words, also when the next garden is distant.
      const next = world.roots.find((r, i) => s.roots[i] < r.need);
      if (next && !visible(next.x, next.y, 0)) {
        const cx = view.x + view.width / 2,
          cy = view.y + view.height / 2,
          dx = next.x - cx,
          dy = next.y - cy;
        const factor = Math.min(
          (view.width / 2 - 26) / Math.abs(dx || 1),
          (view.height / 2 - 30) / Math.abs(dy || 1),
        );
        const x = cx + dx * factor,
          y = cy + dy * factor;
        g.fillStyle(0x302c35, 0.85);
        g.fillCircle(x, y, 9);
        g.fillStyle(0xc6c685);
        g.fillCircle(x - 3, y, 3);
        g.fillCircle(x + 3, y, 3);
        g.fillCircle(x, y - 3, 3);
        g.fillCircle(x, y + 3, 3);
        g.fillStyle(0xf1d2a0);
        g.fillCircle(x, y, 2);
      }
    }
    private emit() {
      const s = model.state,
        c = this.cameras.main;
      if (Math.floor(s.seconds) !== this.trailAt) {
        this.trailAt = Math.floor(s.seconds);
        const edits = model.terrain.snapshot(),
          stride = Math.max(1, Math.ceil(edits.length / 3000));
        this.trail = edits
          .filter((_, i) => i % stride === 0)
          .map(([i]) => ({
            x: (i % model.terrain.columns) * TILE,
            y: Math.floor(i / model.terrain.columns) * TILE,
          }));
      }
      context.state({
        mode: 'client',
        x: s.x,
        y: s.y,
        completed: s.completed,
        failed: s.failed,
        paused: false,
        collected: model.blooms,
        total: world.roots.length,
        elapsed: s.seconds,
        lives: s.lives,
        activated: s.hiding,
        checkpoint: s.checkpoint < 0 ? null : world.roots[s.checkpoint].id,
        meters: [
          {
            id: 'water',
            icon: '◆',
            label: 'Wilgoć',
            value: s.hydration,
            max: 100,
            color: '#8cc6ca',
          },
          {
            id: 'food',
            icon: '❧',
            label: 'Pokarm',
            value: s.nutrients,
            max: CAPACITY,
            color: '#d8be7e',
          },
          {
            id: 'life',
            icon: '♥',
            label: 'Życia',
            value: s.lives,
            max: 3,
            color: '#e9a4ac',
          },
        ],
        phase: phases[model.weather],
        camera: {
          scrollX: c.scrollX,
          scrollY: c.scrollY,
          width: c.width,
          height: c.height,
          zoom: c.zoom,
        },
        map: {
          width: world.width,
          height: world.height,
          trail: this.trail,
          markers: [
            ...world.pools.map((p) => ({ ...p, icon: '·', color: '#74b1b6' })),
            ...world.roots.map((r, i) => ({
              ...r,
              icon: s.roots[i] === r.need ? '✿' : '◇',
              color: s.roots[i] === r.need ? '#b8ce86' : '#e9c995',
            })),
          ],
        },
        stats: {
          ...this.terrain.stats,
          tunnels: model.terrain.count,
          hydration: s.hydration,
          nutrients: s.nutrients,
          weather: model.weather,
          rootProgress: s.roots.join(','),
          hiding: s.hiding,
        },
      });
    }
  }
  return {
    scenes: [
      ...createFlowScenes(definition, context.ready, context.error),
      Gameplay,
    ],
    start(resume) {
      const stored = resume ? save.read() : undefined;
      if (stored) model.restore(stored);
      else model.reset();
      started = true;
      lastSave = model.state.seconds;
    },
    persist,
    command(command) {
      active?.command(command);
    },
  };
}
