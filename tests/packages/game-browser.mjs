import { chromium, devices, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const archive =
  process.env.PIXELFORGE_TEST_RELEASE ?? 'downloads/pixelforge-0.9.2-full.zip';
const server = spawn(
  'python3',
  ['-u', 'tests/packages/serve_game.py', archive],
  { stdio: ['pipe', 'pipe', 'inherit'] },
);
const lines = createInterface({ input: server.stdout });
const config = await Promise.race([
  once(lines, 'line').then(([line]) => JSON.parse(line)),
  once(server, 'exit').then(() => {
    throw Error('Static fixture failed');
  }),
]);
const browser = await chromium.launch();
const results = [];
try {
  await mkdir('test-results', { recursive: true });
  for (const device of ['desktop', 'mobile'])
    for (const base of ['/', '/PixelForge/']) {
      const context = await browser.newContext(
        device === 'mobile'
          ? devices['Pixel 7']
          : { viewport: { width: 1280, height: 800 } },
      );
      const page = await context.newPage(),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('response', (r) => {
        if (r.status() >= 400 && !r.url().includes('favicon'))
          errors.push(`${r.status()} ${r.url()}`);
      });
      const state = () =>
        page
          .locator('#diagnostics')
          .evaluate((e) => JSON.parse(e.dataset.state));
      await page.goto(
        `http://127.0.0.1:${config.port}${base}index.html?diagnostics=1`,
      );
      await page.locator('[data-game="earthworm"]').click();
      await page.locator('#start').click();
      for (const [x, y] of [
        [680, 456],
        [720, 488],
        [800, 496],
        [768, 528],
      ]) {
        const c = (await state()).camera,
          r = await page.locator('#stage canvas').boundingBox();
        const px =
          r.x +
          (((x - c.scrollX - c.width / 2) * c.zoom + c.width / 2) / c.width) *
            r.width;
        const py =
          r.y +
          (((y - c.scrollY - c.height / 2) * c.zoom + c.height / 2) /
            c.height) *
            r.height;
        if (device === 'mobile') await page.touchscreen.tap(px, py);
        else await page.mouse.click(px, py);
        await expect
          .poll(async () => {
            const s = await state();
            return Math.hypot(s.x - x, s.y - y);
          })
          .toBeLessThan(4);
      }
      await expect.poll(async () => (await state()).stats.blooms).toBe(1);
      await page.locator('#pause').click();
      const saved = await state();
      await page.reload();
      await page.locator('[data-game="earthworm"]').click();
      await page.locator('#resume').click();
      expect((await state()).stats.tunnels).toBe(saved.stats.tunnels);
      await page.locator('#diagnostics').evaluate((e) => {
        e.style.display = 'none';
      });
      if (base === '/PixelForge/') {
        if (device === 'desktop') {
          await page.locator('#zoom-out').click();
          const map = await page.locator('#minimap').boundingBox();
          await page.mouse.click(
            map.x + (768 / 4096) * map.width,
            map.y + (432 / 4096) * map.height,
          );
        }
        await page.screenshot({ path: `test-results/p3-${device}.png` });
        await page.locator('#focus').click();
      }
      for (let i = 0; i < 8; i++) await page.locator('#zoom-out').click();
      expect((await state()).camera.zoom).toBe(0.5);
      await page.keyboard.down('ArrowRight');
      const timings = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const intervals = [],
              start = globalThis.performance.now();
            let previous;
            function frame(now) {
              if (previous !== undefined) intervals.push(now - previous);
              previous = now;
              if (now - start < 6000) globalThis.requestAnimationFrame(frame);
              else resolve(intervals);
            }
            globalThis.requestAnimationFrame(frame);
          }),
      );
      await page.keyboard.up('ArrowRight');
      const stats = (await state()).stats;
      const client = await context.newCDPSession(page);
      await client.send('HeapProfiler.collectGarbage');
      const heap = await client.send('Runtime.getHeapUsage');
      const sorted = timings.toSorted((a, b) => a - b);
      const result = {
        device,
        base,
        chromium: browser.version(),
        firstRoot: true,
        resume: true,
        minZoom: 0.5,
        meanFps:
          Math.round(
            (1000 / (timings.reduce((a, b) => a + b, 0) / timings.length)) * 10,
          ) / 10,
        p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
        retainedHeapBytes: heap.usedSize,
        textureBytes: stats.textureBytes,
        sectors: stats.rendered,
        errors,
      };
      expect(errors).toEqual([]);
      expect(stats.textureBytes).toBeLessThanOrEqual(20 * 1024 * 1024);
      results.push(result);
      process.stdout.write(JSON.stringify(result) + '\n');
      if (device === 'desktop') {
        await page.locator('#back').click();
        await page.locator('[data-game="winobranie-rts"]').click();
        await page.locator('#start').click();
        await expect.poll(async () => (await state()).stats.ready).toBe(true);
        await page.locator('[data-tool="house"]').click();
        const c = (await state()).camera,
          r = await page.locator('#stage canvas').boundingBox();
        await page.mouse.click(
          r.x +
            (((268 * 16 - c.scrollX - c.width / 2) * c.zoom + c.width / 2) /
              c.width) *
              r.width,
          r.y +
            (((253 * 16 - c.scrollY - c.height / 2) * c.zoom + c.height / 2) /
              c.height) *
              r.height,
        );
        await expect.poll(async () => (await state()).stats.buildings).toBe(1);
        await page.locator('[data-cancel]').click();
        await page.locator('[data-speed="4"]').click();
        await expect
          .poll(async () => Number((await state()).stats.processed), {
            timeout: 40000,
          })
          .toBeGreaterThan(0);
        await page.locator('#pause').click();
        const winery = await state();
        await page.reload();
        await page.locator('[data-game="winobranie-rts"]').click();
        await page.locator('#resume').click();
        await expect.poll(async () => (await state()).stats.ready).toBe(true);
        expect((await state()).stats.buildings).toBe(1);
        expect((await state()).stats.processed).toBe(winery.stats.processed);
        await expect.poll(async () => (await state()).stats.missing).toBe(0);
        expect(errors).toEqual([]);
        results.push({
          game: 'winobranie-rts',
          device,
          base,
          installedFromArchive: true,
          constructed: true,
          physicalProcessing: true,
          resumed: true,
          errors,
        });
      }
      await context.close();
    }
  await writeFile(
    'test-results/P3-GAME-BROWSER-RESULTS.json',
    JSON.stringify({ archive, emulationOnly: true, results }, null, 2) + '\n',
  );
} finally {
  await browser.close();
  server.stdin.end('quit\n');
  await once(server, 'exit');
  lines.close();
}
