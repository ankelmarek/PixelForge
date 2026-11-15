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
import { WormModel, TILE } from './model';
import { validateWorld } from './world';
import { registerSoilArt, paintGround, drawSoil } from './soil-view';
import {
  SURFACE,
  ADULT_XP,
  NEST,
  PLUG,
  BABY,
  CHAMBER,
  FUNGI,
  DEEP_NEST,
  AMBER,
} from './adventure';

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
  const save = new VersionedSave(definition.id, 3, (value) =>
    model.validateSave(value),
  );
  const previousSave = new VersionedSave(definition.id, 1, () => true);
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
    private ground!: Phaser.GameObjects.Graphics;
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
    private rewardAt = -10;
    private previousXP = 0;
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
      this.previousXP = model.experience;
      this.rewardAt = -10;
      registerSoilArt(this);
      this.terrain = new MutableTerrainRenderer(
        this,
        model.terrain,
        (ctx, value, x, y, lx, ly) => {
          paintGround(ctx, value, x, y, lx, ly);
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
          .sprite(0, 0, 'worm', i === 0 ? 0 : i === 14 ? 2 : 1)
          .setDisplaySize(i === 0 ? 23 : i === 14 ? 18 : 14, i === 0 ? 14 : 10)
          .setDepth(200 - i),
      );
      this.effects = this.add.graphics().setDepth(300);
      this.ground = this.add.graphics().setDepth(-15);
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
          model.interact();
        else {
          model.click(point.x, point.y);
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
      return matchMedia('(pointer: coarse)').matches ? 1 : 0.8;
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
      if (command.type === 'interact') model.interact();
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
      if (input.consume('interact')) model.interact();
      const direction = {
        x: Number(input.down('right')) - Number(input.down('left')),
        y: Number(input.down('down')) - Number(input.down('up')),
      };
      if (direction.x || direction.y) this.follow = true;
      model.tick(delta / 1000, direction);
      if (model.experience > this.previousXP)
        this.rewardAt = model.state.seconds;
      this.previousXP = model.experience;
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
      if (this.follow)
        c.centerOn(
          s.x,
          s.y - Math.max(0, Math.min(50, (SURFACE + 200 - s.y) / 4)),
        );
      this.align();
      const view = cameraView(c),
        wanted = new Set<string>();
      this.terrain.update(view);
      const visible = (x: number, y: number, margin = 150) =>
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
      const g = this.effects;
      g.clear();
      this.ground.clear();
      drawSoil(model, sprite, this.ground, g, view, visible, this.reduced);
      this.ground.lineStyle(10 + model.stage, 0x6c3a42, 0.8).beginPath();
      model.segments.forEach((p, i) => {
        if (i === 0) this.ground.moveTo(p.x, p.y + 2);
        else this.ground.lineTo(p.x, p.y + 2);
      });
      if (!s.hiding) this.ground.strokePath();
      const rewardAge = s.seconds - this.rewardAt;
      if (!this.reduced && rewardAge >= 0 && rewardAge < 0.7)
        for (let i = 0; i < 10; i++)
          g.fillStyle(0xf5d590, 1 - rewardAge).fillRect(
            s.x + Math.cos(i * 2.4) * (8 + rewardAge * 25),
            s.y + Math.sin(i * 2.4) * 10 - rewardAge * 25,
            2,
            2,
          );
      while (this.body.length < model.segments.length)
        this.body.push(
          this.add.sprite(0, 0, 'worm', 1).setDepth(200 - this.body.length),
        );
      for (const [id, image] of this.sprites)
        if (!wanted.has(id)) {
          image.destroy();
          this.sprites.delete(id);
        }
      for (const [i, b] of this.body.entries()) {
        b.setFrame(i === 0 ? 0 : i === this.body.length - 1 ? 2 : 1);
        b.setDisplaySize(
          i === 0 ? 23 + model.stage : i === this.body.length - 1 ? 18 : 14,
          i === 0 ? 14 + model.stage : 10 + model.stage * 0.5,
        );
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
        b.setFlipY(Math.cos(b.rotation) < 0);
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
      const a = s.adventure;
      const next =
        model.experience >= ADULT_XP || a.baby === 'following'
          ? NEST
          : model.experience < 40
            ? world.roots.find((r, i) => s.roots[i] < r.need)
            : a.plug < 3
              ? PLUG
              : a.baby === 'lost'
                ? BABY
                : !a.chamber
                  ? CHAMBER
                  : (FUNGI.find((_, i) => !a.fungi[i]) ??
                    AMBER.find((_, i) => !a.amber[i]) ??
                    world.roots.find((r, i) => s.roots[i] < r.need));
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
        collected: model.experience,
        objectiveIcon: '✦',
        total: ADULT_XP,
        elapsed: s.seconds,
        lives: s.lives,
        activated: s.hiding,
        checkpoint: s.checkpoint < 0 ? null : world.roots[s.checkpoint].id,
        meters: [
          ...(model.underwater || s.air < 99
            ? [
                {
                  id: 'air',
                  icon: '◌',
                  label: 'Powietrze',
                  value: s.air,
                  max: 100,
                  color: '#b0dbe4',
                },
              ]
            : []),
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
            max: model.capacity,
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
        tokens: [
          {
            icon: ['◌', '◔', '◑', '◕', '●'][model.stage],
            label: 'Dojrzałość',
            active: model.stage > 0,
          },
          {
            icon: '♧',
            label: 'Uwolniona woda',
            active: s.adventure.plug === 3,
          },
          {
            icon: '♡',
            label: 'Mała dżdżownica w domu',
            active: s.adventure.baby === 'home',
          },
          { icon: '◈', label: 'Zalany skarbiec', active: s.adventure.chamber },
          {
            icon: '✧',
            label: 'Głęboka oaza',
            active: s.adventure.fungi.every(Boolean),
          },
          {
            icon: '⇣ ' + Math.floor((s.y - SURFACE) / 12) + ' cm',
            label: 'Głębokość',
            active: true,
          },
        ],
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
          regions: [
            {
              x: 0,
              y: 0,
              width: world.width,
              height: SURFACE,
              color: '#b0c9b7',
            },
            ...['#896249', '#79503d', '#704a3c', '#51424a', '#383640'].map(
              (color, i) => ({
                x: 0,
                y: SURFACE + i * 720,
                width: world.width,
                height: 720,
                color,
              }),
            ),
          ],
          markers: [
            { ...NEST, icon: '⌂', color: '#f2d69b' },
            ...(s.adventure.fungi.every(Boolean)
              ? [{ ...DEEP_NEST, icon: '⌂', color: '#93d6dc' }]
              : []),
            ...[PLUG, BABY, CHAMBER, ...FUNGI].map((p) => ({
              ...p,
              icon: '·',
              color: '#ead6a0',
            })),
            ...world.roots.map((r, i) => ({
              ...r,
              icon: s.roots[i] === r.need ? '✿' : '·',
              color: s.roots[i] === r.need ? '#c3d68a' : '#e2bda0',
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
          blooms: model.blooms,
          experience: model.experience,
          maturity: model.stage,
          depth: model.depth,
          air: s.air,
          wet: model.wet,
          underwater: model.underwater,
          plug: s.adventure.plug,
          baby: s.adventure.baby,
          chamber: s.adventure.chamber,
          fungi: s.adventure.fungi.map(Number).join(','),
          amber: s.adventure.amber.filter(Boolean).length,
          fertility: s.adventure.fertility,
          sprites: this.sprites.size + this.body.length,
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
      if (resume && !stored && previousSave.read())
        context.message(
          'Nowy świat ma osobny zapis. Postęp poprzedniej wersji pozostaje zachowany.',
        );
      started = true;
      lastSave = model.state.seconds;
    },
    persist,
    command(command) {
      active?.command(command);
    },
  };
}
