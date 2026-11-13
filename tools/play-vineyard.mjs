/* global process, console, document */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const level = JSON.parse(
  readFileSync('public/assets/games/winobranie/world.json', 'utf8'),
);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(process.env.PLAY_URL ?? 'http://localhost:5173');
await page.locator('#launch-1').click();
await page.locator('#start').click();
await page.waitForFunction(
  () =>
    Number(document.querySelector('#stage')?.getAttribute('data-elapsed')) >= 1,
);
const state = () =>
  page.locator('#stage').evaluate((e) => ({
    elapsed: Number(e.dataset.elapsed),
    collected: Number(e.dataset.collected),
    produced: Number(e.dataset.produced),
    completed: e.dataset.completed === 'true',
    actors: JSON.parse(e.dataset.actors),
    nodes: JSON.parse(e.dataset.nodes),
    camera: JSON.parse(e.dataset.camera),
  }));
async function clickNode(id) {
  await page.locator('canvas').scrollIntoViewIfNeeded();
  const n = level.nodes.find((n) => n.id === id),
    s = await state(),
    b = await page.locator('canvas').boundingBox(),
    c = s.camera;
  await page.mouse.click(
    b.x +
      ((((n.x + n.width / 2) * 16 - c.scrollX - 160) * c.zoom + 160) *
        b.width) /
        320,
    b.y +
      ((((n.y + n.height / 2) * 16 - c.scrollY - 90) * c.zoom + 90) *
        b.height) /
        180,
  );
  await page.waitForTimeout(130);
}
for (const n of level.nodes.filter((n) => n.kind === 'source')) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const s = await state();
    if (
      s.actors.some(
        (a) =>
          a.current?.target === n.id || a.queue.some((j) => j.target === n.id),
      )
    )
      break;
    await clickNode(n.id);
  }
}
await clickNode('mill');
const history = [];
let last = -1,
  captured = false;
for (let i = 0; i < 660; i++) {
  const s = await state();
  if (s.elapsed - last >= 20) {
    history.push({
      elapsed: s.elapsed,
      collected: s.collected,
      produced: s.produced,
    });
    last = s.elapsed;
    console.log(JSON.stringify(history.at(-1)));
  }
  if (s.completed) break;
  const a = s.actors.find((a) => a.id === 'carrier');
  if (!a.current && !a.queue.length) {
    if (Object.values(a.cargo).some(Boolean)) {
      await page.locator('[data-actor-id="carrier"]').click();
      await clickNode('mill');
    } else {
      await clickNode('yard');
      await clickNode('mill');
    }
  }
  if (s.elapsed > 120 && s.produced > 0 && !captured) {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.screenshot({ path: 'docs/screenshots/m3-production.png' });
    captured = true;
  }
  await page.waitForTimeout(1000);
}
const result = { ...(await state()), errors, history };
writeFileSync('work/m3-playtest.json', JSON.stringify(result, null, 2));
await page.screenshot({ path: 'work/m3-finish.png' });
console.log(
  JSON.stringify({
    completed: result.completed,
    elapsed: result.elapsed,
    produced: result.produced,
    errors,
  }),
);
await browser.close();
if (!result.completed || errors.length) process.exitCode = 1;
