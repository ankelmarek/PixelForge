import type { StationModel } from './model';
import { WASH_UNLOCK, activeEvent, debt, shiftIndex } from './campaign-data';
import { money } from './controls';
import { scenarios, darkness } from './scenarios';

const labels = {
  rain: 'Deszcz',
  fault: 'Awaria dystrybutora',
  wholesale: 'Hurt +20%',
  tourists: 'Autokar turystów',
  trucks: 'Konwój 3 ciężarówek',
  discount: 'Oferta hurtowni −15%',
};
export function campaignUI(m: StationModel) {
  const s = m.state,
    c = s.campaign;
  if (!c) return undefined;
  const e = c.event;
  return {
    variant: c.scenario ? scenarios[c.scenario.variant].name : 'Wielki Weekend',
    seed: s.seed,
    goal: m.goal,
    staffRate: c.scenario?.variant === 'night' ? 1250 : 1000,
    scenario: !!c.scenario,
    lights: c.scenario?.lights ?? false,
    energy: c.scenario?.energyCharged ?? 0,
    darkness: darkness(s),
    shift: ['PIĄTEK', 'SOBOTA', 'NIEDZIELA'][shiftIndex(s)],
    event: e ? labels[e.kind] : '',
    upcoming: !!e && s.tick < e.start,
    eventSeconds: e
      ? Math.max(
          0,
          Math.ceil(((s.tick < e.start ? e.start : e.end) - s.tick) / 20),
        )
      : 0,
    fault: c.fault?.pump ?? -1,
    canRepair: !!c.fault && !c.fault.repair && m.cash >= 12000,
    repairProgress: c.fault?.progress ?? 0,
    repairing: c.fault?.repair ?? false,
    canDiscount: activeEvent(s, 'discount') && !c.event!.accepted,
    discount: activeEvent(s, 'discount') && c.event!.accepted,
    canRescue: !c.rescue.taken,
    debt: debt(s),
    warning:
      c.warningSince < 0
        ? 0
        : Math.max(0, 120 - Math.floor((s.tick - c.warningSince) / 20)),
    washUnlocked: s.journal.revenue >= WASH_UNLOCK,
    washes: c.wash.completed,
    washQueue: c.wash.queue.length,
    washProgress: c.wash.progress,
    sites: s.development!.sites.map((p) => ({
      id: p.id,
      kind: p.kind,
      resale: Math.floor(p.cost * 0.6),
      blocked: m.weekend.canSell(p.id),
    })),
  };
}
export type CampaignUI = NonNullable<ReturnType<typeof campaignUI>>;

