import { test, expect, type Page } from '@playwright/test';
import type { Snapshot } from '../../src/engine/api/types';
import { VineyardModel } from '../../src/games/winobranie-rts/model';
import { validateWorld } from '../../src/games/winobranie-rts/world';
import world from '../../public/assets/games/winobranie-rts/world.json' with { type: 'json' };
const saveKey = 'pixelforge:client:v2:winobranie-rts';
const legacyKey = 'pixelforge:client:v1:winobranie-rts';
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

test('W2: migracja W1, pełny stary sezon myszą i zapis bez utraty zasobów', async ({
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
  const old = new VineyardModel(validateWorld(world), null).snapshot();
  const raw = { ...old, version: 1, revision: 'vineyard-w1' };
  Reflect.deleteProperty(raw, 'environment');
  const legacy = JSON.stringify({
    gameId: 'winobranie-rts',
    schemaVersion: 1,
    state: raw,
  });
  await page.goto('/');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: legacyKey,
    value: legacy,
  });
  await open(page, true);
  const guide = page.locator('.vineyard-guidance');
  await expect(guide).toHaveAttribute('data-guidance', 'first-house');
  await expect(guide).toContainText('Cel sezonu: sprzedaj 40 L moszczu.');
  await expect(guide).toContainText('Zbuduj domek');
  await page.screenshot({
    path: 'test-results/winery-guidance-start.png',
    style: '#diagnostics { visibility: hidden; }',
  });
  await page.locator('[data-guidance-toggle]').click();
  await expect(page.locator('#vineyard-guidance-content')).toBeHidden();
  await page.locator('[data-guidance-toggle]').click();
  await expect(page.locator('#vineyard-guidance-content')).toBeVisible();
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
  await expect(guide).toHaveAttribute('data-guidance', 'placement:Zajęte pole');
  await expect(guide).toContainText('To miejsce jest zajęte');
  for (const x of [268, 280]) await clickCell(page, x, 253);
  await expect.poll(async () => (await state(page)).stats?.buildings).toBe(2);
  await page.locator('[data-cancel]').click();
  await focus(page, 254, 262);
  await page.locator('[data-tool="road"]').click();
  await paint(page, { x: 254, y: 261 }, { x: 254, y: 268 });
  await expect
    .poll(async () => Number((await state(page)).stats?.roadCells))
    .toBeGreaterThan(0);
  const roadCells = Number((await state(page)).stats?.roadCells);
  await paint(page, { x: 258, y: 261 }, { x: 264, y: 267 });
  await expect
    .poll(async () => Number((await state(page)).stats?.roadCells))
    .toBeGreaterThan(roadCells);
  await page.locator('[data-tool="row"]').click();
  await page.locator('[data-variety="regent"]').click();
  await paint(page, { x: 234, y: 268 }, { x: 244, y: 268 });
  await expect.poll(async () => (await state(page)).stats?.rows).toBe(4);
  await paint(page, { x: 248, y: 268 }, { x: 248, y: 274 });
  await expect.poll(async () => (await state(page)).stats?.rows).toBe(5);
  await page.locator('[data-cancel]').click();
  await page.locator('[data-speed="4"]').click();
  await expect
    .poll(async () => Number((await state(page)).stats?.processed), {
      timeout: 40000,
    })
    .toBeGreaterThan(0);
  await expect(guide).toHaveAttribute('data-guidance', 'sale');
  await page.locator('[data-guidance-focus]').click();
  await expect(page.locator('[data-sell]')).toBeVisible();
  await expect(page.locator('[data-sell]')).toBeEnabled();
  await page.screenshot({
    path: 'test-results/winery-guidance-sale.png',
    style: '#diagnostics { visibility: hidden; }',
  });
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
  expect((await state(page)).stats?.rows).toBe(5);
  await expect(guide).toHaveAttribute('data-guidance', 'sale');
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
  const finalSave = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    saveKey,
  );
  expect(finalSave.completed).toBe(true);
  expect(finalSave.tick).toBe(7200);
  expect(finalSave.version).toBe(2);
  expect(finalSave.environment).toBeNull();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), legacyKey),
  ).toBe(legacy);
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
  await expect(guide).toBeHidden();
  expect(errors).toEqual([]);
});

test('W2: nowe losowanie, anulowanie gestu, min zoom i odległe sektory', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Nowa strategia W1: desktop.');
  await open(page);
  const firstSeed = (await state(page)).stats?.seed;
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
  expect((await state(page)).stats?.seed).not.toBe(firstSeed);
});

test('W2: uszkodzony zapis, błędny manifest, brak atlasu i sektora', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Nowa strategia W1: desktop.');
  await page.goto('/');
  const legacyState = {
    ...new VineyardModel(validateWorld(world), null).snapshot(),
    version: 1,
    revision: 'vineyard-w1',
  };
  Reflect.deleteProperty(legacyState, 'environment');
  const legacy = JSON.stringify({
    schemaVersion: 1,
    gameId: 'winobranie-rts',
    state: legacyState,
  });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: legacyKey,
    value: legacy,
  });
  await page.evaluate((key) => localStorage.setItem(key, '{bad'), saveKey);
  await open(page, true);
  await expect(page.locator('#message')).toContainText('uszkodzony');
  expect((await state(page)).client).toMatchObject({ duration: 600 });
  expect(
    await page.evaluate((key) => localStorage.getItem(key), legacyKey),
  ).toBe(legacy);
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

