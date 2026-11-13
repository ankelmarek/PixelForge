import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const original = JSON.parse(
  readFileSync('public/assets/games/winobranie/world.json', 'utf8'),
);
async function state(page: Page) {
  return page.locator('#stage').evaluate((e) => ({
    elapsed: Number(e.dataset.elapsed),
    collected: Number(e.dataset.collected),
    produced: Number(e.dataset.produced),
    actors: JSON.parse(e.dataset.actors!),
    nodes: JSON.parse(e.dataset.nodes!),
    camera: JSON.parse(e.dataset.camera!),
  }));
}
async function node(page: Page, id: string) {
  await page.locator('canvas').scrollIntoViewIfNeeded();
  const n = original.nodes.find((n: { id: string }) => n.id === id);
  const c = (await state(page)).camera,
    b = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(
    b.x +
      ((((n.x + n.width / 2) * 16 - c.scrollX - 160) * c.zoom + 160) *
        b.width) /
        320,
    b.y +
      ((((n.y + n.height / 2) * 16 - c.scrollY - 90) * c.zoom + 90) *
        b.height) /
        180,
  );
  await page.waitForTimeout(150);
}
async function open(page: Page) {
  await page.goto('/');
  await page.locator('#launch-1').click();
  await page.locator('#start').click();
  await expect(page.locator('#stage')).toHaveAttribute(
    'data-mode',
    'simulation',
  );
  await page.waitForTimeout(250);
}
test('mysz: równoległe zbiory, transport, produkcja i zakończenie', async ({
  page,
}) => {
  const fast = structuredClone(original);
  fast.actors.forEach(
    (a: { speed: number; loadSeconds: number; unloadSeconds: number }) => {
      a.speed = 12;
      a.loadSeconds = 0.05;
      a.unloadSeconds = 0.05;
    },
  );
  fast.nodes.forEach(
    (n: {
      kind: string;
      harvestSeconds: number;
      recipe?: { seconds: number };
    }) => {
      if (n.kind === 'source') n.harvestSeconds = 0.1;
      if (n.recipe) n.recipe.seconds = 0.1;
    },
  );
  await page.route('**/winobranie/world.json', (route) =>
    route.fulfill({ json: fast }),
  );
  await open(page);
  for (const n of fast.nodes.filter(
    (n: { kind: string }) => n.kind === 'source',
  ))
    await node(page, n.id);
  await node(page, 'mill');
  for (let i = 0; i < 120; i++) {
    const s = await state(page);
    if (s.produced === 96) break;
    const a = s.actors.find((a: { id: string }) => a.id === 'carrier');
    if (!a.current && !a.queue.length) {
      if (Object.values(a.cargo).some(Boolean)) {
        await page.locator('[data-actor-id="carrier"]').click();
        await node(page, 'mill');
      } else {
        await node(page, 'yard');
        await node(page, 'mill');
      }
    }
    await page.waitForTimeout(250);
  }
  await expect(page.locator('#stage')).toHaveAttribute(
    'data-completed',
    'true',
  );
  expect((await state(page)).produced).toBe(96);
  await expect(page.locator('#overlay-title')).toHaveText('Ukończono');
});
test('wybór, kamera, kolejki, pauza, wznowienie zapisu i izolacja gier', async ({
  page,
}) => {
  await open(page);
  await node(page, 'row-1');
  await node(page, 'row-2');
  await expect
    .poll(
      async () =>
        (await state(page)).actors.filter(
          (a: { current: unknown }) => a.current,
        ).length,
    )
    .toBe(2);
  await page.locator('[data-actor-id="picker-1"]').click();
  await expect(page.locator('[data-actor-id="picker-1"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('#zoom-in').click();
  await expect
    .poll(async () => (await state(page)).camera.zoom)
    .toBeGreaterThan(0.5);
  const canvas = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(
    canvas.x + canvas.width * 0.5,
    canvas.y + canvas.height * 0.45,
  );
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(200);
  const cameraBefore = (await state(page)).camera;
  await page.mouse.move(
    canvas.x + canvas.width * 0.5,
    canvas.y + canvas.height * 0.45,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvas.x + canvas.width * 0.55,
    canvas.y + canvas.height * 0.5,
    { steps: 5 },
  );
  await page.mouse.up();
  await page.waitForTimeout(200);
  expect((await state(page)).camera.scrollX).not.toBe(cameraBefore.scrollX);
  await page.locator('#zoom-reset').click();
  await page.locator('#pause').click();
  const before = await state(page);
  await page.waitForTimeout(500);
  expect((await state(page)).elapsed).toBe(before.elapsed);
  await page.reload();
  await page.locator('#launch-1').click();
  await page.locator('#resume').click();
  expect(
    (await state(page)).actors.some((a: { current: unknown }) => a.current),
  ).toBe(true);
  await page.locator('[data-actor-id="picker-1"]').click();
  await page.locator('#cancel-jobs').click();
  await page.locator('#exit').click();
  const saved = await page.evaluate(() =>
    localStorage.getItem('pixelforge:simulation:v1:winobranie'),
  );
  await page.locator('#launch').click();
  await page.locator('#start').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-x', /\d/);
  expect(
    await page.evaluate(() =>
      localStorage.getItem('pixelforge:simulation:v1:winobranie'),
    ),
  ).toBe(saved);
});
test('uszkodzony zapis nie blokuje startu; błędna mapa daje diagnostykę', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem('pixelforge:simulation:v1:winobranie', '{broken'),
  );
  await page.locator('#launch-1').click();
  await page.locator('#resume').click();
  expect((await state(page)).collected).toBe(0);
  await page.locator('#exit').click();
  await page.route('**/winobranie/world.json', (route) =>
    route.fulfill({ json: { schemaVersion: 999 } }),
  );
  await page.locator('#launch-1').click();
  await expect(page.locator('#overlay-title')).toHaveText('Coś poszło nie tak');
});

