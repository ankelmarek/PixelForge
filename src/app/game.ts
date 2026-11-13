import {
  EngineHost,
  type ClientDefinition,
  type Snapshot,
} from '../engine/api';

/** Shared full-window presentation for bundled game clients. */
export function mountGame(
  root: HTMLElement,
  definition: ClientDefinition,
  back: () => void,
) {
  root.innerHTML = `<main class="lab game-shell" aria-label="Gra">
    <div id="stage"></div>
    <div class="lab-heading"><button id="back" aria-label="Powrót do katalogu">←</button><span id="game-title"></span></div>
    <div id="game-hud"><div id="meters"></div><output id="goal"></output><span id="weather" role="img"></span></div>
    <aside class="game-map"><canvas id="minimap" width="144" height="144" aria-label="Mapa świata" role="img"></canvas></aside>
    <div class="toolbar"><div><button id="pause" aria-label="Pauza">Ⅱ</button><button id="mute" aria-label="Wyciszenie" aria-pressed="false">♫</button><button id="interact" aria-pressed="false">◎</button></div>
    <div><button id="focus" aria-label="Śledź bohatera">⌖</button><button id="zoom-out" aria-label="Oddal">−</button><button id="zoom-in" aria-label="Przybliż">+</button></div></div>
    <div class="direction-pad" aria-label="Ruch"><button data-action="up" aria-label="W górę">↑</button><button data-action="left" aria-label="W lewo">←</button><button data-action="down" aria-label="W dół">↓</button><button data-action="right" aria-label="W prawo">→</button></div>
    <div id="menu" class="lab-menu game-menu"><div class="title-art"></div><div class="menu-content"><p class="eyebrow">PIXELFORGE</p><h1 id="title"></h1><button id="start" disabled>Nowa gra</button><button id="resume" disabled>Wznów</button></div></div>
    <div id="session-menu" class="lab-menu" hidden><div class="result-art" aria-hidden="true">✿</div><h2 id="result-title">Pauza</h2><button id="continue">Wznów</button><button id="restart">Nowa gra</button><button id="leave">Katalog</button></div>
    <p id="message" role="status"></p><p id="error" role="alert"></p><pre id="diagnostics" hidden></pre>
  </main>`;
  const get = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>(`#${id}`)!;
  get('game-title').textContent = definition.title;
  get('title').textContent = definition.title;
  get('goal').setAttribute(
    'aria-label',
    definition.presentation.objectiveLabel,
  );
  get('interact').setAttribute(
    'aria-label',
    definition.presentation.actionLabel,
  );
  root.querySelector<HTMLElement>('.title-art')!.style.backgroundImage =
    `url("${definition.catalog.cover}")`;
  const minimap = get<HTMLCanvasElement>('minimap'),
    ctx = minimap.getContext('2d')!;
  let state: Snapshot | undefined,
    ready = false,
    dead = false,
    running = false;
  const diagnostic = new URLSearchParams(location.search).has('diagnostics');
  const drawMap = (s: Snapshot) => {
    if (!s.map) return;
    ctx.fillStyle = '#352e37';
    ctx.fillRect(0, 0, 144, 144);
    const fx = 144 / s.map.width,
      fy = 144 / s.map.height;
    ctx.fillStyle = '#93745e';
    for (const p of s.map.trail) ctx.fillRect(p.x * fx, p.y * fy, 1, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '11px monospace';
    for (const p of s.map.markers) {
      ctx.fillStyle = p.color;
      ctx.fillText(p.icon, p.x * fx, p.y * fy);
    }
    if (s.camera) {
      const c = s.camera,
        w = c.width / c.zoom,
        h = c.height / c.zoom;
      ctx.strokeStyle = '#f5e1bc';
      ctx.strokeRect(
        (c.scrollX + c.width / 2 - w / 2) * fx,
        (c.scrollY + c.height / 2 - h / 2) * fy,
        w * fx,
        h * fy,
      );
    }
    ctx.fillStyle = '#f1a9af';
    ctx.fillRect((s.x ?? 0) * fx - 2, (s.y ?? 0) * fy - 2, 4, 4);
  };
  const host = new EngineHost({
    parent: get('stage'),
    display: 'fill',
    definition,
    onReady() {
      if (dead) return;
      ready = true;
      get<HTMLButtonElement>('start').disabled = false;
      get<HTMLButtonElement>('resume').disabled = false;
      get('start').focus();
    },
    onState(s) {
      if (dead) return;
      const wasPaused = state?.paused,
        wasOver = state?.completed || state?.failed;
      state = s;
      get('goal').textContent = `✿ ${s.collected ?? 0} / ${s.total ?? 0}`;
      if (s.phase) {
        get('weather').textContent = s.phase.icon;
        get('weather').setAttribute('aria-label', s.phase.label);
      }
      for (const meter of s.meters ?? []) {
        let element = root.querySelector<HTMLElement>(
          `[data-meter="${meter.id}"]`,
        );
        if (!element) {
          element = document.createElement('div');
          element.dataset.meter = meter.id;
          element.className = 'meter';
          const icon = document.createElement('span'),
            bar = document.createElement('meter');
          icon.textContent = meter.icon;
          icon.setAttribute('aria-hidden', 'true');
          bar.setAttribute('aria-label', meter.label);
          element.append(icon, bar);
          get('meters').append(element);
        }
        const bar = element.querySelector('meter')!;
        bar.max = meter.max;
        bar.value = meter.value;
        bar.style.setProperty('--meter-color', meter.color);
      }
      get('pause').setAttribute('aria-label', s.paused ? 'Wznów' : 'Pauza');
      get('pause').textContent = s.paused ? '▶' : 'Ⅱ';
      get('interact').setAttribute('aria-pressed', String(!!s.activated));
      const over = s.completed || s.failed;
      get('session-menu').hidden = !s.paused && !over;
      get('continue').hidden = !!over;
      get('result-title').textContent = s.completed
        ? definition.presentation.completionTitle
        : s.failed
          ? definition.presentation.failureTitle
          : 'Pauza';
      root.querySelector('.result-art')!.textContent = s.completed
        ? '✿ ✿ ✿'
        : s.failed
          ? '◌'
          : '◒';
      if ((s.paused && !wasPaused) || (over && !wasOver))
        get(over ? 'restart' : 'continue').focus({ preventScroll: true });
      drawMap(s);
      if (diagnostic) {
        const output = get('diagnostics');
        output.hidden = false;
        output.dataset.state = JSON.stringify({ ...s, map: undefined });
        output.textContent = JSON.stringify(s.stats);
      }
    },
    onPause() {},
    onMessage(message) {
      if (!dead) get('message').textContent = message;
    },
    onError(message) {
      if (!dead) get('error').textContent = message;
    },
  });
  const bind = (id: string, fn: () => void) => {
    get(id).addEventListener('pointerdown', (e) => e.preventDefault());
    get(id).addEventListener('click', fn);
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
  bind('pause', () => host.pause(!state?.paused));
  bind('continue', () => host.pause(false));
  bind('mute', () => {
    const muted = host.mute();
    get('mute').textContent = muted ? '♩' : '♫';
    get('mute').setAttribute('aria-pressed', String(muted));
  });
  bind('interact', () => host.clientCommand({ type: 'interact' }));
  bind('focus', () => host.clientCommand({ type: 'focus' }));
  bind('zoom-out', () => host.clientCommand({ type: 'zoom', direction: -1 }));
  bind('zoom-in', () => host.clientCommand({ type: 'zoom', direction: 1 }));
  root
    .querySelectorAll<HTMLButtonElement>('[data-action]')
    .forEach((button) => {
      const action = button.dataset.action as 'up' | 'down' | 'left' | 'right';
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        host.action(action, true, `pad-${action}`);
      });
      const release = () => host.action(action, false, `pad-${action}`);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });
  minimap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!running || !state?.map) return;
    const r = minimap.getBoundingClientRect();
    host.clientCommand({
      type: 'focus',
      point: {
        x: ((e.clientX - r.left) / r.width) * state.map.width,
        y: ((e.clientY - r.top) / r.height) * state.map.height,
      },
    });
  });
  const destroy = () => {
    if (dead) return;
    dead = true;
    host.destroy();
    window.removeEventListener('pagehide', destroy);
    root.removeEventListener('keydown', keys);
  };
  const leave = () => {
    destroy();
    back();
  };
  bind('back', leave);
  bind('leave', leave);
  const keys = (e: KeyboardEvent) => {
    if (e.repeat || e.defaultPrevented) return;
    if (e.code === 'Escape' && state?.paused) {
      e.preventDefault();
      host.pause(false);
      return;
    }
    if (e.target instanceof HTMLButtonElement) return;
    if (
      (e.code === 'Space' || e.code === 'Enter') &&
      (!running || state?.completed || state?.failed)
    ) {
      e.preventDefault();
      start(false);
    }
  };
  root.addEventListener('keydown', keys);
  window.addEventListener('pagehide', destroy);
  void host.load();
}
