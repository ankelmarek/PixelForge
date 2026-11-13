import { EngineHost, type Action, type GameDefinition } from '../engine/api';
import { games } from '../games/registry';
export function mountApp(root: HTMLElement) {
  root.innerHTML = `
    <header class="masthead"><a class="brand" href="./" aria-label="PixelForge — katalog"><span class="brand-mark">▧</span> PIXEL<span>FORGE</span></a><span class="build-label">LABORATORIUM GIER <i></i> M0 / 0.0.1</span></header>
    <main><section id="catalog" aria-labelledby="catalog-title">
      <p class="eyebrow">MAŁE ŚWIATY. WIELKIE PRZYGODY.</p><h1 id="catalog-title">Każda podróż<br>zaczyna się od <em>piksela.</em></h1>
      <p class="intro">Wybierz świat i zrób pierwszy krok. PixelForge to wspólny silnik dla niezależnych przygód 2D.</p>
      <article class="game-card"><div class="cover"><img alt="Księżycowy las z leśną latarnią" src="${import.meta.env.BASE_URL}assets/games/forest-demo/background.png"><span class="cover-badge">GRYWALNY PROTOTYP</span><div class="cover-art"><img alt="" src="${import.meta.env.BASE_URL}assets/games/forest-demo/beacon.png"><span>01 / LEŚNA POLANA</span></div></div>
      <div class="card-content"><p class="eyebrow">PLATFORMÓWKA · FOREST-DEMO</p><h2></h2><p class="description"></p><div class="tags"><span>Klawiatura + dotyk</span><span>1 krótki poziom</span></div><button id="launch" class="primary">Odkryj las <span>↗</span></button></div></article>
      <p class="catalog-note"><span>01</span> Jeden silnik. Osobne światy. <small>Fundament PixelForge / etap M0</small></p>
    </section>
    <section id="play" hidden aria-label="Gra demonstracyjna">
      <div class="play-heading"><div><p class="eyebrow">FOREST-DEMO / PROTOTYP M0</p><h2 id="game-title"></h2></div><button id="exit" class="subtle">← Katalog</button></div>
      <div class="game-frame"><div class="game-topbar"><span>◈ LEŚNA POLANA</span><span id="progress">◇</span></div><div id="stage">
        <div id="canvas-container"></div><div id="overlay" class="overlay"><div class="overlay-card"><p class="eyebrow" id="overlay-kicker">PRZYGOTOWUJEMY ŚWIAT</p><h3 id="overlay-title">Wczytywanie…</h3><p id="overlay-copy"></p><div class="overlay-actions"><button id="start" class="primary" hidden>Nowa wyprawa →</button><button id="resume" hidden>Wznów wyprawę</button></div></div></div>
      </div><div class="game-bottom"><span id="hint" role="status"></span><div><button id="pause" disabled>Pauza</button><button id="restart" disabled>Od nowa</button><button id="mute" aria-pressed="false">Dźwięk: wł.</button></div></div></div>
      <div class="touch-controls" aria-label="Sterowanie dotykowe"><div><button data-action="left" aria-label="Idź w lewo">←</button><button data-action="right" aria-label="Idź w prawo">→</button></div><div><button data-action="interact" aria-label="Interakcja">✦</button><button data-action="jump" aria-label="Skok">↑</button></div></div>

    </section></main><footer><span>PIXELFORGE <span class="footer-dot">/</span> NIEZALEŻNE ŚWIATY 2D</span><span>Stworzone z pikseli i ciekawości.</span></footer>`;
  const find = <T extends HTMLElement = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const button = (selector: string) => find<HTMLButtonElement>(selector);
  const definition = games[0];
  find('.card-content h2').textContent = definition.title;
  find('.description').textContent = definition.description;
  let host: EngineHost | undefined;
  let active = false,
    paused = false,
    complete = false;
  const showOverlay = (kicker: string, title: string, copy: string) => {
    find('#overlay').hidden = false;
    find('#overlay-kicker').textContent = kicker;
    find('#overlay-title').textContent = title;
    find('#overlay-copy').textContent = copy;
  };
  const start = (resume: boolean) => {
    active = true;
    complete = false;
    find('#overlay').hidden = true;
    button('#pause').disabled = false;
    button('#restart').disabled = false;
    host?.start(resume);
  };
  const open = (game: GameDefinition) => {
    find('#catalog').hidden = true;
    find('#play').hidden = false;
    find('#game-title').textContent = game.title;
    showOverlay('PRZYGOTOWUJEMY ŚWIAT', 'Wczytywanie…', '');
    button('#start').hidden = true;
    button('#resume').hidden = true;
    button('#mute').textContent = 'Dźwięk: wł.';
    button('#mute').setAttribute('aria-pressed', 'false');
    button('#start').textContent = 'Nowa wyprawa →';
    button('#resume').textContent = 'Wznów wyprawę';
    host = new EngineHost({
      parent: find('#canvas-container'),
      definition: game,
      onReady: () => {
        showOverlay('TWOJA MAŁA WIELKA WYPRAWA', game.title, '');
        button('#start').hidden = false;
        button('#resume').hidden = false;
        button('#start').focus();
      },
      onError: (message) => {
        showOverlay(
          'NIE UDAŁO SIĘ WCZYTAĆ ŚWIATA',
          'Coś poszło nie tak',
          message,
        );
        button('#start').hidden = true;
        button('#resume').hidden = true;
        button('#exit').focus();
      },
      onState: (state) => {
        // Read-only telemetry also makes black-box browser assertions possible.
        const stage = find('#stage');
        Object.entries(state).forEach(([key, value]) => {
          stage.dataset[key] = String(value);
        });
        find('#progress').textContent = state.activated
          ? 'SYGNAŁ: AKTYWNY'
          : '◇';
        if (state.completed && !complete) {
          complete = true;
          showOverlay('SYGNAŁ DOTARŁ DO CELU', 'Ukończono', '');
          button('#start').hidden = false;
          button('#start').textContent = 'Zagraj ponownie →';
          button('#resume').hidden = true;
          button('#pause').disabled = true;
          button('#start').focus();
        }
      },
      onMessage: (message) => {
        find('#hint').textContent = message;
      },
      onPause: (value) => {
        paused = value;
        button('#pause').textContent = value ? 'Wznów' : 'Pauza';
        if (!active || complete) return;
        if (value) {
          showOverlay('CHWILA ODDECHU', 'Pauza', '');
          button('#start').hidden = true;
          button('#resume').hidden = false;
          button('#resume').textContent = 'Wróć do gry';
          button('#resume').focus();
        } else find('#overlay').hidden = true;
      },
    });
    void host.load();
  };
  root.addEventListener('keydown', (event) => {
    if (
      event.code === 'Escape' &&
      paused &&
      active &&
      !complete &&
      !(event.target instanceof HTMLCanvasElement)
    ) {
      event.preventDefault();
      host?.pause(false);
    }
  });
  button('#launch').onclick = () => open(definition);
  button('#start').onclick = () => start(false);
  button('#resume').onclick = () => {
    if (active && paused) {
      find('#overlay').hidden = true;
      host?.pause(false);
    } else start(true);
  };
  button('#pause').onpointerdown = (event) => event.preventDefault();
  button('#pause').onclick = () => host?.pause(!paused);
  button('#restart').onclick = () => start(false);
  button('#mute').onpointerdown = (event) => event.preventDefault();
  button('#mute').onclick = () => {
    const muted = host?.mute();
    button('#mute').textContent = muted ? 'Dźwięk: wył.' : 'Dźwięk: wł.';
    button('#mute').setAttribute('aria-pressed', String(muted));
  };
  button('#exit').onclick = () => {
    active = false;
    host?.destroy();
    host = undefined;
    find('#canvas-container').replaceChildren();
    find('#play').hidden = true;
    find('#catalog').hidden = false;
    button('#pause').disabled = true;
    button('#restart').disabled = true;
    button('#launch').focus();
  };
  root
    .querySelectorAll<HTMLButtonElement>('[data-action]')
    .forEach((control) => {
      const action = control.dataset.action as Action;
      control.onpointerdown = (event) => {
        event.preventDefault();
        control.setPointerCapture(event.pointerId);
        host?.focus();
        host?.action(action, true, `pointer:${event.pointerId}`);
      };
      const release = (event: PointerEvent) =>
        host?.action(action, false, `pointer:${event.pointerId}`);
      control.onpointerup = release;
      control.onpointercancel = release;
      control.onlostpointercapture = release;
    });
}
