import { test, expect, type Page } from '@playwright/test';
const fixture = {
  schemaVersion: 1,
  id: 'clearing',
  width: 800,
  height: 180,
  spawn: { x: 28, y: 139 },
  platforms: [{ x: 0, y: 156, width: 800, height: 24 }],
  interaction: { x: 160, y: 156, action: 'activate' },
  exit: { x: 748, y: 156 },
  entities: [
    { id: 'gem', type: 'collectible', x: 70, y: 150 },
    { id: 'cp', type: 'checkpoint', x: 110, y: 156 },
    {
      id: 'switch',
      type: 'switch',
      x: 160,
      y: 156,
      requires: { condition: 'allCollected' },
    },
    { id: 'trigger', type: 'trigger', x: 210, y: 156, flag: 'crossed' },
    {
      id: 'enemy',
      type: 'enemy',
      x: 290,
      y: 156,
      patrol: { min: 270, max: 310, speed: 20 },
    },
  ],
};
async function move(page: Page, target: number) {
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(
    (x) =>
      Number(document.querySelector('#stage')?.getAttribute('data-x')) >= x,
    target,
  );
  await page.keyboard.up('ArrowRight');
}
test('M1: encje, checkpoint, obrażenia, nietykalność, porażka i trwały zapis', async ({
  page,
}) => {
  await page.route('**/level.json', (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Odkryj las' }).click();
  await page.getByRole('button', { name: 'Nowa wyprawa' }).click();
  const stage = page.locator('#stage');
  await expect(stage).toHaveAttribute('data-lives', '3');
  await move(page, 160);
  await expect(stage).toHaveAttribute('data-collected', '1');
  await expect(stage).toHaveAttribute('data-checkpoint', 'cp');
  await page.keyboard.press('ShiftLeft');
  await expect(stage).toHaveAttribute('data-activated', 'true');
  await page.keyboard.down('ArrowRight');
  await expect(stage).toHaveAttribute('data-lives', '2');
  await page.keyboard.up('ArrowRight');
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('pixelforge:v2:forest-demo')!).flags[
          'clearing:crossed'
        ],
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(stage).toHaveAttribute('data-paused', 'true');
  await page.reload();
  await page.getByRole('button', { name: 'Odkryj las' }).click();
  await page.getByRole('button', { name: 'Wznów wyprawę' }).click();
  await expect(stage).toHaveAttribute('data-lives', '2');
  await expect(stage).toHaveAttribute('data-checkpoint', 'cp');
  await expect(stage).toHaveAttribute('data-collected', '1');
  expect(Number(await stage.getAttribute('data-x'))).toBeLessThan(140);
  await page.keyboard.down('ArrowRight');
  await expect(stage).toHaveAttribute('data-failed', 'true', {
    timeout: 12000,
  });
  await page.keyboard.up('ArrowRight');
  await expect(page.getByText('Koniec wyprawy')).toBeVisible();
  await page.getByRole('button', { name: 'Zagraj ponownie' }).click();
  await expect(stage).toHaveAttribute('data-lives', '3');
  await expect(stage).toHaveAttribute('data-collected', '0');
});
