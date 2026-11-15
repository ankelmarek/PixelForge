import { EngineHost, type Snapshot } from '../engine/api';
import { worldDemo } from '../demos/large-world';
export function mountWorldLab(
  root: HTMLElement,
  size: 4096 | 8192,
  back: () => void,
) {
  root.innerHTML = `<main class="lab" aria-label="Atlas ${size}">
    <div id="stage"></div>
    <div class="lab-heading"><button id="back" aria-label="Powrót do katalogu">←</button><span>ATLAS <em>${size}</em></span></div>
    <output id="progress" aria-label="Postęp produkcji">▦ 0 / 48</output>
    <aside class="world-navigation"><canvas id="minimap" width="144" height="144" aria-label="Minimapa świata" role="img"></canvas><div class="landmarks">
      <button data-focus="worker-1" aria-label="Pracownik"><img src="assets/demos/large-world/worker.png" alt="" class="person-icon"></button>
      <button data-focus="vehicle" aria-label="Pojazd">▰</button><button data-focus="source" aria-label="Źródło">▦</button>
      <button data-focus="depot" aria-label="Skład">⌂</button><button data-focus="processor" aria-label="Przetwórnia">⚙</button><button data-focus="remote-source" aria-label="Odległe źródło">◇</button>
    </div></aside>
    <div class="toolbar"><div><button id="pause" aria-label="Pauza">Ⅱ</button><button id="mute" aria-label="Wyciszenie" aria-pressed="false">♫</button><button id="cancel" aria-label="Anuluj zadania">×</button><button id="focus" aria-label="Zaznaczona jednostka">◎</button></div>
    <div><button id="zoom-out" aria-label="Oddal">−</button><button id="zoom-reset" aria-label="Widok początkowy">⌖</button><button id="zoom-in" aria-label="Przybliż">+</button></div></div>
    <div id="menu" class="lab-menu"><span class="eyebrow">${size} × ${size}</span><h2>Atlas</h2><button id="start" disabled>Nowa sesja</button><button id="resume" disabled>Wznów</button></div>
    <div id="session-menu" class="lab-menu" hidden><button id="continue">Wznów</button><button id="restart">Nowa sesja</button></div>
    <p id="message" role="status"></p><p id="error" role="alert"></p><pre id="diagnostics" hidden></pre></main>`;
  const get = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>(`#${id}`)!;
  const minimap = get<HTMLCanvasElement>('minimap'),
    ctx = minimap.getContext('2d')!;
  const diagnostic = new URLSearchParams(location.search).has('diagnostics');
  let snapshot: Snapshot | undefined,
    ready = false,
    running = false,
    dead = false;
  const drawMap = (s: Snapshot) => {
    ctx.fillStyle = '#526f54';
    ctx.fillRect(0, 0, 144, 144);
    const factor = 144 / size;
    ctx.fillStyle = '#baa67c';
    ctx.fillRect(0, 30 * 16 * factor, 144, Math.max(1, 80 * factor));
    ctx.fillRect(34 * 16 * factor, 0, Math.max(1, 80 * factor), 144);
    for (const actor of s.actors ?? []) {
      ctx.fillStyle = actor.id === s.selectedId ? '#fff0bf' : '#d6b67c';
      ctx.fillRect(actor.x * 16 * factor - 1, actor.y * 16 * factor - 1, 3, 3);
    }
    ctx.fillStyle = '#e2c089';
    ctx.fillRect((size - 176) * factor - 1, (size - 208) * factor - 1, 3, 3);
    if (s.camera) {
      const c = s.camera,
        w = c.width / c.zoom,
        h = c.height / c.zoom;
      ctx.strokeStyle = '#f0ead6';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        (c.scrollX + c.width / 2 - w / 2) * factor,
        (c.scrollY + c.height / 2 - h / 2) * factor,
        w * factor,
        h * factor,
      );
    }
  };
  const host = new EngineHost({
    parent: get('stage'),
    display: 'fill',
    definition: worldDemo(size),
    onReady() {
      if (dead) return;
      ready = true;
      get<HTMLButtonElement>('start').disabled = false;
      get<HTMLButtonElement>('resume').disabled = false;
    },
    onState(s) {
      if (dead) return;
      snapshot = s;
      get('progress').textContent =
        `▦ ${s.produced ?? 0} / ${s.goal ?? 48}${s.completed ? ' ✓' : ''}`;
      get('pause').textContent = s.paused ? '▶' : 'Ⅱ';
      get('pause').setAttribute('aria-label', s.paused ? 'Wznów' : 'Pauza');
      get('session-menu').hidden = !s.paused && !s.completed;
      drawMap(s);
      if (diagnostic) {
        const output = get('diagnostics');
        output.hidden = false;
        output.dataset.state = JSON.stringify(s);
        output.textContent = JSON.stringify(
          { ...s.world, elapsed: s.elapsed },
          null,
          2,
        );
      }
    },
    onPause() {},
    onMessage(message) {
      if (dead) return;
      get('message').textContent = message;
    },
    onError(message) {
      if (dead) return;
      get('error').textContent = message;
    },
  });
  const bind = (id: string, action: () => void) => {
    get(id).addEventListener('pointerdown', (event) => event.preventDefault());
    get(id).addEventListener('click', action);
  };
  const start = (resume: boolean) => {
    if (!ready) return;
    get('menu').hidden = true;
    get('session-menu').hidden = true;
    get('error').textContent = '';
    running = true;
    host.start(resume);
  };
  bind('start', () => start(false));
  bind('resume', () => start(true));
  bind('restart', () => start(false));
  bind('pause', () => host.pause(!snapshot?.paused));
  bind('continue', () => host.pause(false));
  bind('mute', () => {
    const muted = host.mute();
    get('mute').textContent = muted ? '♩' : '♫';
    get('mute').setAttribute('aria-pressed', String(muted));
  });
  bind('cancel', () => host.command({ type: 'cancel' }));
  bind('focus', () => host.command({ type: 'focus' }));
  for (const [id, direction] of [
    ['zoom-out', -1],
    ['zoom-reset', 0],
    ['zoom-in', 1],
  ] as const)
    bind(id, () => host.command({ type: 'zoom', direction }));
  root.querySelectorAll<HTMLButtonElement>('[data-focus]').forEach((button) => {
    button.addEventListener('pointerdown', (e) => e.preventDefault());
    button.addEventListener('click', () =>
      host.command({ type: 'focus', id: button.dataset.focus }),
    );
  });
  minimap.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (!running) return;
    const rect = minimap.getBoundingClientRect();
    host.command({
      type: 'focus',
      point: {
        x: (((event.clientX - rect.left) / rect.width) * size) / 16,
        y: (((event.clientY - rect.top) / rect.height) * size) / 16,
      },
    });
  });
  const destroy = () => {
    dead = true;
    host.destroy();
    window.removeEventListener('pagehide', destroy);
  };
  bind('back', () => {
    destroy();
    back();
  });
  window.addEventListener('pagehide', destroy);
  void host.load();
}
