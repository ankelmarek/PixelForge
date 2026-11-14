import { EngineHost } from '../../src/engine/api';
import { platformDefinition, simulationDefinition } from './content';
const find = (id: string) => document.getElementById(id)!;
const button = (id: string) => find(id) as HTMLButtonElement;
let paused = false;
const host = new EngineHost({
  parent: find('stage'),
  definition:
    new URLSearchParams(location.search).get('mode') === 'simulation'
      ? simulationDefinition
      : platformDefinition,
  onReady: () => {
    button('start').disabled = false;
    button('resume').disabled = false;
  },
  onState: (state) => {
    Object.entries(state).forEach(([key, value]) => {
      find('telemetry').dataset[key] =
        typeof value === 'object' ? JSON.stringify(value) : String(value);
    });
  },
  onError: (message) => {
    find('error').textContent = message;
  },
  onMessage: (message) => {
    find('error').textContent = message;
  },
  onPause: (value) => {
    paused = value;
  },
});
void host.load();
for (const id of ['pause', 'mute', 'cancel', 'zoom', 'reset'])
  button(id).onpointerdown = (e) => e.preventDefault();
button('start').onclick = () => host.start(false);
button('resume').onclick = () => host.start(true);
button('restart').onclick = () => host.start(false);
button('pause').onclick = () => host.pause(!paused);
button('mute').onclick = () =>
  button('mute').setAttribute('aria-pressed', String(host.mute()));
button('cancel').onclick = () => host.command({ type: 'cancel' });
button('zoom').onclick = () => host.command({ type: 'zoom', direction: 1 });
button('reset').onclick = () => host.command({ type: 'zoom', direction: 0 });
button('dispose').onclick = () => {
  host.destroy();
};
