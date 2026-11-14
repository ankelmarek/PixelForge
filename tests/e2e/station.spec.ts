import { test, expect, type Page } from '@playwright/test';
import type { Snapshot } from '../../src/engine/api/types';
import type { StationUI } from '../../src/games/gas-station/controls';
const key = 'pixelforge:client:v1:gas-station';
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed())
    await info.attach('station-save', {
      body: await page.evaluate(
        (key) => localStorage.getItem(key) ?? 'null',
        key,
      ),
      contentType: 'application/json',
    });
});
async function state(page: Page): Promise<Snapshot> {
  return page
    .locator('#diagnostics')
    .evaluate((e) => JSON.parse(e.dataset.state!));
}
async function ui(page: Page) {
  return (await state(page)).client as unknown as StationUI;
}
async function open(page: Page, resume = false) {
  await page.goto('/?diagnostics=1');
  await page.locator('[data-game="gas-station"]').click();
  await expect(page.locator(resume ? '#resume' : '#start')).toBeEnabled({
    timeout: 15000,
  });
  await page.locator(resume ? '#resume' : '#start').click();
  await expect.poll(async () => (await state(page)).stats?.ready).toBe(true);
}
async function tab(page: Page, name: string) {
  const button = page.locator(`.station-tabs [data-st-tab="${name}"]`);
  if ((await button.getAttribute('aria-pressed')) !== 'true')
    await button.click();
}

test('S1: pełna zmiana myszą, rozbudowa, cysterna, zapis podczas rozładunku i finał', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Pełna zmiana na desktopie; dotyk ma osobny scenariusz.');
  test.setTimeout(240000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await tab(page, 'fuel');
  await page.locator('[data-st-order="on"][data-litres="200"]').click();
  await tab(page, 'build');
  await page.locator('[data-st-preview]').click();
  await expect(page.locator('[data-st-commit]')).toBeEnabled();
  await page.locator('[data-st-commit]').click();
  await page.locator('[data-st-close]').click();
  await page.locator('[data-st-speed="4"]').click();
  await expect
    .poll(async () => Number((await state(page)).stats?.deliveryReceived), {
      timeout: 75000,
      intervals: [250],
    })
    .toBeGreaterThan(0);
  await page.locator('#pause').click();
  const paused = await state(page);
  await page.waitForTimeout(200);
  expect((await state(page)).stats?.tick).toBe(paused.stats?.tick);
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    key,
  );
  expect(saved.state.delivery.received).toBeGreaterThan(0);
  expect(saved.state.delivery.cargo.quantity).toBeGreaterThan(0);
  await page.reload();
  await page.locator('[data-game="gas-station"]').click();
  await page.locator('#resume').click();
  await expect.poll(async () => (await state(page)).stats?.ready).toBe(true);
  expect(
    Number((await state(page)).stats?.deliveryReceived),
  ).toBeGreaterThanOrEqual(saved.state.delivery.received);
  await tab(page, 'fuel');
  let second = false;
  while (!(await state(page)).completed && !(await state(page)).failed) {
    const s = await state(page),
      v = await ui(page);
    if (
      !second &&
      s.stats?.delivery === '' &&
      v.tanks.find((t) => t.fuel === 'e95')!.can200
    ) {
      await page.locator('[data-st-order="e95"][data-litres="200"]').click();
      second = true;
    }
    if (Number(s.stats?.tick) > 3400 && Number(s.stats?.tick) < 3600) {
      await page.locator('[data-st-close]').click();
      await page.screenshot({
        path: 'test-results/station-shift.png',
        style: '#diagnostics{visibility:hidden}',
      });
      await tab(page, 'fuel');
    }
    await page.waitForTimeout(700);
  }
  const end = await state(page);
  expect(end.completed, JSON.stringify(end.stats)).toBe(true);
  expect(second).toBe(true);
  expect(Number(end.stats?.served)).toBeGreaterThanOrEqual(12);
  expect(Number(end.stats?.profit)).toBeGreaterThan(0);
  expect(end.stats?.thirdPump).toBe(true);
  expect(Number(end.stats?.deliveries)).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#result-title')).toHaveText('Dobry początek!');
  await expect(page.locator('#result-values')).toContainText('Zysk operacyjny');
  expect(errors).toEqual([]);
  await page.screenshot({
    path: 'test-results/station-result.png',
    style: '#diagnostics{visibility:hidden}',
  });
  await page.reload();
  await page.locator('[data-game="gas-station"]').click();
  await page.locator('#resume').click();
  await expect(page.locator('#result-title')).toHaveText('Dobry początek!');
});

