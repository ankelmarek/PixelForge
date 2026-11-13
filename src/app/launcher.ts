import { games } from '../games/registry';
export function mountApp(root: HTMLElement) {
  root.innerHTML = `<header><a class="brand" href="./">▧ PIXEL<span>FORGE</span></a><span class="phase">DUŻE ŚWIATY / P1</span></header>
  <main><p class="eyebrow">WSPÓLNY SILNIK · NOWY KIERUNEK</p><h1>Fundament dla<br><em>większych światów.</em></h1>
  <p class="lead">PixelForge przygotowuje wspólny runtime dla gier 2D z góry. Sektorowe światy, niezależna symulacja i własny katalog przyszłych tytułów.</p>
  <section class="demo-card"><img src="assets/demos/large-world/cover.png" alt="Pixel art: droga, łąka i budynek laboratorium"><div><p class="eyebrow">DEMONSTRACJA TECHNICZNA / P1</p><h2>Atlas. Więcej przestrzeni.</h2><p>Świat sektorowy z kamerą, jednostkami i zapisem.</p><div class="demo-actions"><button data-world="4096">Otwórz 4096 × 4096</button><button data-world="8192">8192 × 8192</button></div></div></section>
  <section aria-labelledby="catalog-title"><div class="section-heading"><h2 id="catalog-title">Aktywne gry</h2><span id="game-count"></span></div>
  <div class="empty-state" role="status"><span class="empty-icon" aria-hidden="true">▧</span><h3>Brak aktywnych tytułów</h3><p>Nowa gra zostanie wybrana w etapie P3.</p></div></section>
  <div class="modules"><article><span>01</span><h3>Wspólny runtime</h3><p>Sceny, wejście, dźwięk i zapis.</p></article><article><span>02</span><h3>Symulacja</h3><p>Nawigacja, zadania i przepływ zasobów.</p></article><article><span>03</span><h3>Następne etapy</h3><p>Aktualizator ZIP i pierwsza nowa gra.</p></article></div>
  </main><footer>PIXELFORGE · SILNIK NIEZALEŻNY OD TREŚCI GIER</footer>`;
  root.querySelector('#game-count')!.textContent = `${games.length} tytułów`;
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
