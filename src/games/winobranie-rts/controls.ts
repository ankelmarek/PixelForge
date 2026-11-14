import type {
  ClientControls,
  ClientDefinition,
  Snapshot,
} from '../../engine/api';
export interface VineyardView {
  cash: number;
  seconds: number;
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
  <header class="vineyard-ledger"><div class="vineyard-brand">WINOBRANIE <small>PIERWSZY SEZON</small></div><div><small>GOTÓWKA</small><strong data-view="cash"></strong></div><div class="season-goal"><small>MOSZCZ</small><strong data-view="sold"></strong><progress max="40" value="0"></progress></div><div><small>SEZON</small><strong data-view="time"></strong></div><nav aria-label="Tempo sezonu">${[1, 2, 4].map((n) => `<button data-speed="${n}" aria-label="Tempo ${n}">${n}×</button>`).join('')}</nav></header>
  <nav class="vineyard-tools" aria-label="Gospodarstwo">
  ${[
    ['select', '↖', 'Wybór'],
    ['box', '▧', 'Grupa'],
    ['row', '❧', 'Winorośl'],
    ['road', '═', 'Droga'],
    ['house', '⌂', 'Domek'],
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
  <aside class="vineyard-options"><div class="varieties">${[
    ['solaris', 'Solaris'],
    ['regent', 'Regent'],
    ['johanniter', 'Johanniter'],
  ]
    .map(([v, name]) => `<button data-variety="${v}">${name}</button>`)
    .join(
      '',
    )}</div><button data-rotate="true" aria-label="Obróć domek">↻ <span data-view="rotation">0°</span></button><span data-view="price"></span><button data-cancel="true" aria-label="Anuluj">×</button><output data-view="hint"></output></aside>
  <aside class="vineyard-selection"><div class="selection-heading"><span class="vineyard-seal">❧</span><div><small>GOSPODARSTWO</small><h2 data-view="label">Winnica</h2></div></div><p data-view="detail"></p><div class="crew" aria-label="Jednostki"></div><nav class="roles" aria-label="Praca">${[
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
    )}</nav><button class="must-sale" data-sell="true">♧ Sprzedaj moszcz <strong data-view="must"></strong></button></aside>`;
  const get = (name: string) =>
    root.querySelector<HTMLElement>(`[data-view="${name}"]`)!;
  let current: VineyardView | undefined;
  const click = (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      'button',
    );
    if (!button || button.disabled) return;
    const d = button.dataset;
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
    get('sold').textContent = `${(s.sold / 1000).toFixed(1)} / 40 L`;
    root.querySelector('progress')!.value = s.sold / 1000;
    const remaining = Math.max(0, 360 - Math.floor(s.seconds));
    get('time').textContent =
      `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
    get('label').textContent = s.label;
    get('detail').textContent = s.detail;
    get('must').textContent = `${(s.must / 1000).toFixed(1)} L`;
    get('price').textContent =
      s.tool === 'house'
        ? `${s.vouchers} / 2 ⌂`
        : s.tool === 'parcel'
          ? '6000 ◈'
          : `${s.cost / 100} ◈`;
    get('price').hidden = ['select', 'box'].includes(s.tool);
    get('rotation').textContent = `${s.rotation * 90}°`;
    get('hint').textContent = s.arrears
      ? `Zaległości: ${s.arrears / 100} ◈`
      : s.hint;
    get('hint').classList.toggle('invalid', !s.valid);
    root.querySelector<HTMLElement>('.varieties')!.hidden = s.tool !== 'row';
    root.querySelector<HTMLElement>('[data-rotate]')!.hidden =
      s.tool !== 'house' && s.tool !== 'move';
    root.querySelector<HTMLElement>('.vineyard-options')!.hidden =
      ['select', 'box'].includes(s.tool) && !s.arrears && !s.selection.length;
    root.querySelector<HTMLButtonElement>('[data-sell]')!.hidden = !s.sellable;
    root.querySelector<HTMLButtonElement>('[data-sell]')!.disabled =
      s.must <= 0;
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
    if (!crew.children.length)
      for (const unit of s.units) {
        const button = document.createElement('button');
        button.dataset.unit = unit.id;
        button.setAttribute(
          'aria-label',
          unit.id === 'tractor-1'
            ? 'Traktor'
            : `Pracownik ${unit.id.slice(-1)}`,
        );
        crew.append(button);
      }
    for (const unit of s.units) {
      const button = crew.querySelector<HTMLButtonElement>(
        `[data-unit="${unit.id}"]`,
      )!;
      button.textContent = `${unit.icon} ${unit.id.slice(-1)} ${unit.cargo ? `${unit.cargo / 1000} kg` : unit.busy ? '●' : '◌'}`;
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
