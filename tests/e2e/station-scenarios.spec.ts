import { test, expect } from '@playwright/test';
import { weekend } from '../fixtures/station-campaign';
import type { Snapshot } from '../../src/engine/api';
import type { StationUI } from '../../src/games/gas-station/controls';

test('S4: wybór nocy, światła, audio i wznowienie tego samego wariantu', async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const press = async (q: string) =>
    isMobile ? page.locator(q).tap() : page.locator(q).click();
  const state = (): Promise<Snapshot> =>
    page
      .locator('#diagnostics')
      .evaluate((e) => JSON.parse((e as HTMLElement).dataset.state!));
  const ui = async () => (await state()).client as unknown as StationUI;
  await page.goto('/?diagnostics=1');
  await press('[data-game="gas-station"]');
  await press('[data-scenario="night"]');
  await page.locator('[data-st-seed]').fill('731');
  await page.screenshot({
    path: `test-results/station-scenarios-menu-${isMobile ? 'mobile' : 'desktop'}.png`,
  });
  await press('#start');
  await expect.poll(async () => (await state()).stats?.ready).toBe(true);
  expect((await ui()).campaign!.variant).toBe('Nocna zmiana');
  expect((await ui()).goal).toBe(50);
  await press('.station-tabs [data-st-tab="weekend"]');
  await press('[data-lights]');
  await expect.poll(async () => (await ui()).campaign!.lights).toBe(false);
  await press('[data-lights]');
  await press('[data-st-close]');
  await press('#zoom-out');
  await expect
    .poll(async () => Number((await state()).stats?.audioBytes))
    .toBeGreaterThan(0);
  await page.screenshot({
    path: `test-results/station-night-${isMobile ? 'mobile' : 'desktop'}.png`,
    style: '#diagnostics{visibility:hidden}',
  });
  await press('#mute');
  await page.waitForTimeout(2100);
  await expect.poll(async () => (await state()).stats?.audioVoices).toBe(0);
  await press('#pause');
  const before = await ui();
  await page.reload();
  await press('[data-game="gas-station"]');
  await press('[data-scenario="highway"]');
  await press('#resume');
  await expect.poll(async () => (await state()).stats?.ready).toBe(true);
  expect((await ui()).campaign!.variant).toBe('Nocna zmiana');
  expect((await ui()).campaign!.seed).toBe(731);
  expect((await ui()).seconds).toBeGreaterThanOrEqual(before.seconds);
  expect((await ui()).campaign!.lights).toBe(true);
  expect(errors).toEqual([]);
});

test('S4: migracja v3 do v4 zachowuje stary weekend i oryginalny klucz', async ({
  page,
}) => {
  const m = weekend(731);
  for (let i = 0; i < 800; i++) m.tick();
  const value = JSON.stringify({
    gameId: 'gas-station',
    schemaVersion: 3,
    state: m.snapshot(),
  });
  await page.goto('/');
  await page.evaluate(
    (value) => localStorage.setItem('pixelforge:client:v3:gas-station', value),
    value,
  );
  await page.goto('/?diagnostics=1');
  await page.locator('[data-game="gas-station"]').click();
  await page.locator('#resume').click();
  const state = () =>
    page
      .locator('#diagnostics')
      .evaluate((e) => JSON.parse((e as HTMLElement).dataset.state!));
  await expect.poll(async () => (await state()).stats?.ready).toBe(true);
  await page.locator('#pause').click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem('pixelforge:client:v3:gas-station'),
    ),
  ).toBe(value);
  const current = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('pixelforge:client:v4:gas-station')!),
  );
  expect(current.schemaVersion).toBe(4);
  expect(current.state.gameVersion).toBe('0.3.0');
  expect(current.state.campaign.scenario).toBeUndefined();
  expect(current.state.tick).toBeGreaterThanOrEqual(800);
});