test('brak grafiki daje diagnostykę zamiast pustej gry', async ({ page }) => {
  await page.route('**/winobranie/worker.png', (route) => route.abort());
  await page.goto('/');
  await page.locator('#launch-1').click();
  await expect(page.locator('#overlay-title')).toHaveText('Coś poszło nie tak');
});
test('dotyk wybiera jednostkę i uruchamia zbiór bez klawiatury', async ({
  page,
  isMobile,
}) => {
  test.skip(
    !isMobile,
    'Scenariusz prawdziwych zdarzeń dotykowych w emulacji telefonu.',
  );
  await open(page);
  await page.locator('[data-actor-id="picker-1"]').tap();
  const n = original.nodes.find((n: { id: string }) => n.id === 'row-1');
  const c = (await state(page)).camera,
    b = (await page.locator('canvas').boundingBox())!;
  await page.touchscreen.tap(
    b.x +
      ((((n.x + n.width / 2) * 16 - c.scrollX - 160) * c.zoom + 160) *
        b.width) /
        320,
    b.y +
      ((((n.y + n.height / 2) * 16 - c.scrollY - 90) * c.zoom + 90) *
        b.height) /
        180,
  );
  await expect
    .poll(async () => (await state(page)).actors[0].current?.target)
    .toBe('row-1');
  await page.locator('#cancel-jobs').tap();
  await expect
    .poll(async () => (await state(page)).actors[0].current)
    .toBeNull();
});

test('wyjście z ekranu tytułowego zachowuje istniejący zapis', async ({
  page,
}) => {
  await open(page);
  await node(page, 'row-1');
  await page.waitForTimeout(400);
  await page.locator('#exit').click();
  const saved = await page.evaluate(() =>
    localStorage.getItem('pixelforge:simulation:v1:winobranie'),
  );
  await page.locator('#launch-1').click();
  await expect(page.locator('#start')).toBeVisible();
  await page.locator('#exit').click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem('pixelforge:simulation:v1:winobranie'),
    ),
  ).toBe(saved);
});
