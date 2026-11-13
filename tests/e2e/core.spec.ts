import { test, expect, type Page } from '@playwright/test';
import { simulationLevel, platformLevel } from '../fixtures/content';
async function routes(page: Page) {
  await page.route('**/assets/test/simulation.json', (r) =>
    r.fulfill({ json: simulationLevel }),
  );
  await page.route('**/assets/test/platform.json', (r) =>
    r.fulfill({ json: platformLevel }),
  );
}
async function open(page: Page, mode = 'simulation', resume = false) {
  await routes(page);
  await page.goto(`/tests/fixtures/host.html?mode=${mode}`);
  await page.locator(resume ? '#resume' : '#start').click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#telemetry')).toHaveAttribute(
    'data-elapsed',
    /\d/,
  );
}
async function state(page: Page) {
  return page.locator('#telemetry').evaluate((e) => ({
    camera: JSON.parse(e.dataset.camera!),
    actors: JSON.parse(e.dataset.actors!),
    nodes: JSON.parse(e.dataset.nodes!),
    elapsed: Number(e.dataset.elapsed),
    produced: Number(e.dataset.produced),
  }));
}
async function point(page: Page, x: number, y: number) {
  await page.locator('canvas').scrollIntoViewIfNeeded();
  const c = (await state(page)).camera,
    b = (await page.locator('canvas').boundingBox())!;
  return {
    x: b.x + (((x - c.scrollX - 160) * c.zoom + 160) * b.width) / 320,
    y: b.y + (((y - c.scrollY - 90) * c.zoom + 90) * b.height) / 180,
  };
}
async function node(page: Page, id: string) {
  const n = simulationLevel.nodes.find((n) => n.id === id)!;
  const p = await point(
    page,
    (n.x + n.width / 2) * 16,
    (n.y + n.height / 2) * 16,
  );
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(130);
}
test('aktywny katalog nie udostępnia porzuconych tytułów', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Życie Dżdżownicy' }),
  ).toBeVisible();
  await expect(page.locator('body')).not.toContainText(
    /Winobranie|Leśny sygnał/,
  );
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(
    requested.some((url) => /games\/(forest-demo|winobranie)/.test(url)),
  ).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('generyczny przepływ: równoległe zadania, transport, receptura i zakończenie', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await node(page, 'source-1');
  await node(page, 'source-2');
  await node(page, 'processor');
  await expect
    .poll(
      async () =>
        (await state(page)).actors.filter(
          (a: { kind: string; current: unknown }) =>
            a.kind === 'worker' && a.current,
        ).length,
    )
    .toBe(2);
  for (let i = 0; i < 180; i++) {
    const s = await state(page);
    if (s.produced === 8) break;
    const total =
      s.nodes.reduce(
        (sum: number, n: { stock: Record<string, number> }) =>
          sum + Object.values(n.stock).reduce((a, b) => a + b, 0),
        0,
      ) +
      s.actors.reduce(
        (sum: number, a: { cargo: Record<string, number> }) =>
          sum + Object.values(a.cargo).reduce((x, y) => x + y, 0),
        0,
      );
    expect(total).toBe(8);
    const vehicle = s.actors.find((a: { id: string }) => a.id === 'vehicle');
    if (!vehicle.current && !vehicle.queue.length) {
      await node(page, 'depot');
      await node(page, 'processor');
    }
    await page.waitForTimeout(200);
  }
  await expect(page.locator('#telemetry')).toHaveAttribute(
    'data-completed',
    'true',
  );
  expect(errors).toEqual([]);
  await page.locator('#restart').click();
  await expect(page.locator('#telemetry')).toHaveAttribute(
    'data-produced',
    '0',
  );
});
test('kamera, pauza, pełny zapis, izolacja i ekran tytułowy', async ({
  page,
}) => {
  await open(page);
  await node(page, 'source-1');
  await page.locator('#zoom').click();
  await expect
    .poll(async () => (await state(page)).camera.zoom)
    .toBeGreaterThan(0.5);
  const origin = await point(page, 20 * 16, 10 * 16);
  const beforePan = (await state(page)).camera.scrollX;
  await page.mouse.move(origin.x, origin.y);
  await page.mouse.down();
  await page.mouse.move(origin.x + 30, origin.y, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(async () => (await state(page)).camera.scrollX)
    .not.toBe(beforePan);
  await page.locator('#reset').click();
  await page.locator('#pause').click();
  const s = await state(page);
  await page.waitForTimeout(300);
  expect((await state(page)).elapsed).toBe(s.elapsed);
  await page.reload();
  await page.locator('#resume').click();
  await expect
    .poll(async () =>
      (await state(page)).actors.some((a: { current: unknown }) => a.current),
    )
    .toBe(true);
  await page.locator('#dispose').click();
  const saved = await page.evaluate(() =>
    localStorage.getItem('pixelforge:simulation:v1:simulation-fixture'),
  );
  await page.reload();
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#dispose').click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem('pixelforge:simulation:v1:simulation-fixture'),
    ),
  ).toBe(saved);
  await page.goto('/tests/fixtures/host.html?mode=platformer');
  await page.locator('#start').click();
  await page.locator('#dispose').click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem('pixelforge:simulation:v1:simulation-fixture'),
    ),
  ).toBe(saved);
});
test('zachowany adapter fizyki: ruch, skok, kolizja, akcja, pauza i wynik', async ({
  page,
}) => {
  await open(page, 'platformer');
  const telemetry = page.locator('#telemetry');
  await expect(telemetry).toHaveAttribute('data-grounded', 'true');
  const initial = Number(await telemetry.getAttribute('data-y'));
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  expect(Number(await telemetry.getAttribute('data-y'))).toBeLessThan(initial);
  await expect(telemetry).toHaveAttribute('data-grounded', 'true');
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => Number(await telemetry.getAttribute('data-x')))
    .toBeGreaterThan(50);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('ShiftLeft');
  await expect(telemetry).toHaveAttribute('data-activated', 'true');
  await page.locator('#mute').click();
  await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#pause').click();
  await expect(telemetry).toHaveAttribute('data-paused', 'true');
  await page.locator('#pause').click();
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => Number(await telemetry.getAttribute('data-x')))
    .toBeGreaterThan(100);
  await page.waitForTimeout(150);
  expect(Number(await telemetry.getAttribute('data-x'))).toBeLessThan(112);
  await page.keyboard.press('Space');
  await expect(telemetry).toHaveAttribute('data-completed', 'true', {
    timeout: 12000,
  });
  await page.keyboard.up('ArrowRight');
});
test('diagnostyka konfiguracji i brakującego PNG, uszkodzony zapis', async ({
  page,
}) => {
  await routes(page);
  await page.route('**/assets/test/simulation.json', (r) =>
    r.fulfill({ json: { schemaVersion: 999 } }),
  );
  await page.goto('/tests/fixtures/host.html?mode=simulation');
  await expect(page.locator('#error')).toContainText('wersja');
  await page.unroute('**/assets/test/simulation.json');
  await routes(page);
  await page.route('**/assets/test/worker.png', (r) => r.abort());
  await page.reload();
  await expect(page.locator('#error')).toContainText('Brak zasobu');
  await page.unroute('**/assets/test/worker.png');
  await page.evaluate(() =>
    localStorage.setItem(
      'pixelforge:simulation:v1:simulation-fixture',
      '{broken',
    ),
  );
  await page.reload();
  await page.locator('#resume').click();
  await expect(page.locator('#telemetry')).toHaveAttribute(
    'data-produced',
    '0',
  );
});
test('dotyk: wybór, zlecenie i anulowanie', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Wymaga projektu z obsługą dotyku.');
  await open(page);
  let p = await point(page, 17.5 * 16, 18.5 * 16 - 8);
  await page.touchscreen.tap(p.x, p.y);
  const n = simulationLevel.nodes[0];
  p = await point(page, (n.x + n.width / 2) * 16, (n.y + n.height / 2) * 16);
  await page.touchscreen.tap(p.x, p.y);
  await expect
    .poll(async () => (await state(page)).actors[0].current?.target)
    .toBe('source-1');
  await page.locator('#cancel').tap();
  await expect
    .poll(async () => (await state(page)).actors[0].current)
    .toBeNull();
});
