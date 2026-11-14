import { test, expect, type Page } from '@playwright/test';
import type { Snapshot } from '../../src/engine/api/types';
const saveKey = 'pixelforge:client:v1:winobranie-rts';
async function state(page: Page): Promise<Snapshot> {
  return page
    .locator('#diagnostics')
    .evaluate((e) => JSON.parse(e.dataset.state!));
}
async function open(page: Page, resume = false) {
  await page.goto('/?diagnostics=1');
  await page.locator('[data-game="winobranie-rts"]').click();
  await page.locator(resume ? '#resume' : '#start').click();
  await expect.poll(async () => (await state(page)).stats?.ready).toBe(true);
}
async function point(page: Page, x: number, y: number) {
  const c = (await state(page)).camera!,
    r = (await page.locator('#stage canvas').boundingBox())!;
  return {
    x:
      r.x +
      (((x * 16 - c.scrollX - c.width / 2) * c.zoom + c.width / 2) / c.width) *
        r.width,
    y:
      r.y +
      (((y * 16 - c.scrollY - c.height / 2) * c.zoom + c.height / 2) /
        c.height) *
        r.height,
  };
}
async function clickCell(page: Page, x: number, y: number) {
  const p = await point(page, x, y);
  await page.mouse.click(p.x, p.y);
}
async function focus(page: Page, x: number, y: number) {
  const r = (await page.locator('#minimap').boundingBox())!;
  await page.mouse.click(r.x + (x / 512) * r.width, r.y + (y / 512) * r.height);
  await page.waitForTimeout(150);
}
async function paint(
  page: Page,
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const start = await point(page, a.x, a.y),
    end = await point(page, b.x, b.y);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

test('W1: pełny sezon samą myszą, budowa, rzędy, transport, sprzedaż i wznowienie', async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    'Odbiór pełnego RTS W1 obejmuje desktop; dotyk strategii jest późniejszym zakresem.',
  );
  test.setTimeout(190000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page.evaluate(() =>
    localStorage.setItem(
      'pixelforge:client:v3:earthworm',
      'W1-isolation-sentinel',
    ),
  );
  await page.locator('[data-tool="house"]').click();
  await clickCell(page, 250, 253);
  expect((await state(page)).stats?.buildings).toBe(0);
  expect((await state(page)).stats?.cash).toBe(3000000);
  for (const x of [268, 280]) await clickCell(page, x, 253);
  await expect.poll(async () => (await state(page)).stats?.buildings).toBe(2);
  await page.locator('[data-cancel]').click();
  await focus(page, 254, 262);
  await page.locator('[data-tool="road"]').click();
  await paint(page, { x: 254, y: 261 }, { x: 254, y: 268 });
  await expect
    .poll(async () => Number((await state(page)).stats?.roadCells))
    .toBeGreaterThan(0);
  await page.locator('[data-tool="row"]').click();
  await page.locator('[data-variety="regent"]').click();
  await paint(page, { x: 234, y: 268 }, { x: 244, y: 268 });
  await expect.poll(async () => (await state(page)).stats?.rows).toBe(4);
  await page.locator('[data-cancel]').click();
  await page.locator('[data-speed="4"]').click();
  await expect
    .poll(async () => Number((await state(page)).stats?.processed), {
      timeout: 40000,
    })
    .toBeGreaterThan(0);
  await page.locator('#pause').click();
  const before = await state(page);
  await page.waitForTimeout(300);
  expect((await state(page)).stats?.tick).toBe(before.stats?.tick);
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    saveKey,
  );
  expect(stored.tick).toBe(before.stats?.tick);
  expect(stored.units.some((u: { job: unknown }) => u.job)).toBe(true);
  await page.reload();
  await page.locator('[data-game="winobranie-rts"]').click();
  await page.locator('#resume').click();
  await expect.poll(async () => (await state(page)).stats?.ready).toBe(true);
  expect((await state(page)).stats?.buildings).toBe(2);
  expect((await state(page)).stats?.rows).toBe(4);
  await page.locator('[data-speed="4"]').click();
  await focus(page, 262, 250);
  let sold = false;
  while (!(await state(page)).completed && !(await state(page)).failed) {
    for (const x of [268, 280]) {
      if ((await state(page)).completed || (await state(page)).failed) break;
      await clickCell(page, x, 253);
      const sell = page.locator('[data-sell]');
      if ((await sell.isVisible()) && (await sell.isEnabled())) {
        await sell.click();
        sold = true;
      }
    }
    if (!(await state(page)).completed && !(await state(page)).failed)
      await page.waitForTimeout(2500);
  }
  expect(sold).toBe(true);
  expect((await state(page)).completed).toBe(true);
  expect(Number((await state(page)).stats?.sold)).toBeGreaterThanOrEqual(40000);
  await expect(page.locator('#result-title')).toHaveText(
    'Pierwsze udane winobranie',
  );
  await expect(page.locator('#result-values')).toContainText(
    'Sprzedany moszcz',
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem('pixelforge:client:v3:earthworm'),
    ),
  ).toBe('W1-isolation-sentinel');
  expect(await page.locator('.game-shell').innerText()).not.toMatch(
    /naciśnij|kliknij|przeciągnij|samouczek/i,
  );
  expect(errors).toEqual([]);
});

