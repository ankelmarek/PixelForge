import { test, expect, type Page } from '@playwright/test';
import type { Snapshot } from '../../src/engine/api/types';
async function state(page: Page): Promise<Snapshot> {
  return page
    .locator('#diagnostics')
    .evaluate((e) => JSON.parse(e.dataset.state!));
}
async function settled(page: Page) {
  await expect
    .poll(async () => (await state(page)).world?.missing, { timeout: 15000 })
    .toBe(0);
}
async function open(page: Page, size = 4096, resume = false) {
  await page.goto('/?diagnostics=1');
  await page.locator(`[data-world="${size}"]`).click();
  await page.locator(resume ? '#resume' : '#start').click();
  await expect(page.locator('#diagnostics')).toHaveAttribute(
    'data-state',
    /world/,
  );
  await settled(page);
}
async function worldPoint(page: Page, x: number, y: number) {
  const canvas = page.locator('#stage canvas');
  await canvas.scrollIntoViewIfNeeded();
  const b = (await canvas.boundingBox())!,
    c = (await state(page)).camera!;
  return {
    x: b.x + (((x - c.scrollX - 160) * c.zoom + 160) * b.width) / 320,
    y: b.y + (((y - c.scrollY - 90) * c.zoom + 90) * b.height) / 180,
  };
}
async function clickWorld(page: Page, x: number, y: number) {
  const p = await worldPoint(page, x, y);
  await page.mouse.click(p.x, p.y);
}
async function mapPoint(page: Page, u: number, v: number) {
  const map = page.locator('#minimap');
  await map.scrollIntoViewIfNeeded();
  const b = (await map.boundingBox())!;
  await page.mouse.click(
    b.x + Math.min(b.width - 1, Math.max(1, b.width * u)),
    b.y + Math.min(b.height - 1, Math.max(1, b.height * v)),
  );
  await settled(page);
}
for (const size of [4096, 8192])
  test(`${size}: sektory, narożniki, zoom, culling i wejście myszy`, async ({
    page,
  }) => {
    const errors: string[] = [],
      sectors = new Set<string>();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (/chunks\//.test(r.url())) sectors.add(r.url());
    });
    await open(page, size);
    expect(sectors.size).toBeLessThan(20);
    const first = await state(page);
    expect(first.world?.width).toBe(size);
    await page.locator('#zoom-out').click();
    await expect
      .poll(async () => (await state(page)).camera!.zoom)
      .toBeLessThan(first.camera!.zoom);
    await page.locator('#stage canvas').scrollIntoViewIfNeeded();
    const b = (await page.locator('#stage canvas').boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.15, b.y + b.height * 0.7);
    await page.mouse.wheel(0, -200);
    await expect
      .poll(async () => (await state(page)).camera!.zoom)
      .toBeCloseTo(first.camera!.zoom);
    const panBefore = (await state(page)).camera!.scrollX;
    await page.mouse.move(b.x + b.width * 0.15, b.y + b.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.7, {
      steps: 10,
    });
    await page.mouse.up();
    await expect
      .poll(async () => (await state(page)).camera!.scrollX)
      .toBeLessThan(panBefore - 10);
    for (let i = 0; i < 5; i++) await page.locator('#zoom-out').click();
    for (const [u, v] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0.5, 0.5],
    ]) {
      await mapPoint(page, u, v);
      const s = await state(page),
        c = s.camera!,
        w = c.width / c.zoom,
        h = c.height / c.zoom;
      const left = c.scrollX + 160 - w / 2,
        top = c.scrollY + 90 - h / 2;
      expect(left).toBeGreaterThanOrEqual(-1);
      expect(top).toBeGreaterThanOrEqual(-1);
      expect(left + w).toBeLessThanOrEqual(size + 1);
      expect(top + h).toBeLessThanOrEqual(size + 1);
      if (u === 0) expect(left).toBeLessThan(2);
      if (v === 0) expect(top).toBeLessThan(2);
      if (u === 1) expect(left + w).toBeGreaterThan(size - 2);
      if (v === 1) expect(top + h).toBeGreaterThan(size - 2);
      expect(s.world!.resident).toBeLessThanOrEqual(24);
      expect(s.world!.rendered).toBeLessThanOrEqual(20);
      expect(s.world!.actorsRendered).toBe(
        s.actors!.filter(
          (a) =>
            (a.x + 0.5) * 16 >= left - 80 &&
            (a.x + 0.5) * 16 <= left + w + 80 &&
            (a.y + 0.5) * 16 >= top - 80 &&
            (a.y + 0.5) * 16 <= top + h + 80,
        ).length,
      );
    }
    expect((await state(page)).world!.evictions).toBeGreaterThan(0);
    await page.locator('#zoom-reset').click();
    await settled(page);
    await expect
      .poll(async () => (await state(page)).world!.actorsRendered)
      .toBe(3);
    expect(errors).toEqual([]);
    await expect(page.locator('#error')).toBeEmpty();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator('#stage canvas')
        .evaluate((e) => getComputedStyle(e).imageRendering),
    ).toMatch(/pixelated|crisp-edges/);
    await expect(page.locator('.lab')).not.toContainText(
      /Naciśnij|Przeciągnij|Kliknij|Shift|WASD/,
    );
  });
