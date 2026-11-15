import type { ClientDefinition, Snapshot } from '../../engine/api';
import { FUELS, GOODS, prices } from './world';
import {
  developmentControls,
  type DevelopmentUI,
} from './development-controls';
export interface StationUI {
  cash: number;
  profit: number;
  netWorth: number;
  revenue: number;
  costs: number;
  seconds: number;
  speed: number;
  served: number;
  goal: number;
  satisfaction: number;
  tanks: {
    fuel: string;
    quantity: number;
    reserved: number;
    can200: boolean;
    can400: boolean;
    capacity: number;
  }[];
  goods: { product: string; quantity: number }[];
  canGoods: boolean;
  workers: { id: string; role: string; job: string; busy: boolean }[];
  pumps: { id: string; built: boolean; open: boolean; busy: boolean }[];
  delivery: {
    id: string;
    label: string;
    phase: string;
    received: number;
    total: number;
    canCancel: boolean;
  } | null;
  plan: { valid: boolean; reason: string; cost: number; revision: number };
  building: boolean;
  buildMode: boolean;
  selection: string;
  label: string;
  detail: string;
  hint: string;
  ready: boolean;
  duration: number;
  development?: DevelopmentUI;
}
export const money = (n: number) =>
  new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(n / 100);
export const createControls: NonNullable<
  ClientDefinition['createControls']
