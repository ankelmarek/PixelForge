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
import { StationModel } from './model';
import { StationView } from './view';
import { validateWorld, FUELS, GOODS, SHOP, UNIT, prices } from './world';
import { bodies } from './state';
import { money, type StationUI } from './controls';
import { tankCapacity, PARCELS } from './development';
import { roadLine, type BuildRequest } from './placement';

export function createStationRuntime(
  definition: ClientDefinition,
  context: ClientContext,
  data: unknown,
): ClientRuntime {
  const world = validateWorld(data);
  context.audio.setMix('music', 0.7);
  context.audio.setMix('effects', 0.8);
  let model = new StationModel(world, world.scenario.seed, true),
    active: Gameplay | undefined,
    started = false,
    lastSave = 0;
  const save = new VersionedSave(definition.id, 2, (raw) =>
    model.validateSave(raw),
  );
  const legacySave = new VersionedSave(definition.id, 1, (raw) =>
    model.validateSave(raw),
  );
  const persist = () => {
    if (!started) return true;
    active?.emit();
    const ok = save.write(model.snapshot());
    lastSave = model.state.tick;
    if (!ok) context.message('Zapis Stacji jest niedostępny.');
    return ok;
  };
  class Gameplay extends Phaser.Scene {
    private terrain!: SectorRenderer;
    private art!: StationView;
    private prepared = false;
    private ended = false;
    private elapsed = 0;
    private soundElapsed = 0;
    private previousReceipts = 0;
    private previousDelivery = '';
    private previousDoorOpen = false;
    private drag?: {
      x: number;
      y: number;
      scrollX: number;
      scrollY: number;
      moved: boolean;
    };
    private selection = '';
    private buildMode = false;
    private project: BuildRequest | null = null;
    private hint = '';
    private maxAdvanceMs = 0;
    constructor() {
      super('Gameplay');
    }
    create() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      active = this;
      this.prepared = false;
      this.ended = false;
      this.selection = '';
      this.buildMode = false;
      this.project = null;
      this.drag = undefined;
      this.hint = '';
      this.elapsed = 0;
      this.soundElapsed = 0;
      this.previousReceipts = model.state.journal.entries.filter(
        (e) => e.category === 'checkout',
      ).length;
      this.previousDelivery = model.state.delivery?.phase ?? '';
      this.previousDoorOpen = model.state.customers.some(
        (c) =>
          c.driver &&
          Math.hypot(c.driver.x / UNIT - 124, c.driver.y / UNIT - 113) < 5,
      );
      this.terrain = new SectorRenderer(
        this,
        world,
        definition.levelUrl,
        context.error,
      );
      this.art = new StationView(this, model);
      const c = this.cameras.main,
        p = model.state.camera;
      c.setBounds(0, 0, 4096, 4096).setZoom(p.zoom).centerOn(p.x, p.y);
      this.clamp();
      const cancel = () => {
        this.drag = undefined;
      };
      const down = (p: Phaser.Input.Pointer) => {
        if (!this.prepared || model.state.result) return;
        this.game.canvas.focus({ preventScroll: true });
        if (p.rightButtonDown()) {
          this.buildMode = false;
          this.project = null;
          this.selection = '';
          this.emit();
          return;
        }
        this.drag = {
          x: p.x,
          y: p.y,
          scrollX: c.scrollX,
          scrollY: c.scrollY,
          moved: false,
        };
        if (this.project?.kind === 'road') {
          const q = c.getWorldPoint(p.x, p.y);
          this.project.point = {
            x: Math.round(q.x / 16),
            y: Math.round(q.y / 16),
          };
          this.project.to = { ...this.project.point };
        }
      };
      const move = (p: Phaser.Input.Pointer) => {
        const d = this.drag;
        if (!d || !p.isDown) return;
        if (this.project?.kind === 'road') {
          const q = c.getWorldPoint(p.x, p.y),
            a = this.project.point;
          const x = Math.round(q.x / 16),
            y = Math.round(q.y / 16);
          this.project.to =
            Math.abs(x - a.x) > Math.abs(y - a.y)
              ? { x, y: a.y }
              : { x: a.x, y };
          this.emit();
          return;
        }
        d.moved ||=
          (Math.hypot(p.x - d.x, p.y - d.y) *
            this.game.canvas.getBoundingClientRect().width) /
            c.width >
          6;
        if (d.moved)
          c.setScroll(
            d.scrollX - (p.x - d.x) / c.zoom,
            d.scrollY - (p.y - d.y) / c.zoom,
          );
        this.clamp();
      };
      const up = (p: Phaser.Input.Pointer) => {
        const d = this.drag;
        cancel();
        if (!d || d.moved) return;
        const q = c.getWorldPoint(p.x, p.y),
          x = q.x / 16,
          y = q.y / 16;
        if (this.project) {
          if (this.project.kind !== 'road')
            this.project.point = { x: Math.round(x), y: Math.round(y) };
          if (this.project.kind === 'remove-road')
            this.project.roadId = model.state.development?.roads.find((r) =>
              roadLine(r.from, r.to).some(
                (p) => Math.hypot(p.x - x, p.y - y) < 4,
              ),
            )?.id;
          this.emit();
          return;
        }
        if (this.buildMode) {
          const plan = model.previewPump();
          if (Math.abs(x - 138) < 5 && Math.abs(y - 124) < 6)
            this.apply('build', plan.revision);
          return;
        }
        const actor = bodies(model.state).find(
          (m) =>
            Math.hypot(m.x / UNIT - x, m.y / UNIT - y) <
            (m.kind === 'person' ? 1.6 : 3),
        );
        const pump = model.pumps.findIndex(
          (p) => Math.hypot(p.x - 3 - x, p.y - y) < 3,
        );
        this.selection =
          actor?.id ??
          (pump >= 0
            ? `pump-${pump}`
            : x >= SHOP.x &&
                x < SHOP.x + SHOP.width &&
                y >= SHOP.y &&
                y < SHOP.y + SHOP.height
              ? 'shop'
              : '');
        this.hint = '';
        this.emit();
      };
      const wheel = (
        p: Phaser.Input.Pointer,
        _objects: unknown,
        _dx: number,
        dy: number,
      ) => {
        p.event?.preventDefault();
        this.zoom(dy > 0 ? -1 : 1, p.x, p.y);
        cancel();
      };
      let width = c.width,
        height = c.height;
      const resize = () => {
        cancel();
        c.centerOn(c.scrollX + width / 2, c.scrollY + height / 2);
        width = c.width;
        height = c.height;
        this.clamp();
      };
      const contextmenu = (e: Event) => e.preventDefault();
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
    private clamp() {
      const c = this.cameras.main;
      c.setScroll(
        pixelAlignedScroll(c.scrollX, c.width, 4096, c.zoom),
        pixelAlignedScroll(c.scrollY, c.height, 4096, c.zoom),
      );
    }
    private zoom(
      direction: number,
      x = this.cameras.main.width / 2,
      y = this.cameras.main.height / 2,
    ) {
      const c = this.cameras.main,
        p = c.getWorldPoint(x, y),
        next = Phaser.Math.Clamp(
          c.zoom * (direction > 0 ? 1.2 : 1 / 1.2),
          0.5,
          2,
        );
      c.setZoom(next).setScroll(
        p.x - c.width / 2 - (x - c.width / 2) / next,
        p.y - c.height / 2 - (y - c.height / 2) / next,
      );
      this.clamp();
      this.emit();
    }
    private focus(x: number, y: number) {
      this.cameras.main.centerOn(x, y);
      this.clamp();
    }
    command(command: ClientCommand) {
      if (command.type === 'zoom') this.zoom(command.direction);
      else if (command.type === 'focus') {
        this.focus(command.point?.x ?? 126 * 16, command.point?.y ?? 128 * 16);
        this.emit();
      } else if (command.type === 'client-action')
        this.apply(command.action, command.payload);
    }
    private apply(action: string, payload?: JsonValue) {
      if (!this.prepared || model.state.result) return;
      const s = model.state;
      let ok = true,
        mutation = false;
      this.hint = '';
      if (action === 'speed' && [1, 2, 4].includes(Number(payload)))
        model.clock.speed = Number(payload) as 1 | 2 | 4;
      else if (action === 'order-e95' || action === 'order-on') {
        ok = model.orderFuel(
          action === 'order-on' ? 'on' : 'e95',
          Number(payload),
        );
        mutation = true;
      } else if (action === 'order-goods') {
        ok = model.orderGoods();
        mutation = true;
      } else if (action === 'cancel-delivery') {
        ok = typeof payload === 'string' && model.cancelDelivery(payload);
        mutation = true;
      } else if (/^role-[0-3]$/.test(action)) {
        ok =
          (payload === 'forecourt' || payload === 'checkout') &&
          model.assignWorker(Number(action.at(-1)), payload);
        mutation = true;
      } else if (action === 'pump') {
        const i = Number(payload);
        ok = model.setPump(i, !s.pumps[i]?.open);
        mutation = true;
      } else if (action === 'build-preview') {
        this.project = null;
        this.buildMode = true;
        this.selection = '';
        this.focus(138 * 16, 124 * 16);
      } else if (action === 'build-cancel') {
        this.buildMode = false;
        this.project = null;
      } else if (action === 'build') {
        ok = model.buildPump(Number(payload));
        mutation = true;
        if (ok) this.buildMode = false;
      } else if (
        action === 'project' &&
        typeof payload === 'string' &&
        [
          'road',
          'remove-road',
          'pump',
          'heavy-pump',
          'parking',
          'tank',
        ].includes(payload) &&
        s.development
      ) {
        this.buildMode = false;
        this.selection = '';
        this.project = {
          kind: payload as BuildRequest['kind'],
          point: { x: 84, y: 118 },
          rotation: 0,
          fuel: 'e95',
        };
        if (payload === 'heavy-pump') this.project.fuel = 'on';
        this.focus(116 * 16, 115 * 16);
      } else if (action === 'project-rotate' && this.project)
        this.project.rotation = (this.project.rotation + 1) % 4;
      else if (
        action === 'project-fuel' &&
        this.project &&
        (payload === 'e95' || payload === 'on')
      )
        this.project.fuel = payload;
      else if (action === 'project-cancel') this.project = null;
      else if (action === 'project-commit' && this.project) {
        ok = model.build(this.project, Number(payload));
        mutation = true;
        if (ok) this.project = null;
        else this.hint = model.previewBuild(this.project).reason;
      } else if (action === 'parcel' && typeof payload === 'string') {
        ok = model.buyParcel(payload);
        mutation = true;
        const p = PARCELS.find((p) => p.id === payload);
        if (ok && p)
          this.focus((p.x + p.width / 2) * 16, (p.y + p.height / 2) * 16);
      } else if (action === 'hire') {
        ok = model.hire();
        mutation = true;
      } else if (action === 'second-checkout') {
        ok = model.secondCheckout();
        mutation = true;
      } else if (
        action === 'priority' &&
        (payload === 'customers' || payload === 'deliveries')
      ) {
        ok = model.setPriority(payload);
        mutation = true;
      } else if (
        action.startsWith('price-') &&
        [...FUELS, ...GOODS].includes(action.slice(6) as keyof typeof prices)
      ) {
        ok = model.setPrice(
          action.slice(6) as keyof typeof prices,
          Number(payload),
        );
        mutation = true;
      } else if (
        action === 'lease' &&
        (payload === 'fixed' || payload === 'share') &&
        s.development
      ) {
        ok = model.lease.sign(payload);
        mutation = true;
      } else if (action === 'lease-end' && s.development) {
        ok = model.lease.termination();
        mutation = true;
      } else if (action === 'select' && typeof payload === 'string') {
        this.selection = payload;
        const body = bodies(s).find((m) => m.id === payload);
        if (body) this.focus((body.x / UNIT) * 16, (body.y / UNIT) * 16);
      } else if (action === 'delivery-focus') {
        const m = s.delivery?.motion;
        this.focus(
          m ? (m.x / UNIT) * 16 : 144 * 16,
          m ? (m.y / UNIT) * 16 : 110 * 16,
        );
      } else if (
        action === 'mix-music' ||
        action === 'mix-ambience' ||
        action === 'mix-effects'
      )
        context.audio.setMix(
          action.slice(4) as 'music' | 'ambience' | 'effects',
          Number(payload),
        );
      else return;
      if (!ok && !this.hint)
        this.hint =
          action === 'build'
            ? model.previewPump().reason || 'Podgląd nieaktualny'
            : 'Akcja chwilowo niedostępna';
      if (mutation) {
        context.audio.cue({
          frequency: ok ? 420 : 160,
          end: ok ? 680 : 95,
          duration: 0.14,
          volume: 0.025,
        });
        if (ok) persist();
      }
      this.emit();
    }
    update(_time: number, delta: number) {
      if (!this.prepared) this.prepared = model.prepare(4);
      if (this.prepared && !model.state.result) {
        const start = performance.now();
        model.advance(Math.min(delta, 100));
        this.maxAdvanceMs = Math.max(
          this.maxAdvanceMs,
          performance.now() - start,
        );
      }
      const c = this.cameras.main,
        input = context.input,
        pan = (Math.min(delta, 100) * 0.5) / c.zoom;
      c.scrollX +=
        (Number(input.down('right')) - Number(input.down('left'))) * pan;
      c.scrollY +=
        (Number(input.down('down')) - Number(input.down('up'))) * pan;
      this.clamp();
      this.terrain.update(cameraView(c));
      this.art.draw(this.selection, this.buildMode, this.project);
      this.soundElapsed += delta;
      if (this.soundElapsed > 400 && !model.state.result) {
        this.soundElapsed = 0;
        const v = c.getWorldPoint(0, 0);
        const audible = (x: number, y: number) =>
          x >= v.x &&
          y >= v.y &&
          x <= v.x + c.width / c.zoom &&
          y <= v.y + c.height / c.zoom;
        if (
          model.state.customers.some(
            (a) =>
              a.vehicle.route.length &&
              audible(a.vehicle.x / 16, a.vehicle.y / 16),
          )
        )
          context.audio.cue(
            {
              frequency: 78,
              end: 62,
              duration: 0.35,
              volume: 0.009,
              type: 'triangle',
            },
            'ambience',
          );
        if (
          model.state.customers.some(
            (a) =>
              a.phase === 'fueling' &&
              audible(a.vehicle.x / 16, a.vehicle.y / 16),
          )
        )
          context.audio.cue(
            {
              frequency: 115,
              end: 110,
              duration: 0.28,
              volume: 0.008,
              type: 'sawtooth',
            },
            'ambience',
          );
      }
      const receipts = model.state.journal.entries.filter(
        (e) => e.category === 'checkout',
      ).length;
      if (receipts > this.previousReceipts) {
        this.previousReceipts = receipts;
        context.audio.cue({
          frequency: 1400,
          end: 1900,
          duration: 0.13,
          volume: 0.025,
          type: 'sine',
        });
      }
      const doorOpen = model.state.customers.some(
        (c) =>
          c.driver &&
          Math.hypot(c.driver.x / UNIT - 124, c.driver.y / UNIT - 113) < 5,
      );
      if (doorOpen && !this.previousDoorOpen)
        context.audio.cue({
          frequency: 880,
          end: 1040,
          duration: 0.09,
          volume: 0.015,
          type: 'sine',
        });
      this.previousDoorOpen = doorOpen;
      const phase = model.state.delivery?.phase ?? '';
      if (phase !== this.previousDelivery) {
        if (phase === 'unloading')
          context.audio.cue(
            { frequency: 92, end: 66, duration: 0.7, volume: 0.018 },
            'ambience',
          );
        this.previousDelivery = phase;
      }
      if (model.state.result && !this.ended) {
        this.ended = true;
        context.audio.music();
        context.audio.play(
          model.state.result === 'success' ? 'complete' : 'activate',
        );
        persist();
      } else if (model.state.tick - lastSave >= 300) persist();
      this.elapsed += delta;
      if (this.elapsed >= 100) {
        this.elapsed = 0;
        this.emit();
      }
    }
    emit() {
      const s = model.state,
        c = this.cameras.main;
      const center = {
        x: Phaser.Math.Clamp(c.scrollX + c.width / 2, 0, 4096),
        y: Phaser.Math.Clamp(c.scrollY + c.height / 2, 0, 4096),
        zoom: c.zoom,
      };
      s.camera = center;
      const plan = model.previewPump(),
        d = s.delivery,
        w = s.workers.find((w) => w.motion.id === this.selection),
        p = s.pumps.find((p) => p.id === this.selection),
        customer = s.customers.find(
          (a) => a.id === this.selection || a.driver?.id === this.selection,
        );
      const jobName = {
        prepare: 'Obsługa auta',
        unload: 'Rozładunek',
        restock: 'Towar do sklepu',
        build: 'Rozbudowa',
      };
      const client: StationUI = {
        cash: model.cash,
        profit: model.profit,
        netWorth: model.netWorth,
        revenue: s.journal.revenue,
        costs: s.journal.revenue - model.profit,
        seconds: s.tick / 20,
        duration: model.duration,
        speed: model.clock.speed,
        served: s.served,
        goal: model.goal,
        satisfaction: s.visits ? s.satisfaction / s.visits / 100 : 100,
        tanks: FUELS.map((f) => ({
          fuel: f,
          capacity: tankCapacity(s, f),
          quantity: s.tanks[f].quantity,
          reserved: s.tanks[f].quantity - model.available(f),
          can200:
            !d &&
            s.tanks[f].quantity + 2000 <= tankCapacity(s, f) &&
            model.cash >= prices[f].buy * 200 + 8000,
          can400:
            !d &&
            s.tanks[f].quantity + 4000 <= tankCapacity(s, f) &&
            model.cash >= prices[f].buy * 400 + 8000,
        })),
        goods: GOODS.map((k) => ({
          product: k,
          quantity: s.goods[k].quantity,
        })),
        canGoods:
          !d &&
          (!s.development || s.development.tenant.phase === 'owned') &&
          model.cash >= 13000 &&
          GOODS.reduce(
            (n, k) =>
              n +
              s.goods[k].quantity +
              s.workers.reduce((a, w) => a + w.cargo[k].quantity, 0),
            0,
          ) <= 50,
        workers: s.workers.map((w) => ({
          id: w.motion.id,
          role: w.role,
          job: w.job
            ? jobName[w.job.kind]
            : w.role === 'checkout'
              ? 'Kasa'
              : 'Podjazd',
          busy:
            !!w.job ||
            s.checkout?.worker === w.motion.id ||
            s.development?.checkout?.worker === w.motion.id,
        })),
        pumps: s.pumps.map((p) => ({
          id: p.id,
          built: p.built,
          open: p.open,
          busy: !!p.customer,
        })),
        delivery: d
          ? {
              id: d.id,
              label: d.fuel
                ? `Cysterna · ${prices[d.fuel].label}`
                : 'Dostawa do sklepu',
              phase: d.cancelled
                ? 'Anulowana · powrót'
                : {
                    ordered: 'Zamówiona',
                    travelling: 'W drodze',
                    unloading: 'Rozładunek',
                    departing: 'Powrót',
                  }[d.phase],
              received: d.received,
              total: d.total,
              canCancel: !d.cancelled && d.phase !== 'departing',
            }
          : null,
        plan: {
          valid: plan.valid,
          reason: plan.reason,
          cost: plan.cost,
          revision: plan.revision,
        },
        building: !!s.pumps[2].construction || s.pumps[2].built,
        buildMode: this.buildMode,
        selection: this.selection,
        label: p
          ? `Dystrybutor ${Number(p.id.at(-1)) + 1}`
          : w
            ? `Pracownik ${w.motion.id.at(-1)}`
            : customer
              ? 'Podróżny'
              : this.selection === 'shop'
                ? 'Sklep ORLAR'
                : 'Stacja ORLAR',
        detail: p
          ? p.built
            ? p.customer
              ? 'Obsługa'
              : p.open
                ? 'Otwarte'
                : 'Zamknięte'
            : 'Stanowisko 03'
          : w
            ? w.job
              ? jobName[w.job.kind]
              : w.role === 'checkout'
                ? 'Kasa'
                : 'Podjazd'
            : customer
              ? `${customer.fuel?.toUpperCase() ?? 'Sklep'} · ${(customer.issued / 10).toFixed(1)} / ${(customer.requested / 10).toFixed(1)} L · ${money(customer.paidTotal || customer.fuelBill)} ◈`
              : this.selection === 'shop'
                ? `${GOODS.reduce((n, k) => n + s.goods[k].quantity, 0)} / 80 szt. · własny sklep`
                : '',
        hint: this.hint,
        ready: this.prepared,
        ...(s.development
          ? {
              development: {
                prices: { ...s.development.prices },
                priority: s.development.priority,
                owned: [...s.development.parcels],
                canHire: s.workers.length < 4 && model.cash >= 10000,
                secondCheckout: s.development.secondCheckout,
                leaseOffer: model.lease.offer(),
                shopMode: s.development.tenant.phase,
                contract:
                  s.development.tenant.contract?.type === 'fixed'
                    ? 'Stała'
                    : 'Partnerska',
                termination: s.development.tenant.contract?.terminate ?? false,
                turnover: model.lease.turnover,
                leaseIncome: s.development.tenant.settlements.reduce(
                  (n, e) => n + e.rent + e.share,
                  0,
                ),
                tenantStock: GOODS.reduce(
                  (n, k) => n + s.development!.tenant.stock[k],
                  0,
                ),
                tenantDeliveries: s.development.tenant.deliveries,
                build: this.project
                  ? {
                      ...model.previewBuild(this.project),
                      kind: this.project.kind,
                      rotation: this.project.rotation,
                    }
                  : null,
              },
            }
          : {}),
      };
      context.state({
        mode: 'client',
        completed: s.result === 'success',
        failed: s.result === 'partial',
        paused: false,
        elapsed: s.tick / 20,
        collected: s.served,
        total: model.goal,
        objectiveIcon: '⛽',
        x: center.x,
        y: center.y,
        resultTitle:
          s.result === 'success'
            ? s.development
              ? 'Stacja rośnie!'
              : 'Dobry początek!'
            : 'Zmiana zamknięta',
        results: [
          { label: 'Obsłużeni klienci', value: `${s.served} / ${model.goal}` },
          { label: 'Zysk operacyjny', value: `${money(model.profit)} ◈` },
          { label: 'Przychód', value: `${money(s.journal.revenue)} ◈` },
          {
            label: 'Koszt sprzedanych zapasów i działania',
            value: `${money(s.journal.revenue - model.profit)} ◈`,
          },
          { label: 'Gotówka', value: `${money(model.cash)} ◈` },
          { label: 'Wartość netto', value: `${money(model.netWorth)} ◈` },
          {
            label: 'Paliwo / artykuły',
            value: `${(s.fuelSold / 10).toFixed(1)} L / ${s.articles}`,
          },
          {
            label: 'Zadowolenie / utraceni klienci',
            value: `${Math.round(client.satisfaction)}% / ${s.lost}`,
          },
        ],
        client: client as unknown as JsonValue,
        camera: {
          scrollX: c.scrollX,
          scrollY: c.scrollY,
          zoom: c.zoom,
          width: c.width,
          height: c.height,
        },
        map: {
          width: 4096,
          height: 4096,
          trail: [],
          regions: [
            { x: 0, y: 0, width: 4096, height: 4096, color: '#738f58' },
            {
              x: 96 * 16,
              y: 106 * 16,
              width: 65 * 16,
              height: 47 * 16,
              color: '#9dada3',
            },
            {
              x: 0,
              y: 153 * 16,
              width: 4096,
              height: 14 * 16,
              color: '#465d61',
            },
          ],
          markers: [
            { x: 126 * 16, y: 128 * 16, icon: '◆', color: '#f8d480' },
            ...(d?.motion
              ? [
                  {
                    x: d.motion.x / 16,
                    y: d.motion.y / 16,
                    icon: '▰',
                    color: '#f4e7c5',
                  },
                ]
              : []),
          ],
        },
        stats: {
          ready: this.prepared,
          tick: s.tick,
          seed: s.seed,
          result: s.result ?? '',
          served: s.served,
          profit: model.profit,
          stockE95: s.tanks.e95.quantity,
          stockOn: s.tanks.on.quantity,
          customers: s.customers.length,
          units: bodies(s).length,
          fuelQueue: s.fuelQueue.length,
          checkoutQueue: s.checkoutQueue.length,
          delivery: d?.phase ?? '',
          deliveryReceived: d?.received ?? 0,
          deliveries: s.deliveries,
          thirdPump: s.pumps[2].built,
          cash: model.cash,
          saveVersion: 2,
          maxAdvanceMs: this.maxAdvanceMs,
          navRegions: model.navigator.stats.regions,
          navLocal: model.navigator.stats.maxLocalExpanded,
          terrain: JSON.stringify(this.terrain?.stats ?? {}),
          audioVoices: context.audio.activeVoices,
          duration: model.duration,
          laneExpanded: model.topology.expanded,
          shopMode: s.development?.tenant.phase ?? 'owned',
          tenantTurnover: s.development ? model.lease.turnover : 0,
          tenantDeliveries: s.development?.tenant.deliveries ?? 0,
          leaseIncome:
            s.development?.tenant.settlements.reduce(
              (n, e) => n + e.rent + e.share,
              0,
            ) ?? 0,
          sites: s.development?.sites.length ?? 0,
          roads: s.development?.roads.length ?? 0,
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
      model = new StationModel(world, world.scenario.seed, true);
      if (resume) {
        let result = save.inspect();
        if (result.status === 'absent') result = legacySave.inspect();
        if (result.status === 'ready') model.restore(result.value);
        else if (result.status === 'invalid')
          context.message(
            'Zapis Stacji jest uszkodzony. Rozpoczęto nową zmianę.',
          );
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
