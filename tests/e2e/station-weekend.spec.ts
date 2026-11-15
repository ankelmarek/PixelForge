import { test, expect, type Page } from '@playwright/test';
import type { Snapshot } from '../../src/engine/api';
import type { StationUI } from '../../src/games/gas-station/controls';
import {
  weekend,
  operateWeekend,
  washRoad,
} from '../fixtures/station-campaign';

test.use({
  trace: {
    mode: 'retain-on-failure',
    screenshots: false,
    snapshots: true,
    sources: true,
  },
});
const key = 'pixelforge:client:v3:gas-station';
const state = (page: Page): Promise<Snapshot> =>
  page
    .locator('#diagnostics')
    .evaluate((e) => JSON.parse((e as HTMLElement).dataset.state!));
const ui = async (page: Page) =>
  (await state(page)).client as unknown as StationUI;
async function tab(page: Page, name: string) {
  const b = page.locator(`.station-tabs [data-st-tab="${name}"]`);
  if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
}
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed())
    await info.attach('station-v3', {
      body: await page.evaluate((k) => localStorage.getItem(k) ?? 'null', key),
      contentType: 'application/json',
    });
});

test('S3: myjnia z budowy do opłaconej usługi oraz wznowienie v3', async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    'Pełny zakup i mycie na desktopie; dotyk sprawdza osobny scenariusz.',
  );
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const m = weekend();
  washRoad(m);
  while (m.state.tick < 9000) {
    operateWeekend(m);
    m.tick();
  }
  m.validateSave(m.snapshot());
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key,
    value: JSON.stringify({
      gameId: 'gas-station',
      schemaVersion: 3,
      state: m.snapshot(),
    }),
  });
  await page.goto('/?diagnostics=1');
  await page.locator('[data-game="gas-station"]').click();
  await page.locator('#resume').click();
  await expect.poll(async () => (await state(page)).stats?.ready).toBe(true);
  expect((await ui(page)).duration).toBe(36000);
  await tab(page, 'build');
  await page.locator('[data-project="wash"]').click();
  await expect(page.locator('[data-project-confirm]')).toBeEnabled();
  await page.locator('[data-project-confirm]').click();
  await page.locator('[data-st-speed="4"]').click();
  let photographed = false,
    restored = false;
  while ((await ui(page)).campaign!.washes < 1) {
    const v = await ui(page);
    if (v.campaign!.canRepair) {
      await tab(page, 'weekend');
      await page.locator('[data-repair]').click();
    }
    if (v.campaign!.washProgress > 80 && !restored) {
      await page.locator('#pause').click();
      const save = await page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)!),
        key,
      );
      expect(save.state.campaign.wash.progress).toBeGreaterThan(0);
      await page.screenshot({
        path: 'test-results/station-wash.png',
        style: '#diagnostics{visibility:hidden}',
      });
      photographed = true;
      await page.reload();
      await page.locator('[data-game="gas-station"]').click();
      await page.locator('#resume').click();
      await expect
        .poll(async () => (await state(page)).stats?.ready)
        .toBe(true);
      restored = true;
    }
    await page.waitForTimeout(200);
  }
  expect(photographed).toBe(true);
  expect(restored).toBe(true);
  await page.locator('#pause').click();
  const save = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(
    save.state.journal.entries.filter(
      (e: { category: string }) => e.category === 'wash-sale',
    ),
  ).toHaveLength(1);
  expect(
    save.state.journal.entries.filter(
      (e: { category: string }) => e.category === 'wash-cost',
    ),
  ).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('S3: cały weekend myszą, trzy zmiany, zapowiedzi, naprawa i wynik', async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    'Całe 30 minut na desktopie, podstawowe czynności na mobile osobno.',
  );
  test.setTimeout(660000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?diagnostics=1');
  await page.locator('[data-game="gas-station"]').click();
  await page.locator('#start').click();
  await expect.poll(async () => (await state(page)).stats?.ready).toBe(true);
  await tab(page, 'build');
  await page.locator('[data-st-preview]').click();
  await page.locator('[data-st-commit]').click();
  await tab(page, 'crew');
  await page.locator('[data-hire]').click();
  await page.locator('[data-hire]').click();
  await tab(page, 'shop');
  await page.locator('[data-second-checkout]').click();
  await page.locator('[data-st-speed="4"]').click();
  const shifts = new Set<string>(),
    events = new Set<string>();
  let repaired = false;
  while (!(await state(page)).completed && !(await state(page)).failed) {
    const v = await ui(page),
      c = v.campaign!;
    shifts.add(c.shift);
    if (c.upcoming) events.add(c.event);
    if (v.workers[3].role !== 'checkout' && !v.workers[3].busy) {
      await tab(page, 'crew');
      await page.locator('[data-st-role="checkout"][data-worker="3"]').click();
    } else if (c.canRepair) {
      await tab(page, 'weekend');
      await page.locator('[data-repair]').click();
      repaired = true;
    } else if (!v.delivery && v.seconds < 1600) {
      const fuel = v.tanks.find(
        (f) => f.quantity < (f.fuel === 'e95' ? 2000 : 1800) && f.can400,
      );
      if (fuel) {
        await tab(page, 'fuel');
        await page
          .locator(`[data-st-order="${fuel.fuel}"][data-litres="400"]`)
          .click();
      } else if (
        v.canGoods &&
        v.goods.reduce((n, g) => n + g.quantity, 0) < 18
      ) {
        await tab(page, 'shop');
        await page.locator('[data-st-goods]').click();
      }
    }
    await page.waitForTimeout(500);
  }
  const final = await ui(page);
  expect((await state(page)).completed).toBe(true);
  expect(shifts).toEqual(new Set(['PIĄTEK', 'SOBOTA', 'NIEDZIELA']));
  expect(events.size).toBeGreaterThanOrEqual(4);
  expect(repaired).toBe(true);
  expect(final.served).toBeGreaterThanOrEqual(60);
  expect(final.satisfaction).toBeGreaterThanOrEqual(70);
  expect(final.seconds).toBe(1800);
  expect(final.profit).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/station-weekend-result.png' });
  expect(errors).toEqual([]);
});

test('S3: panel weekendu, jednorazowa rezerwa i pełne okno na dotyku', async ({
  page,
  isMobile,
}) => {
  const press = async (q: string) =>
    isMobile ? page.locator(q).tap() : page.locator(q).click();
  await page.goto('/?diagnostics=1');
  await press('[data-game="gas-station"]');
  await press('#start');
  await expect.poll(async () => (await state(page)).stats?.ready).toBe(true);
  await press('.station-tabs [data-st-tab="weekend"]');
  const before = await ui(page);
  await press('[data-rescue]');
  await expect(page.locator('[data-rescue]')).toBeDisabled();
  const after = await ui(page);
  expect(after.campaign!.debt).toBe(165000);
  expect(after.revenue).toBe(before.revenue);
  expect(after.cash).toBeGreaterThan(before.cash + 149000);
  for (const b of await page
    .locator('.station-tabs button, [data-rescue]')
    .all()) {
    if (!(await b.isVisible())) continue;
    const r = (await b.boundingBox())!;
    expect(r.width).toBeGreaterThanOrEqual(44);
    expect(r.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({
    path: `test-results/station-weekend-${isMobile ? 'mobile' : 'desktop'}.png`,
    style: '#diagnostics{visibility:hidden}',
  });
});
