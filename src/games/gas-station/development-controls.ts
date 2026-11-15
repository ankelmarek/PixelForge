import { PARCELS } from './development';
import { FUELS, GOODS, prices } from './world';
import { money } from './controls';
export interface DevelopmentUI {
  prices: Record<string, number>;
  priority: string;
  owned: string[];
  canHire: boolean;
  secondCheckout: boolean;
  leaseOffer: boolean;
  shopMode: string;
  contract: string;
  termination: boolean;
  turnover: number;
  leaseIncome: number;
  tenantStock: number;
  tenantDeliveries: number;
  build: {
    kind: string;
    valid: boolean;
    reason: string;
    cost: number;
    revision: number;
    rotation: number;
  } | null;
}
export function developmentControls(
  root: HTMLElement,
  action: (a: string, p?: string | number | boolean) => void,
) {
  const get = <T extends HTMLElement = HTMLElement>(q: string) =>
    root.querySelector<T>(q)!;
  get('[data-st-panel="build"]').insertAdjacentHTML(
    'beforeend',
    `<div data-development><h3>Działki</h3><div class="station-parcels">${PARCELS.slice(
      1,
    )
      .map(
        (p) =>
          `<button data-parcel="${p.id}">${({ west: 'Zachód', north: 'Północ', east: 'Wschód' } as Record<string, string>)[p.id]} <small>${money(p.price)} ◈</small></button>`,
      )
      .join('')}</div><h3>Projekt</h3><div class="station-tools">${[
      ['road', '↗', 'Droga · 5 ◈/pole'],
      ['pump', '⛽', 'Pompa · 1 800 ◈'],
      ['heavy-pump', '▰', 'Duże ON · 2 400 ◈'],
      ['parking', 'P', 'Parking · 200 ◈'],
      ['tank', '◉', 'Zbiornik · 1 200 ◈'],
      ['remove-road', '⌫', 'Usuń drogę'],
    ]
      .map(
        ([id, icon, label]) =>
          `<button data-project="${id}"><b>${icon}</b><span>${label}</span></button>`,
      )
      .join(
        '',
      )}</div><div data-project-controls hidden><div class="station-actions"><button data-project-rotate aria-label="Obróć projekt">↻</button><button data-project-fuel>E95</button><button data-project-confirm>✓</button><button data-project-cancel aria-label="Anuluj projekt">×</button></div><output data-project-summary></output></div></div>`,
  );
  get('[data-st-panel="crew"]').insertAdjacentHTML(
    'beforeend',
    `<div data-development><button class="station-wide" data-hire>＋ Pracownik <span>100 ◈</span></button><small>10 ◈ / min · maks. 4 pracowników ORLAR</small><h3>Priorytet podjazdu</h3><div class="station-actions"><button data-priority="customers">Klienci</button><button data-priority="deliveries">Dostawy</button></div></div>`,
  );
  get('[data-st-panel="shop"]').insertAdjacentHTML(
    'beforeend',
    `<div data-development><button class="station-wide" data-second-checkout>＋ Druga kasa <span>900 ◈</span></button><div class="station-price-list">${GOODS.map((k) => priceRow(k)).join('')}</div><h3>Lokal · Skoczka</h3><div class="station-lease"><p data-lease-mode></p><div data-lease-offer><div class="station-actions"><button data-lease="fixed">Stała<small>120 ◈ / zmianę</small></button><button data-lease="share">Partnerska<small>50 ◈ + 8% obrotu</small></button></div><small>Od drugiej zmiany · do końca kolejnej zmiany. Przejęcie 20 s po zamknięciu własnych koszyków.</small></div><div data-lease-active hidden><p data-lease-finances></p><button data-lease-end>Rozwiązanie umowy</button><small>Na granicy zmiany · kara 100 ◈ · bez ponownego najmu</small></div></div></div>`,
  );
  get('[data-st-panel="fuel"]').insertAdjacentHTML(
    'beforeend',
    `<div data-development><h3>Ceny detaliczne</h3>${FUELS.map((k) => priceRow(k)).join('')}</div>`,
  );
  function priceRow(k: string) {
    return `<div class="station-price"><span>${prices[k as keyof typeof prices].label}</span><button data-price="${k}" data-delta="-20" aria-label="Obniż cenę ${k}">−</button><b data-price-value="${k}"></b><button data-price="${k}" data-delta="20" aria-label="Podnieś cenę ${k}">＋</button></div>`;
  }
  let current: DevelopmentUI | undefined;
  const projectControls = get('[data-project-controls]');
  root.append(projectControls);
  function click(e: Event) {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || b.disabled || !current) return;
    const d = b.dataset;
    if (d.parcel) action('parcel', d.parcel);
    if (d.project) action('project', d.project);
    if ('projectRotate' in d) action('project-rotate');
    if ('projectFuel' in d) {
      b.textContent = b.textContent === 'E95' ? 'ON' : 'E95';
      action('project-fuel', b.textContent === 'ON' ? 'on' : 'e95');
    }
    if ('projectConfirm' in d)
      action('project-commit', current.build?.revision);
    if ('projectCancel' in d) action('project-cancel');
    if ('hire' in d) action('hire');
    if ('secondCheckout' in d) action('second-checkout');
    if (d.priority) action('priority', d.priority);
    if (d.price)
      action(`price-${d.price}`, current.prices[d.price] + Number(d.delta));
    if (d.lease) action('lease', d.lease);
    if ('leaseEnd' in d) action('lease-end');
  }
  root.addEventListener('click', click);
  return {
    update(v: DevelopmentUI | undefined, cash: number) {
      current = v;
      root
        .querySelectorAll<HTMLElement>('[data-development]')
        .forEach((e) => (e.hidden = !v));
      if (!v) return;
      for (const p of PARCELS.slice(1)) {
        const b = get<HTMLButtonElement>(`[data-parcel="${p.id}"]`);
        b.disabled = v.owned.includes(p.id) || cash < p.price;
        b.setAttribute('aria-pressed', String(v.owned.includes(p.id)));
      }
      get<HTMLButtonElement>('[data-hire]').disabled = !v.canHire;
      get<HTMLButtonElement>('[data-second-checkout]').disabled =
        v.secondCheckout || cash < 90000;
      root
        .querySelectorAll<HTMLElement>('[data-priority]')
        .forEach((b) =>
          b.setAttribute(
            'aria-pressed',
            String(b.dataset.priority === v.priority),
          ),
        );
      for (const k of GOODS)
        get(`[data-own-price="${k}"]`).textContent =
          `${(v.prices[k] / 100).toFixed(2)} ◈`;
      for (const k of [...FUELS, ...GOODS]) {
        get(`[data-price-value="${k}"]`).textContent = (
          v.prices[k] / 100
        ).toFixed(2);
        root
          .querySelectorAll<HTMLButtonElement>(`[data-price="${k}"]`)
          .forEach(
            (b) =>
              (b.disabled =
                GOODS.includes(k as (typeof GOODS)[number]) &&
                v.shopMode !== 'owned'),
          );
      }
      get('[data-lease-mode]').textContent = (
        {
          owned: 'Własny sklep ORLAR',
          closing: 'Zamknięcie bieżących koszyków',
          refitting: 'Przebudowa lokalu',
          leased: 'Skoczka · ' + v.contract,
          returning: 'Zamknięcie koszyków najemcy',
          restoring: 'Przebudowa · własny sklep',
        } as Record<string, string>
      )[v.shopMode];
      get('[data-lease-offer]').hidden = v.shopMode !== 'owned';
      root
        .querySelectorAll<HTMLButtonElement>('[data-lease]')
        .forEach((b) => (b.disabled = !v.leaseOffer));
      get('[data-lease-active]').hidden = v.shopMode !== 'leased';
      get('[data-lease-finances]').textContent =
        `Obrót najemcy ${money(v.turnover)} ◈ · czynsz i udział ${money(v.leaseIncome)} ◈ · ${v.tenantStock} szt. · ${v.tenantDeliveries} dostaw`;
      get('[data-lease-end]').setAttribute(
        'aria-pressed',
        String(v.termination),
      );
      get('[data-project-controls]').hidden = !v.build;
      if (v.build) {
        get('[data-project-summary]').textContent =
          `${money(v.build.cost)} ◈ · ${v.build.valid ? '✓' : v.build.reason}`;
        get<HTMLButtonElement>('[data-project-confirm]').disabled =
          !v.build.valid;
        get<HTMLButtonElement>('[data-project-rotate]').disabled = [
          'road',
          'remove-road',
          'tank',
        ].includes(v.build.kind);
      }
      root
        .querySelectorAll<HTMLElement>('[data-project]')
        .forEach((b) =>
          b.setAttribute(
            'aria-pressed',
            String(b.dataset.project === v.build?.kind),
          ),
        );
    },
    destroy() {
      root.removeEventListener('click', click);
    },
  };
}
