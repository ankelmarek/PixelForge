import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Snapshot } from '../../src/engine/api/types';
import { WormModel } from '../../src/games/earthworm/model';
import { validateWorld } from '../../src/games/earthworm/world';

const key = 'pixelforge:client:v1:earthworm';
const world = validateWorld(
  JSON.parse(
    readFileSync(
      new URL(
        '../../public/assets/games/earthworm/world.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ),
);
const raw = world;
async function state(page: Page): Promise<Snapshot> {
  return page
    .locator('#diagnostics')
    .evaluate((e) => JSON.parse(e.dataset.state!));
}
async function open(page: Page, resume = false) {
  await page.goto('/?diagnostics=1');
  await page.locator('[data-game="earthworm"]').click();
  await page.locator(resume ? '#resume' : '#start').click();
  await expect.poll(async () => (await state(page)).mode).toBe('client');
}
async function point(page: Page, x: number, y: number) {
  const c = (await state(page)).camera!,
    r = (await page.locator('#stage canvas').boundingBox())!;
  return {
    x:
      r.x +
      (((x - c.scrollX - c.width / 2) * c.zoom + c.width / 2) / c.width) *
        r.width,
    y:
      r.y +
      (((y - c.scrollY - c.height / 2) * c.zoom + c.height / 2) / c.height) *
        r.height,
  };
}
async function move(page: Page, x: number, y: number, mobile: boolean) {
  const p = await point(page, x, y);
  if (mobile) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
  await expect
    .poll(async () => {
      const s = await state(page);
      return Math.hypot(s.x! - x, s.y! - y);
    })
    .toBeLessThan(4);
}

test('dżdżownica: mysz/dotyk, pokarm, korzeń, pauza i odtworzenie tuneli', async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  for (const f of raw.food.slice(0, 3)) await move(page, f.x, f.y, isMobile);
  expect((await state(page)).stats?.nutrients).toBe(3);
  await move(page, raw.roots[0].x, raw.roots[0].y, isMobile);
  await expect.poll(async () => (await state(page)).collected).toBe(1);
  await page.locator('#interact').click();
  await expect(page.locator('#interact')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('#pause').click();
  const before = await state(page);
  await page.waitForTimeout(250);
  expect((await state(page)).elapsed).toBe(before.elapsed);
  await page.reload();
  await page.locator('[data-game="earthworm"]').click();
  await page.locator('#resume').click();
  const after = await state(page);
  expect(after.collected).toBe(1);
  expect(after.stats?.tunnels).toBe(before.stats?.tunnels);
  expect(after.x).toBeCloseTo(before.x!, 1);
  await page.locator('#pause').click();
  await page.locator('#restart').click();
  await expect.poll(async () => (await state(page)).collected).toBe(0);
  expect((await state(page)).stats?.tunnels).toBeLessThan(
    Number(before.stats?.tunnels),
  );
  expect(errors).toEqual([]);
});
test('dżdżownica: pełne okno, zoom, krawędzie mapy i zmiana orientacji', async ({
  page,
  isMobile,
}) => {
  await open(page);
  const fits = async () => {
    const stage = (await page.locator('#stage').boundingBox())!,
      size = page.viewportSize()!;
    expect(stage.x).toBe(0);
    expect(stage.y).toBe(0);
    expect(stage.width).toBe(size.width);
    expect(stage.height).toBe(size.height);
    expect(
      await page
        .locator('#stage canvas')
        .evaluate((e) => getComputedStyle(e).imageRendering),
    ).toBe('pixelated');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  };
  await fits();
  for (let i = 0; i < 8; i++) await page.locator('#zoom-out').click();
  expect((await state(page)).camera?.zoom).toBe(0.5);
  const r = (await page.locator('#minimap').boundingBox())!;
  for (const [x, y] of [
    [1, 1],
    [0.01, 0.01],
    [1, 0.01],
    [0.01, 1],
  ]) {
    const px = r.x + (r.width - 2) * x,
      py = r.y + (r.height - 2) * y;
    if (isMobile) await page.touchscreen.tap(px, py);
    else await page.mouse.click(px, py);
    await page.waitForTimeout(120);
    const s = await state(page),
      c = s.camera!;
    expect(Number(s.stats?.textureBytes)).toBeLessThanOrEqual(20 * 1024 * 1024);
    const viewX = c.scrollX + c.width / 2 - c.width / 2 / c.zoom,
      viewY = c.scrollY + c.height / 2 - c.height / 2 / c.zoom;
    expect(viewX).toBeGreaterThanOrEqual(-1);
    expect(viewY).toBeGreaterThanOrEqual(-1);
    expect(viewX + c.width / c.zoom).toBeLessThanOrEqual(4097);
    expect(viewY + c.height / c.zoom).toBeLessThanOrEqual(4097);
  }
  await page.locator('#focus').click();
  await page.setViewportSize(
    isMobile ? { width: 839, height: 412 } : { width: 1000, height: 600 },
  );
  await fits();
  await expect(page.locator('#error')).toBeEmpty();
  const texts = await page.locator('.game-shell').innerText();
  expect(texts).not.toMatch(/Naciśnij|Kliknij|WASD|Shift|tutorial|zbierz/i);
  const buttons = await page.locator('.toolbar button').evaluateAll((es) =>
    es.map((e) => ({
      w: e.getBoundingClientRect().width,
      h: e.getBoundingClientRect().height,
    })),
  );
  expect(buttons.every((b) => b.w >= 44 && b.h >= 44)).toBe(true);
});
test('dżdżownica: kierunki, Escape, dźwięk i utrata fokusu', async ({
  page,
  isMobile,
}) => {
  await open(page);
  const initial = await state(page);
  if (isMobile) {
    const b = page.locator('[data-action="up"]'),
      r = (await b.boundingBox())!;
    await page.mouse.move(r.x + 20, r.y + 20);
    await page.mouse.down();
    await page.waitForTimeout(250);
    await page.mouse.up();
  } else {
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyW');
  }
  await expect
    .poll(async () => (await state(page)).y)
    .toBeLessThan(initial.y! - 5);
  await page.locator('#mute').click();
  await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
  if (!isMobile) {
    await page.keyboard.press('Escape');
    await expect(page.locator('#session-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#session-menu')).toBeHidden();
  }
  await page.locator('#back').focus();
  await expect(page.locator('#session-menu')).toBeVisible();
  await page.locator('#continue').click();
  await expect(page.locator('#session-menu')).toBeHidden();
});
test('dżdżownica: brak PNG, błędna mapa, uszkodzony zapis i izolacja Atlasu', async ({
  page,
}) => {
  await page.route('**/assets/games/earthworm/world.json', (r) =>
    r.fulfill({ json: { schemaVersion: 99 } }),
  );
  await page.goto('/');
  await page.locator('[data-game="earthworm"]').click();
  await expect(page.locator('#error')).toContainText('wersja');
  await page.unroute('**/assets/games/earthworm/world.json');
  await page.route('**/assets/games/earthworm/creatures.png', (r) => r.abort());
  await page.locator('#back').click();
  await page.locator('[data-game="earthworm"]').click();
  await expect(page.locator('#error')).toContainText('Brak zasobu');
  await page.unroute('**/assets/games/earthworm/creatures.png');
  await page.evaluate(
    ({ key }) => {
      localStorage.setItem(key, '{broken');
      localStorage.setItem('pixelforge:simulation:v2:sentinel', 'untouched');
    },
    { key },
  );
  await open(page, true);
  expect((await state(page)).collected).toBe(0);
  await page.locator('#back').click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem('pixelforge:simulation:v2:sentinel'),
    ),
  ).toBe('untouched');
});
test('dżdżownica: wygrana i porażka po wznowieniu, wynik oraz nowa gra', async ({
  page,
  isMobile,
}) => {
  // Controlled near-end save checks the actual UI. Full production route is exercised headlessly.
  const m = new WormModel(world),
    root = world.roots.at(-1)!;
  m.state.roots = world.roots.map((r, i) => (i < 11 ? r.need : r.need - 1));
  m.state.nutrients = 1;
  m.state.x = root.x - 60;
  m.state.y = root.y;
  m.state.checkpoint = 10;
  await page.goto('/');
  await page.evaluate(
    ({ key, state }) =>
      localStorage.setItem(
        key,
        JSON.stringify({ schemaVersion: 1, gameId: 'earthworm', state }),
      ),
    { key, state: m.snapshot() },
  );
  await open(page, true);
  await move(page, root.x, root.y, isMobile);
  await expect(
    page.getByRole('heading', { name: 'Ogród znów żyje' }),
  ).toBeVisible();
  await page.locator('#restart').click();
  await expect.poll(async () => (await state(page)).collected).toBe(0);
  await page.locator('#back').click();
  m.reset();
  m.state.lives = 0;
  m.state.failed = true;
  await page.evaluate(
    ({ key, state }) =>
      localStorage.setItem(
        key,
        JSON.stringify({ schemaVersion: 1, gameId: 'earthworm', state }),
      ),
    { key, state: m.snapshot() },
  );
  await open(page, true);
  await expect(
    page.getByRole('heading', { name: 'Koniec wyprawy' }),
  ).toBeVisible();
  await page.locator('#restart').click();
  await expect.poll(async () => (await state(page)).lives).toBe(3);
});
