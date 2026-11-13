import { test, expect, type Page } from '@playwright/test';
async function walk(page: Page, x: number) {
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(
    (x) =>
      Number(document.querySelector('#stage')?.getAttribute('data-x')) >= x,
    x,
  );
  await page.keyboard.up('ArrowRight');
}
test('M2: trzy poziomy, warunek kolekcji, zapis między mapami i zakończenie', async ({
  page,
}) => {
  for (const [index, id] of ['clearing', 'marsh', 'sanctuary'].entries())
    await page.route(`**/levels/${id}.json`, (route) =>
      route.fulfill({
        json: {
          schemaVersion: 1,
          id,
          title: id,
          width: 320,
          height: 180,
          spawn: { x: 28, y: 139 },
          platforms: [{ x: 0, y: 156, width: 320, height: 24 }],
          interaction: { x: 160, y: 156, action: 'activate' },
          exit: { x: 280, y: 156 },
          exitRequires: { allFlags: ['activated'], condition: 'allCollected' },
          entities: [
            { id: 'gem', type: 'collectible', x: 80, y: 150, texture: 'gem' },
            {
              id: 'cp',
              type: 'checkpoint',
              x: 120,
              y: 156,
              texture: 'checkpoint',
            },
            {
              id: 'switch',
              type: 'switch',
              x: 160,
              y: 156,
              requires: { condition: 'allCollected' },
            },
          ],
          theme: {
            tint: 0xffffff,
            background: ['background', 'dawn', 'ruins'][index],
          },
        },
      }),
    );
  await page.goto('/');
  await page.getByRole('button', { name: 'Odkryj las' }).click();
  await page.getByRole('button', { name: 'Nowa wyprawa' }).click();
  const stage = page.locator('#stage');
  for (let index = 0; index < 3; index++) {
    await expect(stage).toHaveAttribute('data-level-index', String(index));
    await expect(stage).toHaveAttribute('data-activated', 'false');
    await walk(page, 160);
    await expect(stage).toHaveAttribute('data-collected', '1');
    await page.keyboard.press('ShiftLeft');
    await expect(stage).toHaveAttribute('data-activated', 'true');
    if (index === 1) {
      await page.keyboard.down('Escape');
      await expect(stage).toHaveAttribute('data-paused', 'true');
      await page.keyboard.down('Escape');
      await expect(stage).toHaveAttribute('data-paused', 'true');
      await page.keyboard.up('Escape');
      await page.reload();
      await page.getByRole('button', { name: 'Odkryj las' }).click();
      await page.getByRole('button', { name: 'Wznów wyprawę' }).click();
      await expect(stage).toHaveAttribute('data-level-index', '1');
      await expect(stage).toHaveAttribute('data-collected', '1');
      await expect(stage).toHaveAttribute('data-checkpoint', 'cp');
    }
    await walk(page, 245);
    await page.keyboard.down('ArrowRight');
    if (index < 2)
      await expect(stage).toHaveAttribute(
        'data-level-index',
        String(index + 1),
      );
  }
  await expect(stage).toHaveAttribute('data-completed', 'true');
  await expect(page.getByText('Ukończono')).toBeVisible();
  await expect(page.locator('#play')).not.toContainText(
    /Naciśnij|Spacja|Zapal|Dotrzyj/,
  );
});
