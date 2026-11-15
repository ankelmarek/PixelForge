/* global process, console, document, performance, requestAnimationFrame */
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    (process.env.PIXELFORGE_STRESS_URL ?? 'http://127.0.0.1:4277') +
      '/tests/fixtures/station-stress.html',
  );
  await page.locator('#start').click();
  const state = () =>
    page.locator('#telemetry').evaluate((e) => JSON.parse(e.textContent));
  await expect.poll(async () => (await state()).ready).toBe(true);
  await expect(page.locator('#error')).toBeEmpty();
  const measurement = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const frames = [],
          samples = [],
          start = performance.now();
        let previous,
          lastSecond = -1;
        function frame(now) {
          if (previous !== undefined) frames.push(now - previous);
          previous = now;
          const second = Math.floor((now - start) / 1000);
          if (second !== lastSecond) {
            lastSecond = second;
            samples.push(
              JSON.parse(document.querySelector('#telemetry').textContent),
            );
            if (second % 2 === 0) document.querySelector('#jump').click();
          }
          if (now - start < 60000) requestAnimationFrame(frame);
          else resolve({ frames, samples, durationMs: now - start });
        }
        requestAnimationFrame(frame);
      }),
  );
  const sorted = measurement.frames.toSorted((a, b) => a - b);
  const report = {
    measuredAt: new Date().toISOString(),
    cpu: cpus()[0].model,
    cpus: cpus().length,
    chromium: browser.version(),
    viewport: page.viewportSize(),
    durationMs: measurement.durationMs,
    fps:
      (measurement.frames.length * 1000) /
      measurement.frames.reduce((n, a) => n + a, 0),
    p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
    medianFrameMs: sorted[Math.floor(sorted.length * 0.5)],
    minUnits: Math.min(...measurement.samples.map((s) => s.units)),
    maxUnits: Math.max(...measurement.samples.map((s) => s.units)),
    maxMoving: Math.max(...measurement.samples.map((s) => s.moving)),
    maxStepMs: Math.max(...measurement.samples.map((s) => s.maxStepMs)),
    maxResident: Math.max(
      ...measurement.samples.map((s) => s.terrain.resident),
    ),
    maxTextureBytes: Math.max(
      ...measurement.samples.map((s) => s.terrain.textureBytes),
    ),
    maxLocal: Math.max(...measurement.samples.map((s) => s.navLocal)),
    errors,
    cameraPositions: new Set(measurement.samples.map((s) => s.camera)).size,
    notes:
      'Synthetic 32-unit workload at ×4, zoom 0.5, compiled Vite build, real station motion/navigation/renderer/assets and camera jumps. 14 vehicles, 10 drivers, 6 staff, 2 deliveries. Synthetic state is never written to production localStorage. This measures component capacity; full game economy and traffic are tested separately. Headless Chromium software rendering; no physical-phone claim.',
  };
  await mkdir('work/s2', { recursive: true });
  await writeFile(
    'work/s2/stress-performance.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
  expect(errors).toEqual([]);
  expect(report.cameraPositions).toBeGreaterThanOrEqual(5);
  expect(report.minUnits).toBe(32);
  expect(report.maxUnits).toBe(32);
  expect(report.maxResident).toBeLessThanOrEqual(48);
  expect(report.p95FrameMs).toBeLessThanOrEqual(33);
} finally {
  await browser.close();
}
