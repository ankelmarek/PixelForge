/* global process, console, performance, requestAnimationFrame, document, PointerEvent, localStorage, TextEncoder */
/** Local release-build benchmark. Inputs use the same controls as a player. */
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cpus, totalmem } from 'node:os';

const base = process.env.PIXELFORGE_BENCH_URL ?? 'http://127.0.0.1:4194/';
const output =
  process.env.PIXELFORGE_BENCH_OUTPUT ?? 'work/s2/performance.json';
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  await page.goto(`${base}?diagnostics=1`);
  await page.locator('[data-game="gas-station"]').click();
  await page.locator('#start').click();
  const read = () =>
    page.locator('#diagnostics').evaluate((e) => JSON.parse(e.dataset.state));
  await expect.poll(async () => (await read()).stats?.ready).toBe(true);
  await page.locator('.station-tabs [data-st-tab="fuel"]').click();
  await page.locator('[data-st-order="on"][data-litres="200"]').click();
  await page.locator('.station-tabs [data-st-tab="build"]').click();
  await page.locator('[data-st-preview]').click();
  await page.locator('[data-st-commit]').click();
  await page.locator('[data-st-close]').click();
  await page.locator('[data-st-speed="4"]').click();
  await page.locator('#zoom-out').click();
  await expect.poll(async () => (await read()).camera.zoom).toBe(0.5);
  await page.waitForTimeout(1000);
  const beforeHeap = await cdp.send('Runtime.getHeapUsage');
  const measured = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const intervals = [],
          samples = [],
          start = performance.now();
        const positions = [
          [0.492, 0.5],
          [0.25, 0.25],
          [0.75, 0.25],
          [0.75, 0.75],
          [0.25, 0.75],
          [0.492, 0.5],
        ];
        let last,
          second = -1;
        function frame(now) {
          if (last !== undefined) intervals.push(now - last);
          last = now;
          const elapsed = now - start,
            next = Math.floor(elapsed / 1000);
          if (next !== second) {
            second = next;
            const s = JSON.parse(
              document.querySelector('#diagnostics').dataset.state,
            );
            samples.push({ ...s.stats, terrain: JSON.parse(s.stats.terrain) });
            if (next % 2 === 0) {
              const map = document.querySelector('#minimap'),
                r = map.getBoundingClientRect(),
                p = positions[(next / 2) % positions.length];
              map.dispatchEvent(
                new PointerEvent('pointerdown', {
                  clientX: r.left + r.width * p[0],
                  clientY: r.top + r.height * p[1],
                  bubbles: true,
                  cancelable: true,
                }),
              );
            }
          }
          if (elapsed < 60000) requestAnimationFrame(frame);
          else resolve({ elapsedMs: elapsed, intervals, samples });
        }
        requestAnimationFrame(frame);
      }),
  );
  await page.locator('#focus').click();
  await expect
    .poll(async () => JSON.parse((await read()).stats.terrain).missing)
    .toBe(0);
  await page.locator('#pause').click();
  const saveBytes = await page.evaluate(
    () =>
      new TextEncoder().encode(
        localStorage.getItem('pixelforge:client:v2:gas-station'),
      ).byteLength,
  );
  const afterHeap = await cdp.send('Runtime.getHeapUsage');
  await cdp.send('HeapProfiler.collectGarbage');
  const retainedHeap = await cdp.send('Runtime.getHeapUsage');
  const frames = measured.intervals.slice().sort((a, b) => a - b);
  const max = (k) => Math.max(...measured.samples.map((s) => s[k]));
  const maxTerrain = (k) =>
    Math.max(...measured.samples.map((s) => s.terrain[k]));
  const result = {
    measuredAt: new Date().toISOString(),
    base,
    chromium: browser.version(),
    cpu: cpus()[0].model,
    logicalCpus: cpus().length,
    memoryBytes: totalmem(),
    viewport: page.viewportSize(),
    durationMs: measured.elapsedMs,
    frames: frames.length,
    fps: (frames.length * 1000) / measured.intervals.reduce((a, b) => a + b, 0),
    medianFrameMs: frames[Math.floor(frames.length * 0.5)],
    p95FrameMs: frames[Math.floor(frames.length * 0.95)],
    framesOver50ms: frames.filter((v) => v > 50).length,
    maxUnits: max('units'),
    maxAdvanceMs: max('maxAdvanceMs'),
    maxLocalExpanded: max('navLocal'),
    maxAudioVoices: max('audioVoices'),
    maxResidentSectors: maxTerrain('resident'),
    maxPendingSectors: maxTerrain('pending'),
    maxTextureBytes: maxTerrain('textureBytes'),
    saveBytes,
    beforeHeap,
    afterHeap,
    retainedHeap,
    final: (await read()).stats,
    errors,
    notes:
      'Headless Chromium with software rendering, no CPU/network throttling. 60 seconds at speed x4 and zoom 0.5 with camera moves; ordinary S2 population, not a synthetic 32-unit stress test. Heap excludes GPU; textureBytes estimates sector RGBA surfaces.',
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  await page.screenshot({
    path: output.replace(/\.json$/, '.png'),
    style: '#diagnostics{visibility:hidden}',
  });
  console.log(JSON.stringify(result, null, 2));
  expect(errors).toEqual([]);
  expect(result.maxUnits).toBeLessThanOrEqual(32);
  expect(result.maxResidentSectors).toBeLessThanOrEqual(48);
  expect(result.maxAudioVoices).toBeLessThanOrEqual(12);
} finally {
  await browser.close();
}
