import { EngineHost, type Action, type AnyGameDefinition } from '../engine/api';
import { games } from '../games/registry';
export function mountApp(root: HTMLElement) {
  root.innerHTML = `
    <header class="masthead"><a class="brand" href="./" aria-label="PixelForge — katalog"><span class="brand-mark">▧</span> PIXEL<span>FORGE</span></a><span class="build-label">LABORATORIUM GIER <i></i> M3 / 0.3.0</span></header>
    <main><section id="catalog" aria-labelledby="catalog-title">
      <p class="eyebrow">MAŁE ŚWIATY. WIELKIE PRZYGODY.</p><h1 id="catalog-title">Każda podróż<br>zaczyna się od <em>piksela.</em></h1>
      <p class="intro">Wybierz świat i zrób pierwszy krok. PixelForge to wspólny silnik dla niezależnych przygód 2D.</p>
      ${games
        .map(
          (
            game,
            index,
          ) => `<article class="game-card" data-game="${index}"><div class="cover"><img alt="" src="${import.meta.env.BASE_URL}${game.catalog?.cover ?? game.assets.background}"><span class="cover-badge">GRYWALNY PROTOTYP</span><div class="cover-art">${game.catalog?.emblem ? `<img alt="" src="${import.meta.env.BASE_URL}${game.catalog.emblem}">` : ''}<span>0${index + 1}</span></div></div>
      <div class="card-content"><p class="eyebrow"></p><h2></h2><p class="description"></p><div class="tags"><span></span></div><button id="${index === 0 ? 'launch' : `launch-${index}`}" class="primary" data-launch="${index}"></button></div></article>`,
        )
        .join('')}

      <p class="catalog-note"><span>02</span> Jeden silnik. Osobne światy. <small>PixelForge / niezależne gry</small></p>
    </section>
    <section id="play" hidden aria-label="Gra demonstracyjna">
      <div class="play-heading"><div><p class="eyebrow">FOREST-DEMO / DEMO</p><h2 id="game-title"></h2></div><button id="exit" class="subtle">← Katalog</button></div>
      <div class="game-frame"><div class="game-topbar"><span>◈ LEŚNA POLANA</span><span id="progress">◇</span></div><div id="stage">
        <div id="canvas-container"></div><div id="overlay" class="overlay"><div class="overlay-card"><p class="eyebrow" id="overlay-kicker">PRZYGOTOWUJEMY ŚWIAT</p><h3 id="overlay-title">Wczytywanie…</h3><p id="overlay-copy"></p><div class="overlay-actions"><button id="start" class="primary" hidden>Nowa wyprawa →</button><button id="resume" hidden>Wznów wyprawę</button></div></div></div>
      </div><div class="game-bottom"><span id="hint" role="status"></span><div><button id="pause" disabled>Pauza</button><button id="restart" disabled>Od nowa</button><button id="mute" aria-pressed="false">Dźwięk: wł.</button></div></div></div>
      <div class="touch-controls" aria-label="Sterowanie dotykowe"><div><button data-action="left" aria-label="Idź w lewo">←</button><button data-action="right" aria-label="Idź w prawo">→</button></div><div><button data-action="interact" aria-label="Interakcja">✦</button><button data-action="jump" aria-label="Skok">↑</button></div></div>

      <div id="simulation-controls" class="simulation-controls" hidden><div id="actor-controls" aria-label="Jednostki"></div><div class="simulation-tools"><button id="cancel-jobs" aria-label="Anuluj zadania wybranej jednostki" disabled>×</button><button id="zoom-out" aria-label="Oddal widok">−</button><button id="zoom-reset" aria-label="Cała mapa">⊙</button><button id="zoom-in" aria-label="Przybliż widok">+</button></div></div>
    </section></main><footer><span>PIXELFORGE <span class="footer-dot">/</span> NIEZALEŻNE ŚWIATY 2D</span><span>Stworzone z pikseli i ciekawości.</span></footer>`;
  const find = <T extends HTMLElement = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const button = (selector: string) => find<HTMLButtonElement>(selector);
  let selectedGame = games[0],
    launchIndex = 0,
    roster = '';
  root.querySelectorAll<HTMLElement>('[data-game]').forEach((card) => {
    const game = games[Number(card.dataset.game)];
    card.querySelector('h2')!.textContent = game.title;
    card.querySelector('.description')!.textContent = game.description;
    card.querySelector('.eyebrow')!.textContent =
      `${game.catalog?.badge ?? 'GRA'} · ${game.id.toUpperCase()}`;
    card.querySelector('.tags span')!.textContent = game.catalog?.detail ?? '';
    card.querySelector('button')!.textContent =
      `${game.catalog?.launchLabel ?? 'Uruchom'} ↗`;
  });
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
    find('#hint').textContent = '';
    button('#pause').disabled = false;
    button('#restart').disabled = false;
    host?.start(resume);
  };
  const open = (game: AnyGameDefinition) => {
    selectedGame = game;
    roster = '';
    find('#actor-controls').replaceChildren();
    for (const key of Object.keys(find('#stage').dataset))
      delete find('#stage').dataset[key];
    find('#play').dataset.mode =
      game.kind === 'simulation' ? 'simulation' : 'platformer';
    find('.touch-controls').hidden = game.kind === 'simulation';
    find('#simulation-controls').hidden = game.kind !== 'simulation';
    find('.play-heading .eyebrow').textContent =
      `${game.id.toUpperCase()} / ${game.catalog?.badge ?? 'GRA'}`;
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
          stage.dataset[key] =
            typeof value === 'object' ? JSON.stringify(value) : String(value);
        });
        find('.game-topbar > span:first-child').textContent =
          `◈ ${state.levelName ?? ''}`;
        find('#progress').textContent =
          state.mode === 'simulation'
            ? `◆ ${state.collected}/${state.total}  ◉ ${state.produced}/${state.goal}`
            : `${'♥'.repeat(state.lives ?? 3)}  ${state.total ? `◆ ${state.collected}/${state.total}  ` : ''}${(state.levelIndex ?? 0) + 1}/${state.levelCount ?? 1}  ${state.activated ? '◈' : '◇'}`;
        if (state.actors) {
          const signature = state.actors.map((actor) => actor.id).join('|');
          if (signature !== roster) {
            roster = signature;
            find('#actor-controls').replaceChildren();
            state.actors.forEach((actor, i) => {
              const control = document.createElement('button');
              control.className = 'actor-card';
              control.dataset.actorId = actor.id;
              control.setAttribute(
                'aria-label',
                actor.kind === 'vehicle' ? 'Pojazd' : `Pracownik ${i + 1}`,
              );
              control.innerHTML =
                '<span class="actor-icon"></span><small>0</small>';
              const icon = control.querySelector<HTMLElement>('.actor-icon')!;
              const sheet = selectedGame.spriteSheets?.[actor.texture];
              icon.style.backgroundImage = `url("${new URL(selectedGame.assets[actor.texture], document.baseURI).href}")`;
              icon.style.width = `${sheet ? (sheet.frameWidth / sheet.frameHeight) * 24 : 24}px`;
              control.onpointerdown = (event) => event.preventDefault();
              control.onclick = () =>
                host?.command({ type: 'select', id: actor.id });
              find('#actor-controls').append(control);
            });
          }
          for (const actor of state.actors) {
            const control = Array.from(
              root.querySelectorAll<HTMLButtonElement>('[data-actor-id]'),
            ).find((button) => button.dataset.actorId === actor.id)!;
            control.dataset.status = actor.status;
            control.setAttribute(
              'aria-pressed',
              String(state.selectedId === actor.id),
            );
            control.querySelector('small')!.textContent = String(
              actor.queue.length + Number(!!actor.current),
            );
          }
          button('#cancel-jobs').disabled = !state.selectedId;
        }
        if ((state.completed || state.failed) && !complete) {
          complete = true;
          showOverlay(
            state.failed ? '◇' : '◈',
            state.failed ? 'Koniec wyprawy' : 'Ukończono',
            '',
          );
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
      !event.repeat &&
      paused &&
      active &&
      !complete &&
      !(event.target instanceof HTMLCanvasElement)
    ) {
      event.preventDefault();
      host?.pause(false);
    }
  });
  root
    .querySelectorAll<HTMLButtonElement>('[data-launch]')
    .forEach((control) => {
      control.onclick = () => {
        launchIndex = Number(control.dataset.launch);
        open(games[launchIndex]);
      };
    });
  for (const id of ['cancel-jobs', 'zoom-in', 'zoom-out', 'zoom-reset'])
    button(`#${id}`).onpointerdown = (event) => event.preventDefault();
  button('#cancel-jobs').onclick = () => host?.command({ type: 'cancel' });
  button('#zoom-in').onclick = () =>
    host?.command({ type: 'zoom', direction: 1 });
  button('#zoom-out').onclick = () =>
    host?.command({ type: 'zoom', direction: -1 });
  button('#zoom-reset').onclick = () =>
    host?.command({ type: 'zoom', direction: 0 });
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
    button(launchIndex === 0 ? '#launch' : `#launch-${launchIndex}`).focus();
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
