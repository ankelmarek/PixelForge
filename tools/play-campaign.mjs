import { chromium, expect } from '@playwright/test';
/* global console, window, requestAnimationFrame, performance */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('work', { recursive: true });
const maps = ['clearing', 'marsh', 'sanctuary'].map((id) =>
  JSON.parse(
    readFileSync(`public/assets/games/forest-demo/levels/${id}.json`, 'utf8'),
  ),
);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const startTime = Date.now();
const samples = [];
let direction = 0;
const state = () =>
  page.locator('#stage').evaluate((el) => ({ ...el.dataset }));
async function steer(next) {
  if (next === direction) return;
  if (direction)
    await page.keyboard.up(direction > 0 ? 'ArrowRight' : 'ArrowLeft');
  direction = next;
  if (direction)
    await page.keyboard.down(direction > 0 ? 'ArrowRight' : 'ArrowLeft');
}
async function travel(target, index) {
  const level = maps[index],
    deadline = Date.now() + 95000;
  let prior = NaN,
    stuck = 0;
  while (Date.now() < deadline) {
    const s = await state();
    if (s.failed === 'true')
      throw Error('Lives exhausted: ' + JSON.stringify(s));
    if (Number(s.levelIndex) !== index || s.completed === 'true') {
      await steer(0);
      return;
    }
    const x = Number(s.x),
      feet = Number(s.y) + 12;
    if (Math.abs(x - target) <= 3) {
      await steer(0);
      return;
    }
    const sign = target > x ? 1 : -1;
    await steer(sign);
    if (s.grounded === 'true') {
      const step = level.platforms.some(
        (p) =>
          p.y < feet - 4 &&
          p.y >= feet - 44 &&
          (sign > 0
            ? p.x - x >= 0 && p.x - x < 29
            : x - (p.x + p.width) >= 0 && x - (p.x + p.width) < 29),
      );
      const danger =
        feet > 145 &&
        level.entities.some(
          (e) => ['enemy', 'hazard'].includes(e.type) && Math.abs(e.x - x) < 32,
        );
      stuck = Math.abs(prior - x) < 1 ? stuck + 1 : 0;
      if (step || danger || stuck > 3) {
        await page.keyboard.press('Space');
        stuck = 0;
      }
    }
    prior = x;
    await page.waitForTimeout(45);
  }
  throw Error(
    'Travel deadline: ' + target + ' ' + JSON.stringify(await state()),
  );
}
try {
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Odkryj las' }).click();
  await page.getByRole('button', { name: 'Nowa wyprawa' }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-grounded', 'true');
  await page.evaluate(() => {
    window.frameProbe = [];
    let previous = performance.now();
    const frame = (now) => {
      if (window.frameProbe.length < 180) {
        window.frameProbe.push(now - previous);
        previous = now;
        requestAnimationFrame(frame);
      }
    };
    requestAnimationFrame(frame);
  });
  await page.screenshot({ path: 'work/m2-start.png', fullPage: true });
  for (let index = 0; index < maps.length; index++) {
    for (const gem of maps[index].entities.filter(
      (e) => e.type === 'collectible',
    )) {
      await travel(gem.x, index);
      await expect
        .poll(async () => Number((await state()).collected), { timeout: 3000 })
        .toBeGreaterThanOrEqual(
          maps[index].entities
            .filter((e) => e.type === 'collectible')
            .indexOf(gem) + 1,
        );
      console.log('GEM', index, gem.id, await state());
    }
    await page.screenshot({ path: `work/m2-map-${index}.png`, fullPage: true });
    await travel(160, index);
    await expect(page.locator('#stage')).toHaveAttribute(
      'data-grounded',
      'true',
    );
    await page.keyboard.press('ShiftLeft');
    await expect(page.locator('#stage')).toHaveAttribute(
      'data-activated',
      'true',
    );
    await travel(3152, index);
    if (index < 2)
      await expect(page.locator('#stage')).toHaveAttribute(
        'data-level-index',
        String(index + 1),
      );
    else
      await expect(page.locator('#stage')).toHaveAttribute(
        'data-completed',
        'true',
      );
    const s = await state();
    samples.push(s);
    console.log('MAP DONE', index, s);
  }
  const frames = await page.evaluate(() => window.frameProbe);
  const sorted = [...frames].sort((a, b) => a - b);
  const result = {
    wallSeconds: (Date.now() - startTime) / 1000,
    simulationSeconds: Number((await state()).elapsed),
    final: await state(),
    samples,
    errors,
    frameMeanMs: frames.reduce((a, b) => a + b, 0) / frames.length,
    frameP95Ms: sorted[Math.floor(sorted.length * 0.95)],
  };
  writeFileSync('work/m2-playtest.json', JSON.stringify(result, null, 2));
  await page.screenshot({ path: 'work/m2-finish.png', fullPage: true });
  console.log('COMPLETE', JSON.stringify(result));
  expect(errors).toEqual([]);
} catch (error) {
  console.log('FAILED', String(error), await state().catch(() => null));
  await page.screenshot({ path: 'work/m2-failed.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
}
