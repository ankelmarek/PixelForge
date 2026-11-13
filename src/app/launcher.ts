import { games } from '../games/registry';
export function mountApp(root: HTMLElement) {
  root.innerHTML = `<header><a class="brand" href="./">▧ PIXEL<span>FORGE</span></a><span class="phase">MAŁE ŻYCIE / WIELKIE ŚWIATY</span></header>
  <main><section class="game-catalog" aria-labelledby="catalog-title"><div class="section-heading"><h2 id="catalog-title">Gry</h2><span id="game-count"></span></div><div id="game-list"></div></section>
  <section class="demo-card"><img src="assets/demos/large-world/cover.png" alt="Pixel art: droga, łąka i budynek laboratorium"><div><p class="eyebrow">DEMONSTRACJA TECHNICZNA / P1</p><h2>Atlas. Więcej przestrzeni.</h2><p>Świat sektorowy z kamerą, jednostkami i zapisem.</p><div class="demo-actions"><button data-world="4096">Otwórz 4096 × 4096</button><button data-world="8192">8192 × 8192</button></div></div></section>
  </main><footer>PIXELFORGE · SILNIK NIEZALEŻNY OD TREŚCI GIER</footer>`;
  root.querySelector('#game-count')!.textContent =
    `${games.length} ${games.length === 1 ? 'tytuł' : 'tytułów'}`;
  for (const game of games) {
    if (game.kind !== 'client') continue;
    const article = document.createElement('article');
    article.className = 'game-card';
    const image = document.createElement('img');
    image.src = game.catalog.cover;
    image.alt = '';
    const content = document.createElement('div'),
      title = document.createElement('h1'),
      description = document.createElement('p'),
      button = document.createElement('button');
    title.textContent = game.title;
    description.textContent = game.description;
    button.textContent = game.catalog.launchLabel;
    button.dataset.game = game.id;
    content.append(title, description, button);
    article.append(image, content);
    root.querySelector('#game-list')!.append(article);
    button.addEventListener('click', async () => {
      button.disabled = true;
      const { mountGame } = await import('./game');
      mountGame(root, game, () => mountApp(root));
      window.scrollTo(0, 0);
    });
  }
  root.querySelectorAll<HTMLButtonElement>('[data-world]').forEach((button) =>
    button.addEventListener('click', async () => {
      button.disabled = true;
      const { mountWorldLab } = await import('./world-lab');
      mountWorldLab(root, Number(button.dataset.world) as 4096 | 8192, () =>
        mountApp(root),
      );
      window.scrollTo(0, 0);
    }),
  );
}
