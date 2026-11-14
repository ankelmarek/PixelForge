import { LotBook } from '../../engine/api/strategy';
import type { VineyardState } from './model';
import {
  campaignRules,
  crewCatalog,
  quality,
  netWorth,
  productiveVarieties,
  market,
} from './campaign';
import { varieties, type Variety } from './cultivars';

export function campaignView(s: VineyardState, id?: string) {
  const c = s.campaign;
  if (!c) return null;
  const book = new LotBook(c.book),
    cellar = id ? c.cellars[id] : undefined,
    b = s.buildings.find((b) => b.id === id);
  const bottles = book
    .list(`bottles:${id}`)
    .reduce((n, l) => n + l.quantity, 0);
  return {
    year: c.year,
    bottles: c.bottles,
    goal: campaignRules.bottles,
    quality: quality(s) / 100,
    netWorth: netWorth(s) / 100,
    varieties: productiveVarieties(s),
    debt:
      (c.borrowed -
        c.principalPaid +
        (c.borrowed ? campaignRules.interest - c.interestPaid : 0)) /
      100,
    borrowed: !!c.borrowed,
    loanDue: c.loanDue,
    canRepay:
      c.borrowed > c.principalPaid &&
      s.ledger.balance >=
        c.borrowed - c.principalPaid + campaignRules.interest - c.interestPaid,
    daily:
      (Object.values(c.crew).reduce(
        (n, u) => n + crewCatalog[u.kind].daily,
        0,
      ) +
        s.buildings.length * 300) /
      100,
    warehouse: Object.values(s.warehouse).reduce((n, a) => n + a, 0) / 1000,
    market: market(s.environment!.seed, c.year),
    contracts: c.contracts
      .filter((t) => t.year === c.year)
      .map((t) => ({ ...t })),
    unit: id ? (c.crew[id]?.kind ?? null) : null,
    retiring: id ? (c.crew[id]?.retiring ?? false) : false,
    cellar: cellar
      ? {
          mode: cellar.mode,
          upgrades: { ...cellar.upgrades },
          building: !!b?.work,
          bottles,
          early:
            book.list(`must:${id}`).length + book.list(`wine:${id}`).length > 0,
          process: cellar.process
            ? cellar.process.stage === 'ferment'
              ? `Fermentacja ${cellar.process.reserve ? 'rezerwy' : 'młodego wina'} · ${Math.ceil(cellar.process.remaining / 20)} s`
              : 'Butelkowanie · czeka na pracownika Auto/Prasa'
            : 'Fermentator wolny',
          lots: [
            ...book.list(`bottles:${id}`),
            ...book.list(`wine:${id}`),
            ...book.list(`ferment:${id}`),
            ...book.list(`must:${id}`),
          ]
            .map(
              (l) =>
                `${varieties[l.kind as Variety].name} · rok ${l.vintage} · ${l.resource === 'bottles' ? `${l.quantity} but.` : `${(l.quantity / 1000).toFixed(1)} L ${l.owner.startsWith('ferment:') ? 'fermentuje' : l.resource === 'must' ? 'moszczu' : 'wina'}`} · jakość ${(l.qualityMass / l.quantity / 100).toFixed(0)}`,
            )
            .join('\n'),
        }
      : null,
  };
}
export type CampaignView = ReturnType<typeof campaignView>;
export const campaignMarkup = `
<details class="vineyard-business" data-campaign><summary>◈ Rozwój i finanse</summary>
<p data-campaign-view="goals"></p><p data-campaign-view="finance"></p>
<h3>Ludzie i flota</h3><div class="business-grid">${Object.entries(crewCatalog)
  .map(
    ([id, spec]) =>
      `<button data-hire="${id}" title="Utrzymanie ${spec.daily / 100} ◈/dzień · ${spec.capacity / 1000} kg${spec.radius === 2 ? ' · droga 5 pól' : ''}">${spec.name}<small>${spec.cost / 100} ◈ · ${spec.daily / 100}/dzień</small></button>`,
  )
  .join('')}</div>
<p>Trzeci i kolejne domki: 8000 ◈. Dwa pierwsze z uprawnień.</p>
<h3>Płynność</h3><div class="business-grid"><button data-loan>Pożycz 5000 ◈<small>Spłata 5500 ◈ w ciągu roku</small></button><button data-repay>Spłać pożyczkę</button><button data-grapes>Sprzedaj grona z magazynu<small>10 ◈/kg</small></button></div>
<h3>Kontrakty · premia 25%</h3><small>Brak dostawy do końca roku: 200 ◈. Wybierz jeden kontrakt.</small><div data-campaign-view="contracts"></div>
</details>
<div class="vineyard-cellar" data-campaign-cellar><b data-campaign-view="process"></b><nav>${[
  ['young', 'Młode · 30 s'],
  ['reserve', 'Rezerwa · 90 s · +10 jakości'],
]
  .map(([id, label]) => `<button data-cellar-mode="${id}">${label}</button>`)
  .join('')}</nav><div class="business-grid">${[
  ['press', 'Prasa ×2'],
  ['tank', 'Pojemność ×2'],
  ['control', 'Kontrola · +6 jakości'],
]
  .map(
    ([id, label]) =>
      `<button data-upgrade="${id}">${label}<small>${campaignRules.upgrades[id as keyof typeof campaignRules.upgrades] / 100} ◈</small></button>`,
  )
  .join(
    '',
  )}</div><p data-campaign-view="lots"></p><button data-early>Sprzedaj płynne zapasy taniej</button></div>
<button data-dismiss>Zakończ zatrudnienie / sprzedaj pojazd</button>`;
export function updateCampaign(
  root: HTMLElement,
  c: CampaignView,
  cash: number,
  count: number,
) {
  const get = (id: string) =>
    root.querySelector<HTMLElement>(`[data-campaign-view="${id}"]`)!;
  root.querySelector<HTMLElement>('[data-campaign]')!.hidden = !c;
  root.querySelector<HTMLElement>('[data-campaign-cellar]')!.hidden =
    !c?.cellar;
  root.querySelector<HTMLButtonElement>('[data-dismiss]')!.hidden = !c?.unit;
  root.querySelector<HTMLButtonElement>('[data-dismiss]')!.disabled =
    !!c?.retiring;
  if (!c) return;
  get('goals').textContent =
    `Rok ${c.year}/3 · ${c.bottles}/${c.goal} butelek · jakość ${c.quality.toFixed(0)}/65 · ${c.varieties}/2 szczepy z plonem w roku 3`;
  get('finance').textContent =
    `Utrzymanie ${c.daily} ◈/dzień · dług ${c.debt} ◈ · wartość netto ${Math.floor(c.netWorth)} ◈ · rynek ${c.market}%`;
  for (const button of Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-hire]'),
  ))
    button.disabled =
      count >= 24 ||
      cash < crewCatalog[button.dataset.hire as keyof typeof crewCatalog].cost;
  root.querySelector<HTMLButtonElement>('[data-loan]')!.disabled = c.borrowed;
  root.querySelector<HTMLButtonElement>('[data-repay]')!.disabled = !c.canRepay;
  root.querySelector<HTMLButtonElement>('[data-grapes]')!.disabled =
    c.warehouse <= 0;
  const contracts = get('contracts');
  const signature = c.contracts
    .map((t) => `${t.id}:${t.status}:${t.delivered}`)
    .join('/');
  if (contracts.dataset.signature !== signature) {
    contracts.dataset.signature = signature;
    contracts.replaceChildren();
    for (const t of c.contracts) {
      const button = document.createElement('button');
      button.dataset.contract = t.id;
      button.textContent = `${t.name} · ${t.delivered}/${t.required} but. · jakość ${t.quality / 100}+ · ${{ offered: 'Przyjmij', active: 'W realizacji', done: 'Wykonany', missed: 'Termin minął' }[t.status]}`;
      button.disabled =
        t.status !== 'offered' ||
        c.contracts.some((t) => t.status !== 'offered');
      contracts.append(button);
    }
  }
  if (c.cellar) {
    get('process').textContent = c.cellar.process;
    get('lots').textContent = c.cellar.lots || 'Brak partii';
    for (const button of Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-cellar-mode]'),
    ))
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.cellarMode === c.cellar.mode),
      );
    for (const button of Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-upgrade]'),
    )) {
      const id = button.dataset.upgrade as keyof typeof campaignRules.upgrades;
      button.disabled =
        c.cellar.building ||
        c.cellar.upgrades[id] ||
        cash < campaignRules.upgrades[id];
      button.setAttribute('aria-pressed', String(c.cellar.upgrades[id]));
    }
    root.querySelector<HTMLButtonElement>('[data-early]')!.disabled =
      !c.cellar.early;
  }
}
