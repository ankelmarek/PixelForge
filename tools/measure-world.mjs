/* global process, console, performance, requestAnimationFrame, document, PointerEvent */
/** Reproducible local benchmark; never sends telemetry. Run against Vite preview. */
import { chromium, devices, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.PIXELFORGE_BENCH_URL ?? 'http://127.0.0.1:4194/';
const output =
  process.env.PIXELFORGE_BENCH_OUTPUT ?? 'work/p1/performance.json';
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const device of ['desktop', 'mobile'])
    for (const size of [4096, 8192]) {
      const context = await browser.newContext(
        device === 'mobile'
          ? devices['Pixel 7']
          : { viewport: { width: 1440, height: 1000 } },
      );
      const page = await context.newPage(),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const session = await context.newCDPSession(page);
      await page.goto(`${base}?diagnostics=1`);
      await page.locator(`[data-world="${size}"]`).click();
      await page.locator('#start').click();
      const read = () =>
        page
          .locator('#diagnostics')
          .evaluate((e) => JSON.parse(e.dataset.state));
      await expect.poll(async () => (await read()).world?.missing).toBe(0);
      // Initiate a worker route via real pointer input; background simulation remains active.
      const b = await page.locator('#stage canvas').boundingBox(),
        c = (await read()).camera;
      await page.mouse.click(
        b.x +
          (((43 * 16 - c.scrollX - c.width / 2) * c.zoom + c.width / 2) *
            b.width) /
            c.width,
        b.y +
          (((24.5 * 16 - c.scrollY - c.height / 2) * c.zoom + c.height / 2) *
            b.height) /
            c.height,
      );
      for (let i = 0; i < 5; i++) await page.locator('#zoom-out').click();
      await expect.poll(async () => (await read()).camera.zoom).toBe(0.5);
      await page.waitForTimeout(1000);
      const initialHeap = await session.send('Runtime.getHeapUsage');
      const measured = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const intervals = [],
              samples = [],
              start = performance.now();
            let last,
              step = -1;
            const positions = [
              [0.05, 0.05],
              [0.25, 0.25],
              [0.5, 0.5],
              [0.75, 0.75],
              [0.95, 0.95],
              [0.95, 0.05],
              [0.05, 0.95],
              [0.3, 0.6],
              [0.6, 0.3],
              [0.5, 0.5],
            ];
            function frame(now) {
              if (last !== undefined) intervals.push(now - last);
              last = now;
              const elapsed = now - start,
                index = Math.floor(elapsed / 1000);
              if (index !== step && index < 20) {
                step = index;
                samples.push(
                  JSON.parse(
                    document.querySelector('#diagnostics').dataset.state,
                  ).world,
                );
                const map = document.querySelector('#minimap'),
                  rect = map.getBoundingClientRect(),
                  p = positions[index % positions.length];
                map.dispatchEvent(
                  new PointerEvent('pointerdown', {
                    clientX: rect.left + rect.width * p[0],
                    clientY: rect.top + rect.height * p[1],
                    bubbles: true,
                    cancelable: true,
                  }),
                );
              }
              if (elapsed < 20000) requestAnimationFrame(frame);
              else resolve({ elapsedMs: elapsed, intervals, samples });
            }
            requestAnimationFrame(frame);
          }),
      );
      await expect.poll(async () => (await read()).world?.missing).toBe(0);
      const endHeap = await session.send('Runtime.getHeapUsage');
      await session.send('HeapProfiler.collectGarbage');
      const retainedHeap = await session.send('Runtime.getHeapUsage');
      const intervals = measured.intervals.slice().sort((a, b) => a - b);
      const median = intervals[Math.floor(intervals.length * 0.5)],
        p95 = intervals[Math.floor(intervals.length * 0.95)];
      const result = {
        device,
        size,
        chromium: browser.version(),
        viewport: page.viewportSize(),
        durationMs: measured.elapsedMs,
        frames: intervals.length,
        fps:
          (1000 * intervals.length) /
          measured.intervals.reduce((s, v) => s + v, 0),
        medianFrameMs: median,
        p95FrameMs: p95,
        framesOver50ms: intervals.filter((v) => v > 50).length,
        initialHeap,
        endHeap,
        retainedHeap,
        maxResidentSectors: Math.max(
          ...measured.samples.map((s) => s.resident),
        ),
        maxRenderedSectors: Math.max(
          ...measured.samples.map((s) => s.rendered),
        ),
        maxTextureBytes: Math.max(
          ...measured.samples.map((s) => s.textureBytes),
        ),
        final: (await read()).world,
        errors,
      };
      results.push(result);
      console.log(JSON.stringify(result));
      await context.close();
    }
} finally {
  await browser.close();
  await mkdir(output.slice(0, output.lastIndexOf('/')), { recursive: true });
  await writeFile(
    output,
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        base,
        notes:
          'Headless Chromium, no CPU/network throttling; device emulation is not physical hardware. FPS uses rAF over 20s, 20 camera jumps, simulation active. CDP heap excludes GPU; textureBytes estimates RGBA sector surfaces, not process RSS.',
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
