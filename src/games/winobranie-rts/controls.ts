import type {
  ClientControls,
  ClientDefinition,
  Snapshot,
} from '../../engine/api';
import type { Guidance } from './guidance';
import { varieties } from './cultivars';
import type { SeasonView } from './season-view';
import {
  campaignMarkup,
  updateCampaign,
  type CampaignView,
} from './campaign-view';
export interface VineyardView {
  cash: number;
  seconds: number;
  duration: number;
  season: SeasonView;
  campaign: CampaignView;
  speed: number;
  sold: number;
  vouchers: number;
  tool: string;
  variety: string;
  rotation: number;
  selection: string[];
  label: string;
  detail: string;
  stock: number;
  must: number;
  sellable: boolean;
  hint: string;
  cost: number;
  valid: boolean;
  arrears: number;
  guidance: Guidance | null;
  goal: number;
  units: {
    id: string;
    icon: string;
    busy: boolean;
    cargo: number;
    role: string;
  }[];
}
export const createControls: NonNullable<
  ClientDefinition['createControls']
> = ({ root, send }): ClientControls => {
  root.classList.add('vineyard-ui');
  root.innerHTML = `
  <header class="vineyard-ledger"><div class="vineyard-brand">WINOBRANIE <small>ŻYWY SEZON</small></div><div><small>GOTÓWKA</small><strong data-view="cash"></strong></div><div class="season-goal"><small>MOSZCZ</small><strong data-view="sold"></strong><progress max="40" value="0"></progress></div><div><small>SEZON</small><strong data-view="time"></strong></div><nav aria-label="Tempo sezonu">${[1, 2, 4].map((n) => `<button data-speed="${n}" aria-label="Tempo ${n}">${n}×</button>`).join('')}</nav></header>
  <aside class="vineyard-weather" aria-label="Pogoda i woda"><div><b data-view="weather"></b><span data-view="day"></span></div><div class="vineyard-forecast">${[0, 1, 2].map((i) => `<span data-forecast="${i}"></span>`).join('')}</div><small data-view="water"></small></aside>
  <nav class="vineyard-tools" aria-label="Gospodarstwo">
  ${[
    ['select', '↖', 'Wybór'],
    ['box', '▧', 'Grupa'],
    ['row', '❧', 'Winorośl'],
    ['road', '═', 'Droga'],
    ['avenue', '≡', 'Droga 5 pól'],
    ['house', '⌂', 'Domek'],
    ['tank', '▥', 'Zbiornik'],
    ['pump', '⚙', 'Pompa'],
    ['pipe', '┏', 'Rury'],
    ['sprinkler', '♧', 'Zraszacz'],
    ['move', '✥', 'Przenosiny'],
    ['remove', '⌫', 'Usunięcie'],
    ['parcel', '▱', 'Parcela'],
  ]
    .map(
      ([id, icon, label]) =>
        `<button data-tool="${id}" aria-label="${label}"><b>${icon}</b><span>${label}</span></button>`,
    )
    .join('')}
  </nav>
  <aside class="vineyard-options"><div class="varieties">${Object.entries(
    varieties,
  )
    .map(
      ([v, config]) =>
        `<button data-variety="${v}" title="${config.note} · sadzonka ${config.cost / 100} ◈ · moszcz ${config.price} ◈/L">${config.name}</button>`,
    )
    .join(
      '',
    )}</div><p data-view="cultivar"></p><small data-view="site"></small><button data-rotate="true" aria-label="Obróć domek">↻ <span data-view="rotation">0°</span></button><span data-view="price"></span><button data-cancel="true" aria-label="Anuluj">×</button><output data-view="hint"></output></aside>
  <aside class="vineyard-selection"><div class="selection-heading"><span class="vineyard-seal">❧</span><div><small>GOSPODARSTWO</small><h2 data-view="label">Winnica</h2></div></div><p data-view="detail"></p>
  <div class="crew" aria-label="Jednostki"></div><nav class="roles" aria-label="Praca">${[
    ['auto', '⚙', 'Auto'],
    ['harvest', '✿', 'Zbiór'],
    ['build', '⚒', 'Budowa'],
    ['press', '♜', 'Prasa'],
    ['rest', '◷', 'Postój'],
  ]
    .map(
      ([id, icon, label]) =>
        `<button data-role="${id}">${icon} ${label}</button>`,
    )
    .join(
      '',
    )}</nav><p class="season-detail" data-view="season-detail"></p><nav class="water-modes" aria-label="Tryb nawadniania">${[
    ['auto', 'Auto'],
    ['on', 'Ciągle'],
    ['off', 'Wyłączony'],
  ]
    .map(([id, label]) => `<button data-water-mode="${id}">${label}</button>`)
    .join(
      '',
    )}</nav><button data-refill></button><button data-care>Pielęgnacja · 100 ◈</button><small data-view="care-pending"></small><button class="must-sale" data-sell="true"><span data-view="sale-label">♧ Sprzedaj moszcz</span> <strong data-view="must"></strong></button></aside>
  <section class="vineyard-guidance" aria-label="Co teraz?">
    <div class="guidance-heading"><b>Co teraz?</b><button data-guidance-toggle aria-expanded="true" aria-controls="vineyard-guidance-content">Ukryj</button></div>
    <div id="vineyard-guidance-content"><small data-view="goal"></small><p data-view="guidance" role="status" aria-live="polite" aria-atomic="true"></p><button data-guidance-focus>Pokaż miejsce</button></div>
  </section>`;
  const business = document.createElement('div');
  business.innerHTML = campaignMarkup;
  root.append(business.querySelector('[data-campaign]')!);
  root
    .querySelector('.vineyard-selection')!
    .append(...Array.from(business.children));
  const get = (name: string) =>
    root.querySelector<HTMLElement>(`[data-view="${name}"]`)!;
  let current: VineyardView | undefined;
  const click = (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      'button',
    );
    if (!button || button.disabled) return;
    const d = button.dataset;
    for (const action of ['hire', 'upgrade', 'cellarMode', 'contract'])
      if (d[action]) {
        send({
          type: 'client-action',
          action: action === 'cellarMode' ? 'cellar-mode' : action,
          payload: d[action],
        });
        return;
      }
    for (const action of ['loan', 'repay', 'grapes', 'early', 'dismiss'])
      if (action in d) {
        send({ type: 'client-action', action });
        return;
      }
    if ('guidanceToggle' in d) {
      const content = root.querySelector<HTMLElement>(
        '#vineyard-guidance-content',
      )!;
      content.hidden = !content.hidden;
      button.setAttribute('aria-expanded', String(!content.hidden));
      button.textContent = content.hidden ? 'Pokaż' : 'Ukryj';
      return;
    }
    if ('guidanceFocus' in d) {
      send({ type: 'client-action', action: 'guidance-focus' });
      return;
    }
    if (d.waterMode) {
      send({
        type: 'client-action',
        action: 'water-mode',
        payload: d.waterMode,
      });
      return;
    }
    if ('refill' in d) {
      send({ type: 'client-action', action: 'refill' });
      return;
    }
    if ('care' in d) {
      send({ type: 'client-action', action: 'care' });
      return;
    }
    for (const action of ['tool', 'variety', 'speed', 'role', 'unit'])
      if (d[action]) {
        send({
          type: 'client-action',
          action,
          payload: action === 'speed' ? Number(d[action]) : d[action],
        });
        return;
      }
    if (d.rotate) send({ type: 'client-action', action: 'rotate' });
    if (d.cancel) send({ type: 'client-action', action: 'cancel' });
    if (d.sell) send({ type: 'client-action', action: 'sell' });
  };
  root.addEventListener('click', click);
  const keepFocus = (event: Event) => event.preventDefault();
  root.addEventListener('pointerdown', keepFocus);
  const update = (snapshot: Snapshot) => {
    if (!snapshot.client) return;
    current = snapshot.client as unknown as VineyardView;
    const s = current;
    root.classList.toggle(
      'inactive',
      snapshot.paused || snapshot.completed || !!snapshot.failed,
    );
    get('cash').textContent =
      `${Math.floor(s.cash / 100).toLocaleString('pl-PL')} ◈`;
    const campaign = s.campaign;
    updateCampaign(root, campaign, s.cash, s.units.length);
    root.classList.toggle('three-seasons', !!campaign);
    root.querySelector<HTMLElement>('[data-tool="avenue"]')!.hidden = !campaign;
    root.querySelector<HTMLElement>('.vineyard-brand small')!.textContent =
      campaign ? 'TRZY SEZONY' : 'ŻYWY SEZON';
    root.querySelector<HTMLElement>('.season-goal small')!.textContent =
      campaign ? 'BUTELKI' : 'MOSZCZ';
    get('sold').textContent = campaign
      ? `${campaign.bottles} / ${campaign.goal}`
      : `${(s.sold / 1000).toFixed(1)} / 40 L`;
    root.querySelector('progress')!.max = campaign?.goal ?? 40;
    root.querySelector('progress')!.value = campaign?.bottles ?? s.sold / 1000;
    const remaining = Math.max(0, s.duration - Math.floor(s.seconds));
    get('time').textContent =
      `${campaign ? `Rok ${campaign.year}/3 · ` : ''}${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
    get('label').textContent = s.label;
    get('detail').textContent = s.detail;
    const season = s.season;
    root.classList.toggle('living-season', !!season);
    root.querySelector<HTMLElement>('.vineyard-weather')!.hidden = !season;
    for (const kind of ['tank', 'pump', 'pipe', 'sprinkler'])
      root.querySelector<HTMLElement>(`[data-tool="${kind}"]`)!.hidden =
        !season;
    for (const kind of ['muscaris', 'rondo', 'cortis'])
      root.querySelector<HTMLElement>(`[data-variety="${kind}"]`)!.hidden =
        !season;
    get('season-detail').textContent = season?.detail ?? '';
    get('season-detail').hidden = !season?.detail;
    root.querySelector<HTMLElement>('.water-modes')!.hidden = !season?.mode;
    for (const button of Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-water-mode]'),
    ))
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.waterMode === season?.mode),
      );
    const refill = root.querySelector<HTMLButtonElement>('[data-refill]')!;
    refill.hidden = !season?.tank;
    refill.disabled =
      !!season?.delivery ||
      !season?.refillCost ||
      s.cash < (season?.refillCost ?? 0) * 100;
    refill.textContent = season?.delivery
      ? 'Dostawa w drodze'
      : `Zamów ${season?.refillCost ?? 0} L · ${season?.refillCost ?? 0} ◈`;
    const care = root.querySelector<HTMLButtonElement>('[data-care]')!;
    care.hidden = !season?.canCare;
    care.disabled = s.cash < 10000;
    get('care-pending').hidden = !season?.carePending;
    get('care-pending').textContent = season?.carePending
      ? 'Pielęgnacja zlecona · pracownik Auto/Budowa'
      : '';
    get('site').textContent = season?.site ?? '';
    get('site').hidden = s.tool !== 'row' || !season;
    const cultivar = varieties[s.variety as keyof typeof varieties];
    get('cultivar').textContent = season
      ? `${cultivar.note} · sadzonka ${cultivar.cost / 100} ◈ · moszcz ${cultivar.price} ◈/L`
      : '';
    get('cultivar').hidden = s.tool !== 'row' || !season;
    if (season) {
      get('weather').textContent = season.weather;
      get('day').textContent = season.day;
      get('water').textContent = season.water;
      root.querySelector<HTMLElement>('.vineyard-weather')!.dataset.kind =
        season.kind;
      for (const [i, node] of Array.from(
        root.querySelectorAll<HTMLElement>('[data-forecast]'),
      ).entries()) {
        const f = season.forecast[i];
        node.hidden = !f;
        node.textContent = f?.text ?? '';
        node.title = f ? `Pewność prognozy: ${f.confidence}` : '';
      }
    }
    get('sale-label').textContent = campaign
      ? '♧ Sprzedaj butelki'
      : '♧ Sprzedaj moszcz';
    get('must').textContent = campaign
      ? `${campaign.cellar?.bottles ?? 0} szt.`
      : `${(s.must / 1000).toFixed(1)} L`;
    get('price').textContent =
      s.tool === 'house'
        ? s.vouchers
          ? `${s.vouchers} / 2 ⌂`
          : campaign
            ? '8000 ◈'
            : '0 / 2 ⌂'
        : s.tool === 'parcel'
          ? '6000 ◈'
          : `${s.cost / 100} ◈`;
    get('price').hidden = ['select', 'box'].includes(s.tool);
    get('rotation').textContent = `${s.rotation * 90}°`;
    get('hint').textContent = s.arrears
      ? `Zaległości: ${s.arrears / 100} ◈`
      : s.hint;
    get('hint').classList.toggle('invalid', !s.valid);
    const guide = root.querySelector<HTMLElement>('.vineyard-guidance')!;
    guide.hidden = !s.guidance;
    if (s.guidance) {
      guide.dataset.tone = s.guidance.tone;
      guide.dataset.guidance = s.guidance.id;
      // Only actual text changes should be announced by assistive technology.
      if (get('guidance').textContent !== s.guidance.text)
        get('guidance').textContent = s.guidance.text;
      const goal = campaign
        ? `Cel: ${campaign.goal} butelek · jakość 65 · 2 szczepy w roku 3 · wartość netto ≥0.`
        : `Cel sezonu: sprzedaj ${s.goal / 1000} L moszczu.`;
      if (get('goal').textContent !== goal) get('goal').textContent = goal;
      root.querySelector<HTMLButtonElement>('[data-guidance-focus]')!.hidden =
        !s.guidance.target;
    }
    root.querySelector<HTMLElement>('.varieties')!.hidden = s.tool !== 'row';
    root.querySelector<HTMLElement>('[data-rotate]')!.hidden =
      s.tool !== 'house' && s.tool !== 'move';
    root.querySelector<HTMLElement>('.vineyard-options')!.hidden =
      ['select', 'box'].includes(s.tool) && !s.arrears && !s.selection.length;
    root.querySelector<HTMLButtonElement>('[data-sell]')!.hidden = !s.sellable;
    root.querySelector<HTMLButtonElement>('[data-sell]')!.disabled = campaign
      ? (campaign.cellar?.bottles ?? 0) <= 0
      : s.must <= 0;
    const roles = root.querySelector<HTMLElement>('.roles')!;
    roles.hidden = !s.selection.some((id) => s.units.some((u) => u.id === id));
    for (const button of Array.from(
      root.querySelectorAll<HTMLButtonElement>(
        '[data-tool],[data-variety],[data-speed],[data-role]',
      ),
    )) {
      const d = button.dataset;
      button.setAttribute(
        'aria-pressed',
        String(
          d.tool === s.tool ||
            d.variety === s.variety ||
            d.speed === String(s.speed) ||
            (d.role &&
              s.units.some(
                (u) => s.selection.includes(u.id) && u.role === d.role,
              )),
        ),
      );
    }
    const crew = root.querySelector<HTMLElement>('.crew')!;
    for (const button of Array.from(
      crew.querySelectorAll<HTMLButtonElement>('[data-unit]'),
    ))
      if (!s.units.some((u) => u.id === button.dataset.unit)) button.remove();
    for (const unit of s.units.filter(
      (u) => !crew.querySelector(`[data-unit="${u.id}"]`),
    )) {
      const button = document.createElement('button');
      button.dataset.unit = unit.id;
      button.setAttribute(
        'aria-label',
        unit.id === 'tractor-1'
          ? 'Traktor'
          : `${unit.id.startsWith('tractor') ? 'Traktor' : 'Pracownik'} ${unit.id.split('-').at(-1)}`,
      );
      crew.append(button);
    }
    for (const unit of s.units) {
      const button = crew.querySelector<HTMLButtonElement>(
        `[data-unit="${unit.id}"]`,
      )!;
      button.textContent = `${unit.icon} ${unit.id.split('-').at(-1)} ${unit.cargo ? `${unit.cargo / 1000} kg` : unit.busy ? '●' : '◌'}`;
      button.setAttribute(
        'aria-pressed',
        String(s.selection.includes(unit.id)),
      );
    }
  };
  return {
    update,
    destroy: () => {
      root.removeEventListener('pointerdown', keepFocus);
      root.removeEventListener('click', click);
      root.replaceChildren();
    },
  };
};