test('W1: anulowanie gestu, min zoom, odległe sektory i kontrola pełnego okna', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Nowa strategia W1: desktop.');
  await open(page);
  const size = page.viewportSize()!,
    stage = (await page.locator('#stage').boundingBox())!;
  expect(stage.width).toBe(size.width);
  expect(stage.height).toBe(size.height);
  await page.locator('[data-tool="house"]').click();
  const p = await point(page, 268, 253);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(1, 1);
  await page.mouse.up();
  expect((await state(page)).stats?.buildings).toBe(0);
  await page.locator('[data-cancel]').click();
  for (const [x, y] of [
    [400, 400],
    [80, 350],
    [450, 80],
    [253, 250],
  ]) {
    await focus(page, x, y);
    await expect.poll(async () => (await state(page)).stats?.missing).toBe(0);
    expect(Number((await state(page)).stats?.resident)).toBeLessThanOrEqual(48);
  }
  expect((await state(page)).camera?.zoom).toBe(0.5);
  await page.locator('#mute').click();
  await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#pause').click();
  await page.locator('#restart').click();
  await expect.poll(async () => (await state(page)).stats?.ready).toBe(true);
  expect((await state(page)).stats?.buildings).toBe(0);
});

test('W1: uszkodzony zapis, błędny manifest, brak atlasu i sektora', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Nowa strategia W1: desktop.');
  await page.goto('/');
  await page.evaluate((key) => localStorage.setItem(key, '{bad'), saveKey);
  await open(page, true);
  await expect(page.locator('#message')).toContainText('uszkodzony');
  await page.locator('#back').click();
  await page.route('**/winobranie-rts/world.json', (route) =>
    route.fulfill({ json: { schemaVersion: 999 } }),
  );
  await page.locator('[data-game="winobranie-rts"]').click();
  await expect(page.locator('#error')).not.toBeEmpty();
  await page.unroute('**/winobranie-rts/world.json');
  await page.locator('#back').click();
  await page.route('**/winobranie-rts/objects.png', (route) => route.abort());
  await page.locator('[data-game="winobranie-rts"]').click();
  await expect(page.locator('#error')).toContainText('Brak zasobu');
  await expect(page.locator('#start')).toBeDisabled();
  await page.unroute('**/winobranie-rts/objects.png');
  await page.locator('#back').click();
  await page.route('**/winobranie-rts/sectors/*.json', (route) =>
    route.abort(),
  );
  await page.locator('[data-game="winobranie-rts"]').click();
  await page.locator('#start').click();
  await expect(page.locator('#error')).not.toBeEmpty();
});
