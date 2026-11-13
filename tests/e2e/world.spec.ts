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
    x:
      b.x +
      (((x - c.scrollX - c.width / 2) * c.zoom + c.width / 2) * b.width) /
        c.width,
    y:
      b.y +
      (((y - c.scrollY - c.height / 2) * c.zoom + c.height / 2) * b.height) /
        c.height,
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
      [0.25, 0.75],
      [0.75, 0.25],
    ]) {
      await mapPoint(page, u, v);
      const s = await state(page),
        c = s.camera!,
        w = c.width / c.zoom,
        h = c.height / c.zoom;
      const left = c.scrollX + c.width / 2 - w / 2,
        top = c.scrollY + c.height / 2 - h / 2;
      expect(left).toBeGreaterThanOrEqual(-1);
      expect(top).toBeGreaterThanOrEqual(-1);
      expect(left + w).toBeLessThanOrEqual(size + 1);
      expect(top + h).toBeLessThanOrEqual(size + 1);
      if (u === 0) expect(left).toBeLessThan(2);
      if (v === 0) expect(top).toBeLessThan(2);
      if (u === 1) expect(left + w).toBeGreaterThan(size - 2);
      if (v === 1) expect(top + h).toBeGreaterThan(size - 2);
      expect(s.world!.resident).toBeLessThanOrEqual(48);
      expect(s.world!.rendered).toBeLessThanOrEqual(42);
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

test('pełne okno, proporcje, obrót i trafianie po zmianie rozmiaru', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 412, height: 839 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(async () => page.locator('#stage').evaluate((e) => e.clientHeight))
      .toBe(viewport.height);
    await expect
      .poll(async () => {
        const c = (await state(page)).camera!;
        return c.width / c.height;
      })
      .toBeCloseTo(viewport.width / viewport.height, 1);
    await settled(page);
    const display = await page
      .locator('#stage canvas')
      .evaluate((e: HTMLCanvasElement) => {
        const b = e.getBoundingClientRect();
        return {
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          sx: b.width / e.width,
          sy: b.height / e.height,
        };
      });
    expect(display.x).toBe(0);
    expect(display.y).toBe(0);
    expect(display.width).toBeGreaterThanOrEqual(viewport.width);
    expect(display.height).toBeGreaterThanOrEqual(viewport.height);
    expect(display.width - viewport.width).toBeLessThan(display.sx);
    expect(display.height - viewport.height).toBeLessThan(display.sy);
    expect(display.sx).toBe(display.sy);
    expect(Number.isInteger(display.sx)).toBe(true);
    for (const button of await page
      .locator('.toolbar button, .landmarks button, #back')
      .all()) {
      const b = (await button.boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(viewport.width);
      expect(b.y + b.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.locator('[data-focus="worker-1"]').click();
    await settled(page);
    await clickWorld(page, 35.5 * 16, 24.5 * 16 - 10);
    await expect
      .poll(async () => (await state(page)).selectedId)
      .toBe('worker-1');
    await page.locator('#zoom-out').click();
    await mapPoint(page, 1, 1);
    const c = (await state(page)).camera!;
    expect(c.scrollX + c.width / 2 + c.width / c.zoom / 2).toBeCloseTo(4096, 0);
    expect(c.scrollY + c.height / 2 + c.height / c.zoom / 2).toBeCloseTo(
      4096,
      0,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
  }
  await page.locator('#back').click();
  await expect(page.locator('.demo-card')).toBeVisible();
  expect(
    await page.evaluate(() => getComputedStyle(document.body).overflow),
  ).not.toBe('hidden');
  expect(errors).toEqual([]);
});

for (const worldSize of [4096, 8192])
  test(`${worldSize}: najdrobniejsze detale nie migają podczas panoramowania przy zoomie 0.5`, async ({
    page,
  }) => {
    // One-pixel checkerboard makes a changing nearest-neighbor sampling phase
    // observable across the entire terrain, even when no sector is missing.
    await page.goto('/?diagnostics=1');
    const atlas = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 16;
      const context = canvas.getContext('2d')!;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 256; x++) {
          context.fillStyle = (x + y) % 2 ? '#e3bb64' : '#244c47';
          context.fillRect(x, y, 1, 1);
        }
      return canvas.toDataURL().split(',')[1];
    });
    await page.route('**/tiles.png', (route) =>
      route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(atlas, 'base64'),
      }),
    );
    await page.locator(`[data-world="${worldSize}"]`).click();
    await page.locator('#start').click();
    for (let i = 0; i < 6; i++) await page.locator('#zoom-out').click();
    await mapPoint(page, 0.5, 0.5);
    expect((await state(page)).camera!.zoom).toBe(0.5);
    const canvas = page.locator('#stage canvas');
    const bounds = (await canvas.boundingBox())!;
    const readPixels = () =>
      canvas.evaluate(
        (element: HTMLCanvasElement) =>
          new Promise<number[]>((resolve) =>
            requestAnimationFrame(() => {
              const gl = (element.getContext('webgl2') ??
                element.getContext('webgl'))!;
              const pixel = new Uint8Array(4);
              gl.readPixels(
                Math.floor(element.width / 2),
                Math.floor(element.height / 2),
                1,
                1,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                pixel,
              );
              resolve([...pixel]);
            }),
          ),
      );
    // Fractional logical moves arise on desktop through integer CSS scaling,
    // and on phones from subpixel mouse/touch coordinates. Exercise both axes.
    const colors = new Set<string>();
    for (const axis of ['x', 'y'] as const) {
      const x = bounds.width * 0.5,
        y = bounds.height * 0.55;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let step = 0; step < 16; step++) {
        const delta = 20 + step * 0.5;
        await page.mouse.move(
          x + (axis === 'x' ? delta : 0),
          y + (axis === 'y' ? delta : 0),
        );
        colors.add((await readPixels()).join(','));
      }
      await page.mouse.up();
    }
    expect(colors.size).toBe(1);
    expect(['227,187,100,255', '36,76,71,255']).toContain([...colors][0]);
    expect((await state(page)).world!.missing).toBe(0);
    await expect(page.locator('#error')).toBeEmpty();
  });