test('zadanie między sektorami trwa poza ekranem, kamera i trasa wracają po odświeżeniu', async ({
  page,
}) => {
  await open(page);
  await clickWorld(page, 43 * 16, 24.5 * 16);
  await expect
    .poll(async () => (await state(page)).actors!.some((a) => a.current))
    .toBe(true);
  await mapPoint(page, 0.8, 0.8);
  await expect
    .poll(async () => (await state(page)).world!.actorsRendered)
    .toBe(0);
  await expect
    .poll(
      async () =>
        (await state(page)).nodes!.find((n) => n.id === 'depot')!.stock.raw ??
        0,
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
  await page.locator('#pause').click();
  const saved = await state(page),
    seconds = saved.elapsed;
  await page.waitForTimeout(250);
  expect((await state(page)).elapsed).toBe(seconds);
  await open(page, 4096, true);
  const resumed = await state(page);
  expect(resumed.elapsed).toBeGreaterThanOrEqual(seconds!);
  expect(resumed.camera!.scrollX).toBeCloseTo(saved.camera!.scrollX, 0);
  expect(
    resumed.nodes!.find((n) => n.id === 'depot')!.stock.raw,
  ).toBeGreaterThan(0);
  await page.locator('[data-focus="remote-source"]').click();
  await settled(page);
  await clickWorld(page, (256 - 11) * 16, (256 - 13.5) * 16);
  await expect
    .poll(async () =>
      (await state(page)).actors!.some(
        (a) => a.current?.target === 'remote-source',
      ),
    )
    .toBe(true);
  await page.locator('#pause').click();
  const before = (await state(page)).actors!.find(
    (a) => a.current?.target === 'remote-source',
  )!;
  expect(before.current!.path.length).toBeGreaterThan(200);
  await open(page, 4096, true);
  const after = (await state(page)).actors!.find((a) => a.id === before.id)!;
  expect(after.current?.target).toBe('remote-source');
  expect(after.current!.path.length).toBeGreaterThan(200);
  await page.locator('#pause').click();
  await page.locator('#restart').click();
  await expect.poll(async () => (await state(page)).elapsed).toBeLessThan(2);
  await expect
    .poll(async () => (await state(page)).actors!.every((a) => !a.current))
    .toBe(true);
});
test('błędny sektor, brak atlasu i uszkodzony zapis mają bezpieczną obsługę', async ({
  page,
}) => {
  await page.route('**/chunks/*.json', (r) =>
    r.fulfill({ json: { schemaVersion: 99 } }),
  );
  await page.goto('/?diagnostics=1');
  await page.locator('[data-world="4096"]').click();
  await page.locator('#start').click();
  await expect(page.locator('#error')).toContainText('Sektor');
  await page.unroute('**/chunks/*.json');
  await page.route('**/tiles.png', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await page.locator('[data-world="4096"]').click();
  await expect(page.locator('#error')).toContainText('Brak zasobu');
  await page.unroute('**/tiles.png');
  await page.evaluate(() =>
    localStorage.setItem('pixelforge:world:v2:world-lab-4096', '{broken'),
  );
  await open(page, 4096, true);
  await expect(page.locator('#error')).toBeEmpty();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/world-4096.json', async (route) => {
    const response = await route.fetch(),
      raw = await response.json();
    raw.terrain.frames = 32;
    await route.fulfill({ json: raw });
  });
  await page.goto('/?diagnostics=1');
  await page.locator('[data-world="4096"]').click();
  await page.locator('#start').click();
  await expect(page.locator('#error')).toContainText('atlas ma mniej klatek');
  await page.locator('#zoom-in').click();
  await page.locator('#back').click();
  expect(errors).toEqual([]);
});
test('dotyk: zaznaczenie, zlecenie i minimapa', async ({ page, isMobile }) => {
  test.skip(
    !isMobile,
    'Scenariusz rzeczywistego wejścia dotykowego w emulacji telefonu',
  );
  await open(page);
  let p = await worldPoint(page, 35.5 * 16, 24.5 * 16 - 10);
  await page.touchscreen.tap(p.x, p.y);
  await expect
    .poll(async () => (await state(page)).selectedId)
    .toBe('worker-1');
  p = await worldPoint(page, 43 * 16, 24.5 * 16);
  await page.touchscreen.tap(p.x, p.y);
  await expect
    .poll(async () => (await state(page)).actors![0].current?.target)
    .toBe('source');
  const canvas = page.locator('#stage canvas');
  await canvas.scrollIntoViewIfNeeded();
  const b = (await canvas.boundingBox())!,
    before = (await state(page)).camera!.scrollX;
  const client = await page.context().newCDPSession(page);
  const startX = b.x + b.width * 0.1,
    startY = b.y + b.height * 0.75;
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }],
  });
  for (let i = 1; i <= 8; i++)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: startX + i * 4, y: startY }],
    });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect
    .poll(async () => (await state(page)).camera!.scrollX)
    .toBeLessThan(before - 10);
  await client.detach();
  await page.locator('#minimap').tap({ position: { x: 70, y: 70 } });
  await settled(page);
  await expect
    .poll(async () => (await state(page)).world!.actorsRendered)
    .toBe(0);
});

test('ekran tytułowy zachowuje zapis, a szybkie wyjście przerywa ładowanie sektorów', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await clickWorld(page, 43 * 16, 24.5 * 16);
  await expect
    .poll(async () => (await state(page)).actors!.some((a) => a.current))
    .toBe(true);
  await page.locator('#back').click();
  const saved = await page.evaluate(() =>
    localStorage.getItem('pixelforge:world:v2:world-lab-4096'),
  );
  await page.locator('[data-world="4096"]').click();
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#back').click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem('pixelforge:world:v2:world-lab-4096'),
    ),
  ).toBe(saved);
  await page.route('**/chunks/*.json', async (route) => {
    await new Promise((r) => setTimeout(r, 300));
    await route.continue().catch(() => {});
  });
  await page.locator('[data-world="8192"]').click();
  await page.locator('#start').click();
  await page.locator('#back').click();
  await page.waitForTimeout(400);
  await expect(
    page.getByRole('heading', { name: 'Brak aktywnych tytułów' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
