import { test, expect, type Page } from '@playwright/test';
import type { Snapshot } from '../../src/engine/api';
import type { StationUI } from '../../src/games/gas-station/controls';
const state = (page: Page): Promise<Snapshot> =>
  page
    .locator('#diagnostics')
    .evaluate((e) => JSON.parse((e as HTMLElement).dataset.state!));
const ui = async (page: Page) =>
  (await state(page)).client as unknown as StationUI;
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed())
    await info.attach('station-v2', {
      body: await page.evaluate(
        () =>
          localStorage.getItem('pixelforge:client:v2:gas-station') ?? 'null',
      ),
      contentType: 'application/json',
    });
});
async function tab(page: Page, name: string) {
  const b = page.locator(`.station-tabs [data-st-tab="${name}"]`);
  if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
}
async function screen(page: Page, x: number, y: number) {
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
test('S2: własna droga i stanowisko, cennik, personel, zapis v2 oraz obie kolejki Skoczki', async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    'Pełna rozbudowa na komputerze, podstawowe akcje dotykowe w osobnym teście.',
  );
  test.setTimeout(300000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?diagnostics=1');
  await page.locator('[data-game="gas-station"]').click();
  await page.locator('#start').click();
  await expect.poll(async () => (await state(page)).stats?.ready).toBe(true);
  await tab(page, 'build');
  await page.locator('[data-parcel="west"]').click();
  await page.locator('[data-parcel="north"]').click();
  for (const [x, y, tx, ty] of [
    [106, 134, 84, 134],
    [84, 134, 84, 100],
    [84, 100, 148, 100],
    [148, 100, 148, 118],
  ]) {
    await tab(page, 'build');
    await page.locator('[data-project="road"]').click();
    await expect(page.locator('[data-project-controls]')).toBeVisible();
    const a = await screen(page, x, y),
      b = await screen(page, tx, ty);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator('[data-project-confirm]')).toBeEnabled();
    await page.locator('[data-project-confirm]').click();
  }
  await tab(page, 'build');
  await page.locator('[data-project="heavy-pump"]').click();
  const p = await screen(page, 84, 118);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('[data-project-confirm]')).toBeEnabled();
  await page.locator('[data-project-confirm]').click();
  expect((await ui(page)).development!.owned).toEqual([
    'start',
    'west',
    'north',
  ]);
  await tab(page, 'crew');
  await page.locator('[data-hire]').click();
  await tab(page, 'fuel');
  await page.locator('[data-price="on"][data-delta="20"]').click();
  await expect
    .poll(async () => (await ui(page)).development!.prices.on)
    .toBe(600);
  await page.locator('[data-price="on"][data-delta="-20"]').click();
  await page.locator('[data-st-close]').click();
  await page.screenshot({
    path: 'test-results/station-development.png',
    style: '#diagnostics{visibility:hidden}',
  });
  await page.locator('#pause').click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('pixelforge:client:v2:gas-station')!),
  );
  expect(saved.state.development.roads).toHaveLength(4);
  expect(saved.state.development.sites).toHaveLength(1);
  await page.reload();
  await page.locator('[data-game="gas-station"]').click();
  await page.locator('#resume').click();
  await expect.poll(async () => (await state(page)).stats?.roads).toBe(4);
  await page.locator('[data-st-speed="4"]').click();
  let signed = false;
  while (!(await state(page)).completed && !(await state(page)).failed) {
    const v = await ui(page);
    if (v.development!.leaseOffer && !signed) {
      await tab(page, 'shop');
      await page.locator('[data-lease="share"]').click();
      signed = true;
    } else if (!v.delivery && v.seconds < v.duration / 20 - 120) {
      const f = v.tanks.find((t) => t.quantity < 1600 && t.can400);
      if (f) {
        await tab(page, 'fuel');
        await page
          .locator(`[data-st-order="${f.fuel}"][data-litres="400"]`)
          .click();
      } else if (
        v.canGoods &&
        v.goods.reduce((n, g) => n + g.quantity, 0) < 18
      ) {
        await tab(page, 'shop');
        await page.locator('[data-st-goods]').click();
      }
    }
    await page.waitForTimeout(650);
  }
  const final = await ui(page);
  expect(signed).toBe(true);
  expect(final.development!.tenantDeliveries).toBeGreaterThan(0);
  expect(final.development!.turnover).toBeGreaterThan(0);
  expect(final.development!.leaseIncome).toBeGreaterThan(0);
  expect(Number((await state(page)).stats?.sites)).toBe(1);
  expect(errors).toEqual([]);
});
