import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const legacy = JSON.parse(
  readFileSync('public/assets/games/forest-demo/level.json', 'utf8'),
);
async function launch(page: Page) {
  await page.route('**/levels/clearing.json', (route) =>
    route.fulfill({ json: legacy }),
  );
  for (const name of ['marsh', 'sanctuary'])
    await page.route(`**/levels/${name}.json`, (route) =>
      route.fulfill({
        json: { ...legacy, id: name, spawn: legacy.exit, exitRequires: {} },
      }),
    );
  await page.goto('/');
  await page.getByRole('button', { name: 'Odkryj las' }).click();
  await expect(
    page.getByRole('button', { name: 'Nowa wyprawa' }),
  ).toBeVisible();
}
async function x(page: Page) {
  return Number(await page.locator('#stage').getAttribute('data-x'));
}
async function moveTo(page: Page, target: number) {
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(
    (target) =>
      Number(document.querySelector('#stage')?.getAttribute('data-x')) >=
      target,
    target,
    { polling: 'raf', timeout: 4000 },
  );
  await page.keyboard.up('ArrowRight');
}
async function jumpTo(page: Page, target: number) {
  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('Space');
  await page.waitForFunction(
    (target) =>
      Number(document.querySelector('#stage')?.getAttribute('data-x')) >=
      target,
    target,
    { polling: 'raf', timeout: 3000 },
  );
  await page.keyboard.up('ArrowRight');
  await expect(page.locator('#stage')).toHaveAttribute('data-grounded', 'true');
}
test('pełna pętla: fizyka, latarnia, pauza, zapis, brama, restart i powrót', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await launch(page);
  await page.getByRole('button', { name: 'Nowa wyprawa' }).click();
  const stage = page.locator('#stage');
  await expect(stage).toHaveAttribute('data-grounded', 'true');
  await moveTo(page, 90);
  await jumpTo(page, 141);
  expect(Number(await stage.getAttribute('data-y'))).toBeLessThan(120);
  await moveTo(page, 172);
  await jumpTo(page, 223);
  expect(Number(await stage.getAttribute('data-y'))).toBeLessThan(100);
  await moveTo(page, 239);
  await expect(page.locator('#play')).not.toContainText(
    /Spacja|Naciśnij|Zapal latarnię|Dotrzyj|Obudź/,
  );
  await page.keyboard.down('ShiftLeft');
  await expect(stage).toHaveAttribute('data-activated', 'true');
  await page.waitForTimeout(120);
  await expect(stage).toHaveAttribute('data-activated', 'true');
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.press('ShiftLeft');
  await expect(stage).toHaveAttribute('data-activated', 'false');
  await page.keyboard.press('ShiftLeft');
  await expect(stage).toHaveAttribute('data-activated', 'true');
  await page.keyboard.press('Escape');
  await expect(stage).toHaveAttribute('data-paused', 'true');
  const frozenX = await x(page);
  await page.waitForTimeout(250);
  expect(await x(page)).toBe(frozenX);
  await page.keyboard.press('Escape');
  await expect(stage).toHaveAttribute('data-paused', 'false');
  await page.reload();
  await page.getByRole('button', { name: 'Odkryj las' }).click();
  await page.getByRole('button', { name: 'Wznów wyprawę' }).click();
  await expect(stage).toHaveAttribute('data-activated', 'true');
  // Każdy skok wykonuje prawdziwą fizykę i kolizje, bez modyfikowania runtime.
  await page.keyboard.down('ArrowRight');
  for (let i = 0; i < 24; i++) {
    await expect
      .poll(
        async () =>
          (await stage.getAttribute('data-grounded')) === 'true' ||
          (await stage.getAttribute('data-completed')) === 'true',
      )
      .toBe(true);
    if ((await stage.getAttribute('data-completed')) === 'true') break;
    await page.keyboard.press('Space');
    await page.waitForTimeout(550);
  }
  await page.keyboard.up('ArrowRight');
  await expect(stage).toHaveAttribute('data-completed', 'true');
  await expect(page.getByText('Ukończono')).toBeVisible();
  await page.getByRole('button', { name: 'Zagraj ponownie' }).click();
  await expect(stage).toHaveAttribute('data-activated', 'false');
  const documentStart = await page.evaluate(() => performance.timeOrigin);
  await page.getByRole('button', { name: 'Katalog', exact: false }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart);
  await page.getByRole('button', { name: 'Odkryj las' }).click();
  await page.getByRole('button', { name: 'Nowa wyprawa' }).click();
  await expect(stage).toHaveAttribute('data-grounded', 'true');
  await expect(stage).toHaveAttribute('data-activated', 'false');
  expect(await x(page)).toBeLessThan(40);
  expect(errors).toEqual([]);
});
test('dotyk, wyciszenie, obrót i ostry obraz', async ({ page }) => {
  await launch(page);
  await page.getByRole('button', { name: 'Nowa wyprawa' }).click();
  await expect(page.locator('#stage')).toHaveAttribute('data-grounded', 'true');
  const right = page.getByRole('button', { name: 'Idź w prawo' });
  await right.scrollIntoViewIfNeeded();
  const bounds = (await right.boundingBox())!;
  await page.mouse.move(bounds.x + 20, bounds.y + 20);
  await page.mouse.down();
  await expect.poll(() => x(page)).toBeGreaterThan(45);
  await page.mouse.up();
  const jump = page.getByRole('button', { name: 'Skok', exact: true });
  await jump.click();
  await expect(page.locator('#stage')).toHaveAttribute(
    'data-grounded',
    'false',
  );
  await page.getByRole('button', { name: 'Dźwięk: wł.' }).click();
  await expect(
    page.getByRole('button', { name: 'Dźwięk: wył.' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect
    .poll(async () => {
      const b = await page.locator('canvas').boundingBox();
      return b ? Math.abs(b.width / b.height - 320 / 180) : 1;
    })
    .toBeLessThan(0.01);
  expect(
    await page
      .locator('canvas')
      .evaluate((el) => getComputedStyle(el).imageRendering),
  ).toMatch(/pixelated|crisp-edges/);
});
test('błędny poziom i brak assetu mają czytelne komunikaty', async ({
  page,
}) => {
  await page.route('**/levels/clearing.json', (route) =>
    route.fulfill({ json: { schemaVersion: 50 } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Odkryj las' }).click();
  await expect(page.getByText('Poziom: nieobsługiwana wersja')).toBeVisible();
  await page.unroute('**/levels/clearing.json');
  await page.route('**/player.png', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.getByRole('button', { name: 'Katalog', exact: false }).click();
  await page.getByRole('button', { name: 'Odkryj las' }).click();
  await expect(page.getByText(/Brak zasobu: player/)).toBeVisible();
});
test('uszkodzony zapis i odświeżenie nie blokują nowej sesji', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem('pixelforge:v1:forest-demo', '{bad'),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Odkryj las' }).click();
  await page.getByRole('button', { name: 'Wznów wyprawę' }).click();
  await expect(page.locator('#stage')).toHaveAttribute(
    'data-activated',
    'false',
  );
  await expect(page.locator('#stage')).toHaveAttribute('data-grounded', 'true');
});

test('wielodotyk łączy ruch i skok, anulowanie zwalnia wejście', async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(
    !isMobile,
    'Rzeczywiste zdarzenia touch w emulacji urządzenia mobilnego',
  );
  await launch(page);
  await page.getByRole('button', { name: 'Nowa wyprawa' }).click();
  const stage = page.locator('#stage');
  await expect(stage).toHaveAttribute('data-grounded', 'true');
  const right = (await page
    .getByRole('button', { name: 'Idź w prawo' })
    .boundingBox())!;
  const jump = (await page
    .getByRole('button', { name: 'Skok', exact: true })
    .boundingBox())!;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: right.x + right.width / 2, y: right.y + right.height / 2, id: 1 },
      { x: jump.x + jump.width / 2, y: jump.y + jump.height / 2, id: 2 },
    ],
  });
  await expect(stage).toHaveAttribute('data-grounded', 'false');
  await expect.poll(() => x(page)).toBeGreaterThan(40);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  });
  await expect(stage).toHaveAttribute('data-grounded', 'true');
  const stopped = await x(page);
  await page.waitForTimeout(150);
  expect(await x(page)).toBe(stopped);
});
