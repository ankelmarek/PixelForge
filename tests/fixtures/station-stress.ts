/** Synthetic worst-budget workload, excluded from the production build and saves.
 * Uses the production station sprites, sector renderer, navigation and swept motion.
 * Full economy/campaign verification remains in the normal game tests. */
import Phaser from 'phaser';
import {
  EngineHost,
  createFlowScenes,
  SectorRenderer,
  cameraView,
  pixelAlignedScroll,
  type ClientDefinition,
} from '../../src/engine/api';
import { station } from '../../src/games/gas-station';
import { StationModel } from '../../src/games/gas-station/model';
import { StationView } from '../../src/games/gas-station/view';
import { validateWorld, UNIT } from '../../src/games/gas-station/world';
import {
  bodies,
  emptyGoods,
  occupancyOf,
} from '../../src/games/gas-station/state';
import {
  motion,
  move,
  path,
  footprint,
} from '../../src/games/gas-station/traffic';
import type { Customer } from '../../src/games/gas-station/types';
const find = (id: string) => document.getElementById(id)!;
const definition: ClientDefinition = {
  ...station,
  createRuntime(context, data) {
    const world = validateWorld(data),
      model = new StationModel(world, 731, true, true, 'night'),
      s = model.state;
    const template = structuredClone(s.customers[0]);
    s.campaign!.event = {
      id: 0,
      kind: 'rain',
      announced: 0,
      start: 0,
      end: 120000,
      remaining: 0,
      accepted: false,
    };
    s.customers = Array.from({ length: 14 }, (_, i): Customer => ({
      ...structuredClone(template),
      id: `stress-${i}`,
      vehicle: motion(
        `stress-${i}`,
        i % 4 === 0 ? 'truck' : i % 3 === 0 ? 'van' : 'car',
        { x: 8 + i * 17, y: 158 },
      ),
      driver:
        i < 10
          ? motion(`walker-${i}`, 'person', {
              x: 100 + (i % 5) * 5,
              y: 128 + Math.floor(i / 5) * 7,
            })
          : null,
      phase: 'bypass',
      color: i % 4,
    }));
    s.workers = Array.from({ length: 4 }, (_, i) => ({
      motion: motion(`staff-${i}`, 'person', { x: 115 + i * 3, y: 109 }),
      role: 'forecourt',
      job: null,
      cargo: emptyGoods(),
    }));
    s.development!.tenant.staff = [
      motion('tenant-cashier', 'person', { x: 127, y: 109 }),
      motion('tenant-stocker', 'person', { x: 130, y: 109 }),
    ];
    s.delivery = {
      id: 'tanker',
      motion: motion('tanker', 'truck', { x: 144, y: 110 }),
      phase: 'unloading',
      due: 0,
      cancelled: false,
      fuel: 'on',
      cargo: { quantity: 100, cost: 4300 },
      goods: emptyGoods(),
      total: 100,
      received: 0,
      receiptCost: 0,
    };
    s.development!.tenant.delivery = {
      id: 'van-delivery',
      motion: motion('van-delivery', 'van', { x: 156, y: 100 }),
      phase: 'travelling',
      progress: 0,
      due: 0,
    };
    model.occupancy = occupancyOf(s);
    model.clock.speed = 4;
    const homes = new Map(
      bodies(s)
        .filter((m) => m.kind === 'person')
        .map((m) => [m.id, { x: m.x / UNIT, y: m.y / UNIT }]),
    );
    let camera: Phaser.Cameras.Scene2D.Camera | undefined,
      jump = 0;
    class Stress extends Phaser.Scene {
      terrain!: SectorRenderer;
      art!: StationView;
      maxStepMs = 0;
      ready = false;
      moving = 0;
      constructor() {
        super('Gameplay');
      }
      create() {
        camera = this.cameras.main;
        this.terrain = new SectorRenderer(
          this,
          world,
          station.levelUrl,
          context.error,
        );
        this.art = new StationView(this, model);
        this.cameras.main
          .setBounds(0, 0, 4096, 4096)
          .setZoom(0.5)
          .centerOn(126 * 16, 128 * 16);
        this.events.once('shutdown', () => {
          this.art.destroy();
          this.terrain.destroy();
          camera = undefined;
        });
      }
      update(_t: number, delta: number) {
        this.ready ||= model.prepare(4);
        const before = performance.now();
        if (this.ready)
          model.clock.advance(Math.min(delta, 100), () => {
            s.tick++;
            for (const c of s.customers)
              if (!c.vehicle.route.length) {
                if (c.vehicle.x === 252 * UNIT) {
                  const start = motion(c.id, c.vehicle.kind, { x: 4, y: 158 });
                  if (model.occupancy.tryClaim(c.id, footprint(start)))
                    c.vehicle = start;
                }
                path(c.vehicle, [{ x: 252, y: 158 }]);
              }
            let budget = 2;
            for (const m of bodies(s))
              if (m.kind === 'person' && !m.route.length && budget-- > 0) {
                const h = homes.get(m.id)!,
                  target = { x: h.x, y: m.y === h.y * UNIT ? h.y + 2 : h.y };
                const route = model.navigator.findPath(
                  { x: Math.round(m.x / UNIT), y: Math.round(m.y / UNIT) },
                  target,
                );
                if (route) path(m, route);
              }
            while (budget-- > 0)
              model.navigator.findPath({ x: 100, y: 150 }, { x: 132, y: 108 });
            for (const m of bodies(s))
              move(
                m,
                model.occupancy,
                model.topology.legal,
                true,
                m.y === 158 * UNIT && (m.x < 92 * UNIT || m.x > 164 * UNIT),
              );
          });
        this.maxStepMs = Math.max(this.maxStepMs, performance.now() - before);
        const c = this.cameras.main;
        c.setScroll(
          pixelAlignedScroll(c.scrollX, c.width, 4096, c.zoom),
          pixelAlignedScroll(c.scrollY, c.height, 4096, c.zoom),
        );
        this.terrain.update(cameraView(c));
        this.art.draw('', false);
        this.moving = bodies(s).filter((m) => m.route.length).length;
        find('telemetry').textContent = JSON.stringify({
          ready: this.ready,
          units: bodies(s).length,
          moving: this.moving,
          tick: s.tick,
          maxStepMs: this.maxStepMs,
          navLocal: model.navigator.stats.maxLocalExpanded,
          camera: `${Math.round(c.scrollX)},${Math.round(c.scrollY)}`,
          terrain: this.terrain.stats,
        });
      }
    }
    return {
      scenes: [
        ...createFlowScenes(definition, context.ready, context.error),
        Stress,
      ],
      start() {},
      persist() {
        return true;
      },
      command() {
        const positions = [
          [126, 128],
          [64, 64],
          [192, 64],
          [192, 192],
          [64, 192],
          [126, 128],
        ];
        const p = positions[jump++ % positions.length];
        camera?.centerOn(p[0] * 16, p[1] * 16);
      },
    };
  },
};
const host = new EngineHost({
  parent: find('stage'),
  definition,
  display: 'fill',
  onReady: () => {
    (find('start') as HTMLButtonElement).disabled = false;
  },
  onError: (m) => {
    find('error').textContent = m;
  },
  onMessage: (m) => {
    find('error').textContent = m;
  },
  onState: () => {},
  onPause: () => {},
});
void host.load();
find('start').onclick = () => host.start(false);
find('jump').onclick = () => host.clientCommand({ type: 'focus' });
