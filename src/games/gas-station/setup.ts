import type { ClientDefinition } from '../../engine/api';
import { VARIANTS, scenarios, type Variant } from './scenarios';

export const createSetup: NonNullable<ClientDefinition['createSetup']> = ({
  root,
}) => {
  root.classList.add('station-setup');
  root.innerHTML = `<div class="station-variants" role="group" aria-label="Wariant weekendu">${VARIANTS.map((id) => `<button type="button" data-scenario="${id}" aria-pressed="${id === 'country'}"><b>${scenarios[id].icon} ${scenarios[id].name}</b><small>${scenarios[id].detail}</small><small>30 min · ${scenarios[id].goal} klientów · 70%</small></button>`).join('')}</div><div class="station-seed"><label>Numer weekendu <input data-st-seed type="number" inputmode="numeric" min="0" max="4294967295" step="1" required aria-label="Numer weekendu"></label><button type="button" data-st-random aria-label="Losuj weekend">⤨</button></div>`;
  const input = root.querySelector<HTMLInputElement>('[data-st-seed]')!;
  let variant: Variant = 'country';
  const randomize = () => {
    input.value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
  };
  randomize();
  const click = (e: Event) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
      'button',
    );
    if (!button) return;
    if ('stRandom' in button.dataset) randomize();
    if (VARIANTS.includes(button.dataset.scenario as Variant)) {
      variant = button.dataset.scenario as Variant;
      root
        .querySelectorAll<HTMLElement>('[data-scenario]')
        .forEach((b) =>
          b.setAttribute(
            'aria-pressed',
            String(b.dataset.scenario === variant),
          ),
        );
    }
  };
  root.addEventListener('click', click);
  return {
    value() {
      if (!input.checkValidity()) {
        input.reportValidity();
        throw Error('Numer weekendu: liczba całkowita od 0 do 4294967295.');
      }
      return { variant, seed: Number(input.value) };
    },
    destroy() {
      root.removeEventListener('click', click);
    },
  };
};
