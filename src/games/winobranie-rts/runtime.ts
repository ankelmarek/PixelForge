import Phaser from 'phaser';
import {
  createFlowScenes,
  VersionedSave,
  SectorRenderer,
  cameraView,
  pixelAlignedScroll,
  type ClientDefinition,
  type ClientContext,
  type ClientRuntime,
  type ClientCommand,
  type JsonValue,
} from '../../engine/api';
import { inside, type Cell } from '../../engine/api/strategy';
import {
  VineyardModel,
  type Tool,
  type Role,
  type Plan,
  DEPOT,
  STORE,
} from './model';
import { validateWorld, varieties, riverAt, type Variety } from './world';
import { registerArt, VineyardViewRenderer } from './view';

export function createVineyardRuntime(
  definition: ClientDefinition,
  context: ClientContext,
  data: unknown,
): ClientRuntime {
  const world = validateWorld(data),
    model = new VineyardModel(world),
    save = new VersionedSave(definition.id, 1, (value) =>
      model.validateSave(value),
    );
  let active: Gameplay | undefined,
    started = false,
    lastSave = 0;
  const persist = () => {
    if (!started) return true;
    lastSave = model.state.tick;
    active?.emit();
    const ok = save.write(model.snapshot());
    if (!ok) context.message('Zapis lokalny jest niedostępny.');
    return ok;
  };
  class Gameplay extends Phaser.Scene {
    private terrain!: SectorRenderer;
    private art!: VineyardViewRenderer;
    private tool: Tool = 'select';
    private variety: Variety = 'solaris';
    private rotation = 0;
    private selected: string[] = [];
    private plan?: Plan;
    private hover?: Cell;
    private drag?: {
      x: number;
      y: number;
      cell: Cell;
      scrollX: number;
      scrollY: number;
      moved: boolean;
      world: Cell;
    };
    private box?: { x: number; y: number; width: number; height: number };
    private prepared = false;
    private elapsed = 0;
    private hint = '';
    private maxPlacementMs = 0;
    private maxAdvanceMs = 0;
    private planKey = '';
    private previousSold = 0;
    private previousProcessed = 0;
    constructor() {
      super('Gameplay');
    }
    create() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      active = this;
      this.tool = 'select';
      this.selected = [];
      this.plan = undefined;
      this.drag = undefined;
      this.box = undefined;
      this.prepared = false;
      this.planKey = '';
      this.hint = '';
      this.elapsed = 0;
      this.previousSold = model.state.sold;
      this.previousProcessed = model.state.processed;
      registerArt(this);
      this.terrain = new SectorRenderer(
        this,
        world,
        definition.levelUrl,
        context.error,
      );
      this.art = new VineyardViewRenderer(this, model);
      const camera = this.cameras.main;
      camera
        .setBounds(0, 0, 8192, 8192)
        .setZoom(world.camera.zoom)
        .centerOn(253 * 16, 250 * 16);
      const point = (p: Phaser.Input.Pointer) => {
        const q = camera.getWorldPoint(p.x, p.y);
        return { x: Math.floor(q.x / 16), y: Math.floor(q.y / 16) };
      };
      const cancel = () => {
        this.drag = undefined;
        this.box = undefined;
        this.plan = undefined;
        this.planKey = '';
      };
      const down = (p: Phaser.Input.Pointer) => {
        if (!this.prepared || model.state.completed || model.state.failed)
          return;
        this.game.canvas.focus({ preventScroll: true });
        if (p.rightButtonDown()) {
          cancel();
          this.tool = 'select';
          this.selected = [];
          return;
        }
        const q = point(p);
        this.drag = {
          x: p.x,
          y: p.y,
          cell: q,
          scrollX: camera.scrollX,
          scrollY: camera.scrollY,
          moved: false,
          world: camera.getWorldPoint(p.x, p.y),
        };
        this.hover = q;
        this.preview();
      };
      const move = (p: Phaser.Input.Pointer) => {
        if (!this.prepared) return;
        const d = this.drag;
        if (d && p.isDown) {
          const scale =
            this.game.canvas.getBoundingClientRect().width / camera.width;
          d.moved ||= Math.hypot(p.x - d.x, p.y - d.y) * scale >= 6;
          if (d.moved && this.tool === 'select' && !this.hit(d.cell))
            camera.setScroll(
              d.scrollX - (p.x - d.x) / camera.zoom,
              d.scrollY - (p.y - d.y) / camera.zoom,
            );
          if (this.tool === 'box') {
            const q = camera.getWorldPoint(p.x, p.y);
            this.box = {
              x: Math.min(q.x, d.world.x),
              y: Math.min(q.y, d.world.y),
              width: Math.abs(q.x - d.world.x),
              height: Math.abs(q.y - d.world.y),
            };
          }
        }
        this.clamp();
        this.hover = point(p);
        this.preview();
      };
      const up = (p: Phaser.Input.Pointer) => {
        const d = this.drag;
        if (!d) return;
        const q = point(p),
          id = this.hit(q);
        if (this.tool === 'box' && this.box)
          this.selected = model.state.units
            .filter((u) =>
              inside({ x: (u.x + 0.5) * 16, y: (u.y + 0.5) * 16 }, this.box!),
            )
            .map((u) => u.id);
        else if (['row', 'road', 'house', 'move'].includes(this.tool)) {
          this.hover = q;
          this.preview();
          if (this.plan && model.commit(this.plan)) {
            context.audio.play('activate');
            persist();
            this.hint = '';
          } else {
            this.hint = this.plan?.reason ?? '';
            context.audio.play('hit');
          }
        } else if (this.tool === 'remove') {
          const ok = id ? model.remove(id) : model.removeRoad(q);
          if (ok) {
            context.audio.play('activate');
            persist();
          } else this.hint = 'Obiekt zajęty';
        } else if (this.tool === 'parcel') {
          if (model.buyParcel(q)) {
            context.audio.play('activate');
            persist();
          } else this.hint = 'Parcela niedostępna';
        } else if (!d.moved) {
          const unit = model.state.units.find((u) => u.id === id);
          if (unit) this.selected = [unit.id];
          else if (
            this.selected.some((s) => model.state.units.some((u) => u.id === s))
          ) {
            model.order(this.selected, id, q);
            if (id) this.selected = [id];
            context.audio.play('activate');
          } else this.selected = id ? [id] : [];
        }
        this.drag = undefined;
        this.box = undefined;
        this.planKey = '';
        this.preview();
        this.emit();
      };
      const wheel = (
        p: Phaser.Input.Pointer,
        _over: unknown,
        _dx: number,
        dy: number,
      ) => {
        p.event?.preventDefault();
        this.zoom(dy > 0 ? -1 : 1, p.x, p.y);
        cancel();
      };
      const contextmenu = (e: Event) => e.preventDefault();
      let width = camera.width,
        height = camera.height;
      const resize = () => {
        cancel();
        camera.centerOn(
          camera.scrollX + width / 2,
          camera.scrollY + height / 2,
        );
        width = camera.width;
        height = camera.height;
        this.clamp();
      };
      this.input.on('pointerdown', down);
      this.input.on('pointermove', move);
      this.input.on('pointerup', up);
      this.input.on('pointerupoutside', cancel);
      this.input.on('gameout', cancel);
      this.input.on('wheel', wheel);
      this.scale.on('resize', resize);
      this.events.on('pause', cancel);
      window.addEventListener('blur', cancel);
      this.game.canvas.addEventListener('contextmenu', contextmenu);
      this.events.once('shutdown', () => {
        this.terrain.destroy();
        this.art.destroy();
        active = undefined;
        this.input.off('pointerdown', down);
        this.input.off('pointermove', move);
        this.input.off('pointerup', up);
        this.input.off('pointerupoutside', cancel);
        this.input.off('gameout', cancel);
        this.input.off('wheel', wheel);
        this.scale.off('resize', resize);
        this.events.off('pause', cancel);
        window.removeEventListener('blur', cancel);
        this.game.canvas.removeEventListener('contextmenu', contextmenu);
      });
      this.emit();
    }
    private hit(p: Cell) {
      const unit = model.state.units.find(
        (u) =>
          Math.hypot(u.x - p.x, u.y - p.y) < (u.kind === 'tractor' ? 2.4 : 1.4),
      );
      if (unit) return unit.id;
      const building = model.state.buildings.find((b) => inside(p, b));
      if (building) return building.id;
      if (inside(p, STORE)) return 'warehouse';
      return (
        model.state.rows.find((r) =>
          r.cells.some(
            (c) => Math.abs(c.x - p.x) < 1.5 && Math.abs(c.y - p.y) < 1.5,
          ),
        )?.id ?? null
      );
    }
    private preview() {
      if (
        !this.hover ||
        !['row', 'road', 'house', 'move'].includes(this.tool)
      ) {
        this.plan = undefined;
        return;
      }
      const from = ['row', 'road'].includes(this.tool)
        ? (this.drag?.cell ?? this.hover)
        : this.hover;
      const signature = JSON.stringify([
        this.tool,
        from,
        this.hover,
        this.rotation,
        this.variety,
        model.state.topology,
        this.selected,
      ]);
      if (signature === this.planKey) return;
      this.planKey = signature;
      const start = performance.now();
      this.plan = model.preview(
        this.tool,
        from,
        this.hover,
        this.rotation,
        this.variety,
        this.tool === 'move' ? this.selected[0] : undefined,
      );
      this.maxPlacementMs = Math.max(
        this.maxPlacementMs,
        performance.now() - start,
      );
    }
    private clamp() {
      const c = this.cameras.main;
      c.setScroll(
        pixelAlignedScroll(c.scrollX, c.width, 8192, c.zoom),
        pixelAlignedScroll(c.scrollY, c.height, 8192, c.zoom),
      );
    }
    private zoom(
      direction: number,
      x = this.cameras.main.width / 2,
      y = this.cameras.main.height / 2,
    ) {
      const c = this.cameras.main,
        old = c.zoom,
        next = Phaser.Math.Clamp(old * (direction > 0 ? 1.2 : 1 / 1.2), 0.5, 2),
        p = c.getWorldPoint(x, y);
      c.setZoom(next).setScroll(
        p.x - c.width / 2 - (x - c.width / 2) / next,
        p.y - c.height / 2 - (y - c.height / 2) / next,
      );
      this.clamp();
    }
    command(command: ClientCommand) {
      if (command.type === 'zoom') this.zoom(command.direction);
      if (command.type === 'focus') {
        this.cameras.main.centerOn(
          command.point?.x ?? 253 * 16,
          command.point?.y ?? 250 * 16,
        );
        this.clamp();
      }
      if (command.type !== 'client-action') return;
      const { action, payload } = command;
      if (
        action === 'tool' &&
        typeof payload === 'string' &&
        [
          'select',
          'box',
          'row',
          'road',
          'house',
          'remove',
          'move',
          'parcel',
        ].includes(payload)
      )
        this.tool = payload as Tool;
      if (
        action === 'variety' &&
        typeof payload === 'string' &&
        Object.hasOwn(varieties, payload)
      )
        this.variety = payload as Variety;
      if (
        action === 'speed' &&
        (payload === 1 || payload === 2 || payload === 4)
      )
        model.clock.speed = payload;
      if (action === 'rotate') this.rotation = (this.rotation + 1) % 4;
      if (action === 'cancel') {
        this.tool = 'select';
        this.selected = [];
      }
      if (
        action === 'unit' &&
        typeof payload === 'string' &&
        model.state.units.some((u) => u.id === payload)
      ) {
        this.selected = [payload];
        this.tool = 'select';
        const u = model.state.units.find((u) => u.id === payload)!;
        this.cameras.main.centerOn(u.x * 16, u.y * 16);
        this.clamp();
      }
      if (
        action === 'role' &&
        typeof payload === 'string' &&
        ['auto', 'harvest', 'press', 'build', 'rest'].includes(payload)
      )
        model.role(this.selected, payload as Role);
      if (
        action === 'sell' &&
        this.selected[0] &&
        model.sell(this.selected[0])
      ) {
        context.audio.play('collect');
        persist();
      }
      this.planKey = '';
      this.hint = '';
      this.preview();
      this.emit();
    }
    update(_time: number, delta: number) {
      if (!this.prepared) this.prepared = model.prepare(8);
      else {
        const start = performance.now();
        model.advance(delta);
        this.maxAdvanceMs = Math.max(
          this.maxAdvanceMs,
          performance.now() - start,
        );
      }
      this.clamp();
      this.terrain.update(cameraView(this.cameras.main));
      this.art.draw(this.selected, this.plan, this.box);
      if (model.state.processed > this.previousProcessed) {
        this.previousProcessed = model.state.processed;
        context.audio.play('activate');
      }
      if (model.state.sold > this.previousSold) {
        this.previousSold = model.state.sold;
        context.audio.play('collect');
      }
      if (model.state.tick - lastSave >= 200) persist();
      this.elapsed += delta;
      if (this.elapsed >= 100) {
        this.elapsed = 0;
        this.emit();
      }
    }
    emit() {
      const s = model.state,
        c = this.cameras.main,
        b = s.buildings.find((b) => b.id === this.selected[0]),
        r = s.rows.find((r) => r.id === this.selected[0]),
        u = s.units.find((u) => u.id === this.selected[0]);
      const quantity = (stock: Record<string, number>) =>
        Object.values(stock).reduce((a, n) => a + n, 0);
      const names: Record<Role, string> = {
        auto: 'Auto',
        harvest: 'Zbiór',
        press: 'Prasa',
        build: 'Budowa',
        rest: 'Postój',
      };
      const label = b
        ? 'Domek winiarski'
        : r
          ? varieties[r.variety].name
          : u
            ? u.kind === 'tractor'
              ? 'Traktor'
              : `Pracownik ${u.id.slice(-1)}`
            : this.selected[0] === 'warehouse'
              ? 'Magazyn'
              : 'Winnica';
      const detail = b
        ? `${(quantity(b.stock) / 1000).toFixed(1)} kg gron · ${b.work ? 'Budowa' : b.batch ? 'Tłoczenie' : 'Prasa'}`
        : r
          ? `${r.vines} krzewów · ${(r.stock / 1000).toFixed(1)} kg · ${r.work ? 'Sadzenie' : r.mature ? 'Zbiór' : 'Młode'}`
          : u
            ? `${names[u.role]} · ${(quantity(u.cargo) / 1000).toFixed(1)} kg${u.blocked ? ' · Brak trasy' : ''}`
            : `${s.rows.reduce((a, r) => a + r.vines, 0)} krzewów · ${s.buildings.length} domki · ${(quantity(s.warehouse) / 1000).toFixed(1)} kg`;
      const client = {
        cash: s.ledger.balance,
        seconds: s.tick / 20,
        speed: model.clock.speed,
        sold: s.sold,
        vouchers: s.vouchers,
        tool: this.tool,
        variety: this.variety,
        rotation: this.rotation,
        selection: this.selected,
        label,
        detail,
        stock: b ? quantity(b.stock) : 0,
        must: b ? quantity(b.must) : 0,
        sellable: !!b,
        hint: this.hint || this.plan?.reason || '',
        cost: this.plan?.cost ?? 0,
        valid: this.plan?.valid ?? true,
        arrears: s.ledger.arrears,
        units: s.units.map((u) => ({
          id: u.id,
          icon: u.kind === 'tractor' ? '▰' : '♟',
          busy: !!u.job,
          cargo: quantity(u.cargo),
          role: u.role,
        })),
      };
      context.state({
        results: [
          {
            label: 'Sprzedany moszcz',
            value: `${(s.sold / 1000).toFixed(1)} / 40 L`,
          },
          { label: 'Przychód', value: `${s.ledger.income / 100} ◈` },
          { label: 'Koszty', value: `${s.ledger.costs / 100} ◈` },
          { label: 'Gotówka', value: `${s.ledger.balance / 100} ◈` },
          { label: 'Utracone grona', value: `${s.lost / 1000} kg` },
        ],
        mode: 'client',
        completed: s.completed,
        failed: s.failed,
        paused: false,
        objectiveIcon: '❧',
        collected: s.sold / 1000,
        total: 40,
        elapsed: s.tick / 20,
        x: DEPOT.x * 16,
        y: DEPOT.y * 16,
        selectedId: this.selected[0] ?? null,
        client: client as JsonValue,
        camera: {
          scrollX: c.scrollX,
          scrollY: c.scrollY,
          zoom: c.zoom,
          width: c.width,
          height: c.height,
        },
        map: {
          width: 8192,
          height: 8192,
          regions: [
            { x: 0, y: 0, width: 8192, height: 8192, color: '#70874c' },
            ...Array.from({ length: 64 }, (_, i) => ({
              x: (riverAt(i * 8) - 3) * 16,
              y: i * 128,
              width: 96,
              height: 128,
              color: '#668e99',
            })),
            ...s.parcels.map((p) => ({
              x: p.x * 16,
              y: p.y * 16,
              width: p.width * 16,
              height: p.height * 16,
              color: '#9ca95d',
            })),
          ],
          markers: [
            { x: DEPOT.x * 16, y: DEPOT.y * 16, icon: '⌂', color: '#fff0bc' },
            ...s.units.map((u) => ({
              x: u.x * 16,
              y: u.y * 16,
              icon: '•',
              color: '#ebce85',
            })),
          ],
          trail: [],
        },
        stats: {
          tick: s.tick,
          cash: s.ledger.balance,
          sold: s.sold,
          processed: s.processed,
          grams: model.balanceGrams,
          grown: s.grown,
          rows: s.rows.length,
          buildings: s.buildings.length,
          roadCells: s.roads.length,
          units: JSON.stringify(
            s.units.map((u) => ({
              id: u.id,
              x: u.x,
              y: u.y,
              cargo: u.cargo,
              job: u.job?.kind,
              blocked: u.blocked,
            })),
          ),
          ready: this.prepared,
          rendered: this.art?.rendered ?? 0,
          terrainTextures: this.terrain?.stats.textureBytes ?? 0,
          resident: this.terrain?.stats.resident ?? 0,
          missing: this.terrain?.stats.missing ?? 0,
          topology: s.topology,
          maxPlacementMs: this.maxPlacementMs,
          maxAdvanceMs: this.maxAdvanceMs,
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
      model.reset();
      if (resume) {
        const previous = save.inspect();
        if (previous.status === 'invalid')
          context.message(
            'Zapis Winobrania jest uszkodzony. Rozpoczęto nowy sezon.',
          );
        if (previous.status === 'ready') {
          try {
            model.restore(previous.value);
          } catch {
            context.message(
              'Zapis Winobrania jest uszkodzony. Rozpoczęto nowy sezon.',
            );
          }
        }
      }
      started = true;
      lastSave = model.state.tick;
    },
    persist,
    command(command) {
      active?.command(command);
    },
  };
}