test('S1: dotyk/mysz, zoom 0.5, panorama, zamówienie, anulowanie, pauza i odświeżenie', async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const press = async (selector: string) => {
    const b = page.locator(selector);
    if (isMobile) await b.tap();
    else await b.click();
  };
  await press('.station-tabs [data-st-tab="fuel"]');
  const initial = (await ui(page)).cash;
  await press('[data-st-order="on"][data-litres="200"]');
  expect((await ui(page)).cash).toBe(initial - 94000);
  await press('[data-st-cancel-delivery]');
  expect((await ui(page)).cash).toBe(initial);
  await press('[data-st-close]');
  await press('#zoom-out');
  await expect.poll(async () => (await state(page)).camera?.zoom).toBe(0.5);
  const before = (await state(page)).camera!;
  const r = (await page.locator('#stage canvas').boundingBox())!;
  if (isMobile) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: r.width * 0.6, y: r.height * 0.55 }],
    });
    for (let i = 1; i <= 8; i++)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: r.width * 0.6 + i * 10, y: r.height * 0.55 + i * 4 },
        ],
      });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();
  } else {
    await page.mouse.move(r.width * 0.6, r.height * 0.55);
    await page.mouse.down();
    await page.mouse.move(r.width * 0.6 + 100, r.height * 0.55 + 60, {
      steps: 10,
    });
    await page.mouse.up();
  }
  await expect
    .poll(async () => (await state(page)).camera?.scrollX)
    .not.toBe(before.scrollX);
  await press('#zoom-in');
  expect((await state(page)).camera!.zoom).toBeGreaterThan(0.5);
  await press('#mute');
  await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
  await press('#pause');
  const paused = await state(page);
  await page.waitForTimeout(200);
  expect((await state(page)).stats?.tick).toBe(paused.stats?.tick);
  await page.reload();
  await page.locator('[data-game="gas-station"]').click();
  await press('#resume');
  await expect.poll(async () => (await state(page)).stats?.ready).toBe(true);
  expect(Number((await state(page)).stats?.tick)).toBeGreaterThanOrEqual(
    Number(paused.stats?.tick),
  );
  expect((await state(page)).camera?.zoom).toBe(paused.camera?.zoom);
  await press('#focus');
  await page.screenshot({
    path: `test-results/station-${isMobile ? 'mobile' : 'desktop'}.png`,
    style: '#diagnostics{visibility:hidden}',
  });
  await page.setViewportSize(
    isMobile ? { width: 844, height: 390 } : { width: 1280, height: 720 },
  );
  await expect(page.locator('.station-tabs')).toBeVisible();
  const box = await page.locator('#stage canvas').boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(isMobile ? 844 : 1280);
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 568 });
    for (const button of await page
      .locator('.station-tabs button, .toolbar button, .station-ledger button')
      .all()) {
      if (!(await button.isVisible())) continue;
      const rect = (await button.boundingBox())!;
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(
        await button.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          );
        }),
      ).toBe(true);
    }
    await press('.station-tabs [data-st-tab="fuel"]');
    await press('[data-st-order="on"][data-litres="200"]');
    await press('[data-st-cancel-delivery]');
    await press('[data-st-close]');
    await page.screenshot({
      path: 'test-results/station-mobile-narrow.png',
      style: '#diagnostics{visibility:hidden}',
    });
  }
  expect(errors).toEqual([]);
});

test('S1: uszkodzony zapis jest izolowany, brak zasobu i zły manifest mają diagnostykę', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate((key) => {
    localStorage.setItem(key, '{bad json');
    localStorage.setItem('pixelforge:client:v3:winobranie-rts', 'untouched');
  }, key);
  await open(page, true);
  await expect(page.locator('#message')).toContainText(
    'Zapis Stacji jest uszkodzony',
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem('pixelforge:client:v3:winobranie-rts'),
    ),
  ).toBe('untouched');
  await page.goto('/?diagnostics=1');
  await page.route('**/assets/games/gas-station/shop.png', (r) => r.abort());
  await page.locator('[data-game="gas-station"]').click();
  await expect(page.locator('#error')).toContainText('Brak zasobu: shop');
  await expect(page.locator('#start')).toBeDisabled();
  await page.unroute('**/assets/games/gas-station/shop.png');
  await page.goto('/?diagnostics=1');
  await page.route('**/assets/games/gas-station/world.json', (r) =>
    r.fulfill({ json: { schemaVersion: 2, id: 'wrong' } }),
  );
  await page.locator('[data-game="gas-station"]').click();
  await expect(page.locator('#error')).toContainText('Stacja:');
  await expect(page.locator('#start')).toBeDisabled();
});