test('W2: sezon z prognozą, instalacją wody, przymrozkiem, wznowieniem i sprzedażą', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Pełna strategia W2 jest odbierana na desktopie.');
  test.setTimeout(260000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // A reproducible new-season save. All construction, watering and sales use the UI.
  const initial = new VineyardModel(validateWorld(world), 731).snapshot();
  await page.goto('/');
  await page.evaluate(
    ({ key, initial }) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          gameId: 'winobranie-rts',
          schemaVersion: 2,
          state: initial,
        }),
      ),
    { key: saveKey, initial },
  );
  await open(page, true);
  await expect(page.locator('.vineyard-weather')).toContainText('Dzień 1 / 30');
  await page.locator('[data-tool="row"]').click();
  await expect(page.locator('[data-variety]:visible')).toHaveCount(6);
  await page.locator('[data-variety="cortis"]').click();
  await expect(page.locator('[data-view="cultivar"]')).toContainText('Późny');
  await page.locator('[data-cancel]').click();
  await page.locator('[data-tool="house"]').click();
  for (const x of [268, 280]) await clickCell(page, x, 253);
  await expect.poll(async () => (await state(page)).stats?.buildings).toBe(2);
  await page.locator('[data-cancel]').click();
  await focus(page, 245, 245);
  for (const [tool, x, y] of [
    ['tank', 228, 243],
    ['pump', 228, 241],
    ['pump', 228, 242],
  ] as const) {
    await page.locator(`[data-tool="${tool}"]`).click();
    await clickCell(page, x, y);
  }
  for (const y of [240, 244]) {
    await page.locator('[data-tool="sprinkler"]').click();
    for (const x of [236, 247, 258]) await clickCell(page, x, y);
    await page.locator('[data-tool="pipe"]').click();
    await paint(page, { x: 228, y }, { x: 258, y });
  }
  await paint(page, { x: 228, y: 240 }, { x: 228, y: 244 });
  await page.locator('[data-cancel]').click();
  await clickCell(page, 228, 243);
  await expect(page.locator('[data-refill]')).toContainText('Zamów 500 L');
  await page.locator('[data-refill]').click();
  await expect(page.locator('[data-refill]')).toBeDisabled();
  await page.locator('[data-cancel]').click();
  await page.locator('[data-speed="4"]').click();
  const ice = async () =>
    Object.values(JSON.parse(String((await state(page)).stats?.crops))).some(
      (c) => (c as { plots: { ice: number }[] }).plots.some((p) => p.ice > 0),
    );
  await expect.poll(ice, { timeout: 40000 }).toBe(true);
  await expect(page.locator('.vineyard-guidance')).toHaveAttribute(
    'data-guidance',
    'thaw',
  );
  await page.screenshot({
    path: 'test-results/winery-w2-frost.png',
    style: '#diagnostics {visibility:hidden}',
  });
  await page.locator('#pause').click();
  const before = await state(page);
  await page.waitForTimeout(200);
  expect((await state(page)).stats?.tick).toBe(before.stats?.tick);
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).state,
    saveKey,
  );
  expect(saved.environment.water.devices).toHaveLength(9);
  expect(saved.environment.water.used).toBeGreaterThan(0);
  await page.reload();
  await page.locator('[data-game="winobranie-rts"]').click();
  await page.locator('#resume').click();
  await expect.poll(async () => (await state(page)).stats?.ready).toBe(true);
  expect((await state(page)).stats?.seed).toBe(731);
  expect(await ice()).toBe(true);
  await page.locator('[data-speed="4"]').click();
  await focus(page, 400, 400);
  const used = JSON.parse(String((await state(page)).stats?.water)).used;
  await expect
    .poll(async () => JSON.parse(String((await state(page)).stats?.water)).used)
    .toBeGreaterThan(used);
  await focus(page, 262, 250);
  while (!(await state(page)).completed && !(await state(page)).failed) {
    const guide = page.locator('.vineyard-guidance');
    if ((await guide.getAttribute('data-guidance')) === 'mildew') {
      await page.locator('[data-guidance-focus]').click();
      if (await page.locator('[data-care]').isVisible())
        await page.locator('[data-care]').click();
      await page.locator('[data-cancel]').click();
      await focus(page, 262, 250);
    }
    for (const x of [268, 280]) {
      if ((await state(page)).completed || (await state(page)).failed) break;
      await clickCell(page, x, 253);
      const sell = page.locator('[data-sell]');
      if ((await sell.isVisible()) && (await sell.isEnabled()))
        await sell.click();
    }
    if (!(await state(page)).completed && !(await state(page)).failed)
      await page.waitForTimeout(2000);
  }
  const final = await state(page);
  expect(final.completed).toBe(true);
  expect(final.stats?.tick).toBe(12000);
  expect(Number(final.stats?.sold)).toBeGreaterThanOrEqual(40000);
  expect(final.stats?.grams).toBe(final.stats?.grown);
  await page.screenshot({
    path: 'test-results/winery-w2-result.png',
    style: '#diagnostics {visibility:hidden}',
  });
  expect(errors).toEqual([]);
});