> = ({ root, send }) => {
  root.classList.add('station-ui');
  root.innerHTML = `<header class="station-ledger"><div class="station-brand">ORLAR <small>PIERWSZA ZMIANA</small></div><div><small>GOTÓWKA ◈</small><strong data-sv="cash"></strong></div><div><small>ZYSK ◈</small><strong data-sv="profit"></strong></div><div class="station-goal"><small>KLIENCI</small><strong data-sv="goal"></strong><progress max="12" value="0"></progress></div><div><small>ZMIANA</small><strong data-sv="time"></strong></div><nav aria-label="Tempo zmiany">${[1, 2, 4].map((n) => `<button data-st-speed="${n}" aria-label="Tempo ${n}">${n}×</button>`).join('')}</nav></header>
  <div class="station-inventory">${FUELS.map((f) => `<button data-st-tab="fuel" data-st-gauge="${f}"><b>${prices[f].label}</b><meter min="0" max="1000" low="80" optimum="600" value="0"></meter><span>0 L</span></button>`).join('')}<span class="station-rating" data-sv="rating"></span></div>
  <nav class="station-tabs" aria-label="Zarządzanie stacją">${[
    ['fuel', '⛽', 'Paliwo'],
    ['shop', '▣', 'Sklep'],
    ['crew', '♟', 'Załoga'],
    ['build', '＋', 'Rozbudowa'],
  ]
    .map(
      ([id, icon, label]) =>
        `<button data-st-tab="${id}" aria-pressed="false"><b>${icon}</b><span>${label}</span></button>`,
    )
    .join('')}</nav>
  <aside class="station-panel" hidden><div class="station-panel-head"><strong data-sv="panel-title"></strong><button data-st-close aria-label="Zamknij panel">×</button></div>
  <section data-st-panel="fuel">${FUELS.map((f) => `<div class="station-stock"><h3>${prices[f].label} <span data-st-stock="${f}"></span></h3><small data-st-reserved="${f}"></small><div class="station-actions">${[200, 400].map((n) => `<button data-st-order="${f}" data-litres="${n}">${n} L <small>${money(n * prices[f].buy + 8000)} ◈</small></button>`).join('')}</div></div>`).join('')}<small>Transport 80 ◈</small></section>
  <section data-st-panel="shop" hidden><h3>Magazyn ORLAR</h3><div class="station-products">${GOODS.map((k) => `<div><span>${prices[k].label}</span><b data-st-good="${k}"></b><small data-own-price="${k}">${prices[k].sell / 100} ◈</small></div>`).join('')}</div><button class="station-wide" data-st-goods>▣ 30 szt. <span>130 ◈</span></button><small>10 × napój / przekąska / kawa · magazyn 80 szt.</small></section>
  <section data-st-panel="crew" hidden>${[0, 1, 2, 3].map((i) => `<div class="station-worker"><div><button data-st-worker="${i}" aria-label="Pracownik ${i + 1}">♟ ${i + 1}</button><span data-st-job="${i}"></span></div><div class="station-actions"><button data-st-role="forecourt" data-worker="${i}">Podjazd</button><button data-st-role="checkout" data-worker="${i}">Kasa</button></div></div>`).join('')}<small>Wynagrodzenie 10 ◈ / osoba / min</small></section>
  <section data-st-panel="build" hidden><div class="station-build-art">⛽ <b>03</b></div><h3>Trzeci dystrybutor</h3><button class="station-wide" data-st-preview>＋ <span>1 800 ◈</span></button><div class="station-actions" data-st-confirm-area hidden><button data-st-commit>✓ 1 800 ◈</button><button data-st-cancel aria-label="Anuluj rozbudowę">×</button></div><output data-sv="plan"></output></section>
  <section data-st-panel="selection" hidden><h3 data-sv="label"></h3><p data-sv="detail"></p><button data-st-toggle-pump hidden></button></section>
  <div class="station-delivery" hidden><div><b data-sv="delivery"></b><button data-st-delivery-focus aria-label="Dostawa na mapie">⌖</button><button data-st-cancel-delivery aria-label="Anuluj dostawę">×</button></div><span data-sv="delivery-phase"></span><progress max="1" value="0"></progress></div>
  <output data-sv="hint" role="status"></output>
  <details class="station-mix"><summary>♫ Dźwięk</summary>${[
    ['music', 'Muzyka', 0.7],
    ['ambience', 'Otoczenie', 0.35],
    ['effects', 'Efekty', 0.8],
  ]
    .map(
      ([id, label, v]) =>
        `<label>${label}<input type="range" min="0" max="1" step="0.05" value="${v}" data-st-mix="${id}" aria-label="${label}"></label>`,
    )
    .join('')}</details></aside>`;
  let current: StationUI | undefined,
    tab = '';
  const get = <T extends HTMLElement = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const show = (next: string) => {
    tab = next;
    get('.station-panel').hidden = !tab;
    root
      .querySelectorAll<HTMLElement>('[data-st-panel]')
      .forEach((e) => (e.hidden = e.dataset.stPanel !== tab));
    root
      .querySelectorAll<HTMLElement>('.station-tabs [data-st-tab]')
      .forEach((e) =>
        e.setAttribute('aria-pressed', String(e.dataset.stTab === tab)),
      );
    get('[data-sv="panel-title"]').textContent =
      (
        {
          fuel: 'ZAPASY',
          shop: 'SKLEP I NAJEM',
          crew: 'ZAŁOGA',
          build: 'ROZBUDOWA',
          selection: 'NA STACJI',
        } as Record<string, string>
      )[tab] ?? '';
  };
  const action = (action: string, payload?: string | number | boolean) =>
    send({ type: 'client-action', action, payload });
  const development = developmentControls(root, action);
  const click = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.project) show('');
    if (d.stTab) {
      show(tab === d.stTab ? '' : d.stTab);
      return;
    }
    if ('stClose' in d) {
      show('');
      action('build-cancel');
      return;
    }
    if (d.stSpeed) action('speed', Number(d.stSpeed));
    if (d.stOrder) action(`order-${d.stOrder}`, Number(d.litres));
    if ('stGoods' in d) action('order-goods');
    if (d.stRole) action(`role-${d.worker}`, d.stRole);
    if (d.stWorker) action('select', `worker-${Number(d.stWorker) + 1}`);
    if ('stPreview' in d) action('build-preview');
    if ('stCommit' in d) action('build', current?.plan.revision);
    if ('stCancel' in d) action('build-cancel');
    if ('stTogglePump' in d)
      action('pump', Number(current?.selection.split('-')[1]));
    if ('stCancelDelivery' in d)
      action('cancel-delivery', current?.delivery?.id);
    if ('stDeliveryFocus' in d) action('delivery-focus');
  };
  const input = (e: Event) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.stMix) action(`mix-${el.dataset.stMix}`, Number(el.value));
  };
  const prevent = (e: Event) => {
    if ((e.target as HTMLElement).closest('button')) e.preventDefault();
  };
  root.addEventListener('click', click);
  root.addEventListener('input', input);
  root.addEventListener('pointerdown', prevent);
  const text = (key: string, value: string) => {
    get(`[data-sv="${key}"]`).textContent = value;
  };
  const disabled = (selector: string, value: boolean) => {
    get<HTMLButtonElement>(selector).disabled = value;
  };
  return {
    update(snapshot: Snapshot) {
      const v = snapshot.client as unknown as StationUI;
      if (!v) return;
      if (v.selection && v.selection !== current?.selection) show('selection');
      current = v;
      development.update(v.development, v.cash);
      get('.station-brand small').textContent = v.development
        ? 'ROZBUDOWA'
        : 'PIERWSZA ZMIANA';
      text('cash', money(v.cash));
      text('profit', `${v.profit >= 0 ? '+' : ''}${money(v.profit)}`);
      get('[data-sv="profit"]').classList.toggle('negative', v.profit < 0);
      text('goal', `${v.served} / ${v.goal}`);
      get<HTMLProgressElement>('.station-goal progress').value = v.served;
      get<HTMLProgressElement>('.station-goal progress').max = v.goal;
      text(
        'time',
        `${Math.floor(v.seconds / 60)}:${String(Math.floor(v.seconds % 60)).padStart(2, '0')} / ${v.duration / 1200}:00`,
      );
      text('rating', `${Math.round(v.satisfaction)}% ♡`);
      root
        .querySelectorAll<HTMLElement>('[data-st-speed]')
        .forEach((e) =>
          e.setAttribute(
            'aria-pressed',
            String(Number(e.dataset.stSpeed) === v.speed),
          ),
        );
      for (const t of v.tanks) {
        const b = get(`[data-st-gauge="${t.fuel}"]`);
        b.querySelector('span')!.textContent =
          `${Math.floor(t.quantity / 10)} L`;
        b.querySelector('meter')!.value = t.quantity / 10;
        b.querySelector('meter')!.max = t.capacity / 10;
        b.classList.toggle('low', t.quantity < 800);
        get(`[data-st-stock="${t.fuel}"]`).textContent =
          `${(t.quantity / 10).toFixed(1)} / ${t.capacity / 10} L`;
        get(`[data-st-reserved="${t.fuel}"]`).textContent =
          `Rezerwacja ${(t.reserved / 10).toFixed(1)} L`;
        disabled(`[data-st-order="${t.fuel}"][data-litres="200"]`, !t.can200);
        disabled(`[data-st-order="${t.fuel}"][data-litres="400"]`, !t.can400);
      }
      for (const g of v.goods)
        get(`[data-st-good="${g.product}"]`).textContent = String(g.quantity);
      disabled('[data-st-goods]', !v.canGoods);
      root
        .querySelectorAll<HTMLElement>('.station-worker')
        .forEach((e, i) => (e.hidden = i >= v.workers.length));
      v.workers.forEach((w, i) => {
        get(`[data-st-job="${i}"]`).textContent = w.job;
        root
          .querySelectorAll<HTMLButtonElement>(`[data-worker="${i}"]`)
          .forEach((b) => {
            b.disabled = w.busy;
            b.setAttribute('aria-pressed', String(b.dataset.stRole === w.role));
          });
      });
      get('[data-st-confirm-area]').hidden = !v.buildMode;
      get('[data-st-preview]').hidden = v.buildMode || v.building;
      disabled('[data-st-commit]', !v.plan.valid);
      text(
        'plan',
        v.building
          ? 'Stanowisko 03 · realizacja'
          : v.buildMode
            ? v.plan.reason
            : '',
      );
      text('label', v.label);
      text('detail', v.detail);
      text('hint', v.hint);
      const pump = v.pumps.find((p) => p.id === v.selection),
        toggle = get<HTMLButtonElement>('[data-st-toggle-pump]');
      toggle.hidden = !pump?.built;
      toggle.textContent = pump?.open
        ? 'Ⅱ Zamknij stanowisko'
        : '▶ Otwórz stanowisko';
      get('.station-delivery').hidden = !v.delivery;
      if (v.delivery) {
        text('delivery', v.delivery.label);
        text('delivery-phase', v.delivery.phase);
        get<HTMLProgressElement>('.station-delivery progress').value =
          v.delivery.received / v.delivery.total;
        disabled('[data-st-cancel-delivery]', !v.delivery.canCancel);
      }
    },
    destroy() {
      development.destroy();
      root.removeEventListener('click', click);
      root.removeEventListener('input', input);
      root.removeEventListener('pointerdown', prevent);
      root.innerHTML = '';
      root.classList.remove('station-ui');
    },
  };
};
