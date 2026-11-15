import type Phaser from 'phaser';
import type { ClientContext, ClientDefinition } from '../../engine/api';
import type { StationModel } from './model';
import { activeEvent, shiftIndex } from './campaign-data';
import { isNight } from './scenarios';
import { UNIT, TILE } from './world';

/** Event-driven client score/foley, with distance gain and no private audio context. */
export class StationSounds {
  private elapsed = 0;
  private entries: number;
  private tenantSales: number;
  private delivery = false;
  private event = -1;
  private door = false;
  private theme = '';
  private fault = false;
  private construction = 0;
  private moving = new Map<string, boolean>();
  constructor(
    private model: StationModel,
    private audio: ClientContext['audio'],
    private music: ClientDefinition['music'],
  ) {
    this.entries = model.state.journal.entries.length;
    this.tenantSales = model.state.development?.tenant.sales.length ?? 0;
    this.delivery = !!model.state.delivery;
    this.event = model.state.campaign?.event?.id ?? -1;
    this.fault = !!model.state.campaign?.fault;
    this.construction = this.built();
  }
  private built() {
    return (
      this.model.state.pumps.filter((p) => p.built).length +
      (this.model.state.development?.sites.filter((p) => !p.progress).length ??
        0)
    );
  }
  update(delta: number, camera: Phaser.Cameras.Scene2D.Camera) {
    const s = this.model.state;
    if (s.result) return;
    const night = isNight(s),
      shift = shiftIndex(s);
    const theme = night ? 'night' : String(shift);
    if (this.theme !== theme) {
      this.theme = theme;
      if (this.music)
        this.audio.music(
          night
            ? {
                notes: [
                  36, 0, 55, 60, 0, 57, 0, 52, 41, 0, 60, 64, 0, 55, 0, 48,
                ],
                beatSeconds: 0.62,
                volume: 0.007,
              }
            : { ...this.music, beatSeconds: shift === 2 ? 0.42 : 0.48 },
        );
    }
    const origin = camera.getWorldPoint(0, 0),
      cx = origin.x + camera.width / camera.zoom / 2,
      cy = origin.y + camera.height / camera.zoom / 2;
    const gain = (x: number, y: number) =>
      Math.max(0, 1 - Math.hypot(x - cx, y - cy) / (900 / camera.zoom));
    const shop = gain(124 * TILE, 112 * TILE);
    const tone = (
      frequency: number,
      end: number,
      volume: number,
      duration = 0.18,
    ) => {
      if (volume > 0.0005)
        this.audio.cue({ frequency, end, duration, volume, type: 'triangle' });
    };
    const entries = s.journal.entries.slice(this.entries);
    this.entries = s.journal.entries.length;
    const tenantSales = s.development?.tenant.sales.length ?? 0;
    const tenantReceipt = tenantSales > this.tenantSales;
    this.tenantSales = tenantSales;
    // A frame may complete multiple visits at ×4; one receipt cue suffices.
    if (tenantReceipt || entries.some((e) => e.category === 'checkout')) {
      tone(1320, 1760, 0.022 * shop, 0.12);
      if (s.customers.some((c) => c.bought && c.basket.coffee))
        this.audio.noise(
          { color: 'white', duration: 0.25, volume: 0.009 * shop },
          'effects',
        );
    }
    if (entries.some((e) => e.category === 'wash-sale'))
      tone(660, 990, 0.018 * gain(84 * TILE, 118 * TILE));
    const event = s.campaign?.event?.id ?? -1;
    if (event >= 0 && event !== this.event) tone(440, 660, 0.018, 0.24);
    this.event = event;
    const delivery = !!s.delivery;
    if (delivery !== this.delivery)
      tone(
        delivery ? 76 : 60,
        delivery ? 60 : 110,
        0.012 * gain(144 * TILE, 110 * TILE),
        0.4,
      );
    this.delivery = delivery;
    const fault = !!s.campaign?.fault;
    if (fault !== this.fault) {
      tone(fault ? 240 : 660, fault ? 140 : 880, 0.025 * shop);
      this.fault = fault;
    }
    const built = this.built();
    if (built > this.construction) tone(520, 1040, 0.025 * shop, 0.3);
    this.construction = built;
    const door = s.customers.some(
      (c) =>
        c.driver &&
        Math.hypot(c.driver.x / UNIT - 124, c.driver.y / UNIT - 113) < 5,
    );
    if (door && !this.door) tone(880, 1040, 0.012 * shop, 0.09);
    this.door = door;
    this.elapsed += delta;
    if (this.elapsed < 650) return;
    this.elapsed %= 650;
    const wash = s.customers.find((c) => c.phase === 'washing');
    const pump = s.customers.find((c) => c.phase === 'fueling');
    const road = s.customers.find(
      (c) =>
        c.vehicle.route.length &&
        gain(c.vehicle.x / 16, c.vehicle.y / 16) > 0.25,
    );
    if (wash)
      this.audio.noise({
        color: 'brown',
        duration: 0.6,
        volume: 0.035 * gain(wash.vehicle.x / 16, wash.vehicle.y / 16),
      });
    else if (road)
      this.audio.cue(
        {
          frequency: 78,
          end: 62,
          duration: 0.5,
          volume: 0.009 * gain(road.vehicle.x / 16, road.vehicle.y / 16),
          type: 'triangle',
        },
        'ambience',
      );
    else
      this.audio.cue(
        {
          frequency: night ? 2300 : 1650,
          end: night ? 2100 : 2400,
          duration: 0.14,
          volume: 0.003,
        },
        'ambience',
      );
    this.audio.noise({
      color: activeEvent(s, 'rain') ? 'white' : 'brown',
      duration: 0.6,
      volume: activeEvent(s, 'rain') ? 0.012 : 0.006,
    });
    if (pump)
      tone(
        112,
        100,
        0.007 * gain(pump.vehicle.x / 16, pump.vehicle.y / 16),
        0.3,
      );
    if (s.delivery?.phase === 'unloading')
      this.audio.noise(
        {
          color: 'brown',
          duration: 0.5,
          volume: 0.014 * gain(144 * TILE, 110 * TILE),
        },
        'effects',
      );
    let heard = false;
    for (const c of s.customers) {
      const moving = !!c.vehicle.route.length;
      if (this.moving.has(c.id) && this.moving.get(c.id) !== moving && !heard) {
        const v = 0.008 * gain(c.vehicle.x / 16, c.vehicle.y / 16);
        if (v > 0.001) {
          tone(moving ? 65 : 95, moving ? 120 : 55, v, 0.3);
          heard = true;
        }
      }
      this.moving.set(c.id, moving);
    }
    for (const id of this.moving.keys())
      if (!s.customers.some((c) => c.id === id)) this.moving.delete(id);
  }
}