export function campaignControls(
  root: HTMLElement,
  action: (a: string, p?: string | number | boolean) => void,
) {
  const get = <T extends HTMLElement = HTMLElement>(q: string) =>
    root.querySelector<T>(q)!;
  get('.station-tabs').insertAdjacentHTML(
    'beforeend',
    '<button data-st-tab="weekend" data-weekend hidden><b>◷</b><span>Weekend</span></button>',
  );
  get('.station-panel').insertAdjacentHTML(
    'beforeend',
    `<section data-st-panel="weekend" hidden>
    <h3 data-weekend-variant>Wielki Weekend</h3><small data-weekend-seed></small><p data-weekend-goal></p>
    <div data-weekend-lighting hidden><button data-lights class="station-wide">☼ Oświetlenie</button><small>20 ◈ / min po zmroku · obsada nocnej zmiany +25%</small><p data-weekend-energy></p></div>
    <h3 data-weekend-event></h3><div class="station-actions"><button data-repair hidden>⚒ Naprawa <small>120 ◈ · 15 s</small></button><button data-discount hidden>Oferta −15% <small>Jedna cysterna 400 L</small></button></div>
    <p data-weekend-repair></p><h3>Rezerwa finansowa</h3><button data-rescue class="station-wide">＋ 1 500 ◈<small>Jednorazowo · spłata 1 650 ◈ w finale</small></button><p data-weekend-debt></p>
    <h3>Myjnia</h3><p data-weekend-wash></p><h3>Odsprzedaż rozszerzeń</h3><div data-weekend-sites></div>
  </section>`,
  );
  get('.station-inventory').insertAdjacentHTML(
    'afterend',
    '<button class="station-event" data-st-tab="weekend" hidden><b data-event-name></b><span data-event-time></span></button>',
  );
  get('.station-tools').insertAdjacentHTML(
    'beforeend',
    '<button data-project="wash" data-weekend hidden><b>≋</b><span>Myjnia · 2 500 ◈</span></button>',
  );
  let sites = '';
  function click(e: Event) {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    if ('repair' in d) action('repair');
    if ('discount' in d) action('discount');
    if ('rescue' in d) action('rescue');
    if ('lights' in d) action('lights');
    if (d.sell) action('sell', d.sell);
  }
  root.addEventListener('click', click);
  return {
    update(v?: CampaignUI) {
      root
        .querySelectorAll<HTMLElement>('[data-weekend]')
        .forEach((e) => (e.hidden = !v));
      if (!v) {
        get('.station-event').hidden = true;
        return;
      }
      const event = v.warning ? 'Brak płynności' : v.event;
      get('[data-weekend-variant]').textContent = v.variant;
      get('[data-weekend-seed]').textContent = `Weekend ${v.seed}`;
      get('[data-weekend-goal]').textContent =
        `${v.goal} klientów · 70% zadowolenia · majątek > 0`;
      get('[data-weekend-lighting]').hidden = !v.scenario;
      get('[data-lights]').setAttribute('aria-pressed', String(v.lights));
      get('[data-lights]').textContent =
        `☼ Oświetlenie · ${v.lights ? 'włączone' : 'wyłączone'}`;
      get('[data-weekend-energy]').textContent = `Energia ${money(v.energy)} ◈`;
      get('.station-event').hidden = !event;
      get('.station-event').classList.toggle(
        'critical',
        v.fault >= 0 || !!v.warning,
      );
      get('[data-event-name]').textContent = event;
      get('[data-event-time]').textContent = v.warning
        ? `${v.warning} s`
        : `${v.upcoming ? 'za ' : ''}${v.eventSeconds} s`;
      get('[data-weekend-event]').textContent = v.event || 'Spokojny ruch';
      get('[data-repair]').hidden = v.fault < 0;
      get<HTMLButtonElement>('[data-repair]').disabled = !v.canRepair;
      get('[data-weekend-repair]').textContent = v.repairing
        ? `Naprawa · ${Math.floor(v.repairProgress / 3)}%`
        : v.fault >= 0
          ? `Dystrybutor ${v.fault + 1} · serwis gwarancyjny ${v.eventSeconds} s`
          : '';
      get('[data-discount]').hidden = !v.canDiscount && !v.discount;
      get<HTMLButtonElement>('[data-discount]').disabled = !v.canDiscount;
      get<HTMLButtonElement>('[data-rescue]').disabled = !v.canRescue;
      get('[data-weekend-debt]').textContent =
        `Zobowiązanie ${money(v.debt)} ◈`;
      get('[data-weekend-wash]').textContent = v.washUnlocked
        ? `Umyte auta ${v.washes} · kolejka ${v.washQueue}/3 · mycie ${Math.floor(v.washProgress / 5)}%`
        : 'Przychód wymagany do inwestycji: 1 500 ◈';
      get<HTMLButtonElement>('[data-project="wash"]').disabled =
        !v.washUnlocked;
      const rows = JSON.stringify(v.sites);
      if (rows !== sites) {
        sites = rows;
        const list = get('[data-weekend-sites]');
        list.replaceChildren();
        for (const p of v.sites) {
          const b = document.createElement('button');
          b.className = 'station-wide';
          b.dataset.sell = p.id;
          b.disabled = !!p.blocked;
          const name = (
            {
              pump: 'Pompa',
              'heavy-pump': 'Duże ON',
              parking: 'Parking',
              tank: 'Zbiornik',
              wash: 'Myjnia',
            } as Record<string, string>
          )[p.kind];
          b.textContent = `${name} · ${p.blocked || `${money(p.resale)} ◈`}`;
          list.append(b);
        }
      }
    },
    destroy() {
      root.removeEventListener('click', click);
    },
  };
}
