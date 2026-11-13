import { chromium, devices, expect } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import process from 'node:process';

const root = resolve(import.meta.dirname, '../..');
const server = spawn(
  'python3',
  ['-u', 'tests/updater/panel_browser_fixture.py'],
  {
    cwd: root,
    stdio: ['pipe', 'pipe', 'inherit'],
  },
);
const lines = createInterface({ input: server.stdout });
const configuration = await Promise.race([
  once(lines, 'line').then(([line]) => JSON.parse(line)),
  once(server, 'exit').then(() => {
    throw new Error('Panel fixture did not start');
  }),
]);
const certificateName = 'PixelForge-test-' + randomUUID();
const stores = [];
let browser;
const results = [];
try {
  // Trust only this ephemeral test CA. TLS validation stays enabled.
  for (const directory of [
    homedir() + '/.pki/nssdb',
    homedir() + '/.local/share/pki/nssdb',
  ]) {
    await mkdir(directory, { recursive: true });
    try {
      await access(directory + '/cert9.db');
    } catch {
      execFileSync('certutil', [
        '-N',
        '-d',
        'sql:' + directory,
        '--empty-password',
      ]);
    }
    execFileSync('certutil', [
      '-A',
      '-d',
      'sql:' + directory,
      '-n',
      certificateName,
      '-t',
      'C,,',
      '-i',
      configuration.ca,
    ]);
    stores.push(directory);
  }
  browser = await chromium.launch({ headless: true });
  await mkdir('test-results', { recursive: true });
  for (const device of ['desktop', 'mobile']) {
    const context = await browser.newContext(
      device === 'mobile'
        ? devices['Pixel 7']
        : { viewport: { width: 1366, height: 900 } },
    );
    const panel = await context.newPage();
    const errors = [];
    panel.on('pageerror', (error) => errors.push(error.message));
    panel.on('response', (response) => {
      if (response.status() >= 400 && !response.url().includes('favicon.ico')) {
        errors.push(response.status() + ' ' + response.url());
      }
    });
    await panel.goto(configuration.url);
    await panel.getByLabel('Login administratora').fill(configuration.username);
    await panel
      .getByLabel('Hasło', { exact: true })
      .fill(configuration.password);
    await panel
      .getByRole('button', { name: 'Zaloguj się', exact: true })
      .click();
    await expect(panel.locator('[data-active]')).toHaveText('0.6.1');

    const game = await context.newPage();
    game.on('pageerror', (error) => errors.push(error.message));
    const state = () =>
      game
        .locator('#diagnostics')
        .evaluate((element) => JSON.parse(element.dataset.state));
    const open = async (resume) => {
      await game.goto(
        configuration.origin + '/PixelForge/index.html?diagnostics=1',
      );
      await game.locator('[data-world="4096"]').click();
      await game.locator(resume ? '#resume' : '#start').click();
      await expect.poll(async () => (await state()).world?.missing).toBe(0);
      await expect(game.locator('#error')).toBeEmpty();
    };
    await open(false);
    await game.locator('[data-focus="remote-source"]').click();
    await game.locator('#pause').click();
    const saved = await state();
    const keys = await game.evaluate(() =>
      Object.keys(globalThis.localStorage).sort(),
    );

    await panel.locator('#package').setInputFiles(configuration.package);
    if (device === 'desktop') {
      const transfer = await panel.locator('#package').evaluateHandle((element) => {
        const data = new globalThis.DataTransfer();
        data.items.add(element.files[0]);
        element.value = '';
        return data;
      });
      await panel.locator('[data-drop]').dispatchEvent('drop', {
        dataTransfer: transfer,
      });
      expect(
        await panel.locator('#package').evaluate((element) => element.files.length),
      ).toBe(1);
      await transfer.dispose();
    }
    await panel
      .getByRole('button', { name: 'Sprawdź pakiet', exact: true })
      .click();
    await expect(
      panel.getByRole('heading', { name: '0.6.1 → 0.6.2', exact: true }),
    ).toBeVisible();
    await expect(panel.locator('[data-active]')).toHaveText('0.6.1');
    const viewport = panel.viewportSize();
    expect(
      await panel.evaluate(
        () => globalThis.document.documentElement.scrollWidth,
      ),
    ).toBeLessThanOrEqual(viewport.width);
    await panel.screenshot({
      path: 'test-results/u2-' + device + '.png',
      fullPage: true,
    });
    await panel
      .getByRole('button', { name: 'Zainstaluj wydanie 0.6.2', exact: true })
      .click();
    await expect(panel.locator('[data-active]')).toHaveText('0.6.2');
    await expect(panel.locator('.notice[role="status"]')).toContainText(
      'Wydanie zostało zainstalowane',
    );
    await open(true);
    expect((await state()).camera.scrollX).toBeCloseTo(saved.camera.scrollX, 0);
    expect((await state()).camera.scrollY).toBeCloseTo(saved.camera.scrollY, 0);
    expect(
      await game.evaluate(() => Object.keys(globalThis.localStorage).sort()),
    ).toEqual(keys);
    await game.locator('#pause').click();

    await panel
      .getByRole('link', { name: 'Przywróć poprzednią wersję', exact: true })
      .click();
    await expect(panel.locator('[data-active]')).toHaveText('0.6.2');
    await panel
      .getByRole('button', { name: 'Potwierdź przywrócenie', exact: true })
      .click();
    await expect(panel.locator('[data-active]')).toHaveText('0.6.1');
    await open(true);
    expect((await state()).camera.scrollX).toBeCloseTo(saved.camera.scrollX, 0);
    expect(
      await game.evaluate(() => Object.keys(globalThis.localStorage).sort()),
    ).toEqual(keys);
    await panel.getByRole('button', { name: 'Wyloguj', exact: true }).click();
    await expect(panel.getByLabel('Hasło', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    const result = {
      device,
      httpsVerified: true,
      uploadOnlyPrepares: true,
      install: '0.6.1 -> 0.6.2',
      rollback: '0.6.2 -> 0.6.1',
      savedCameraRestored: true,
      savesPreserved: true,
      errors,
    };
    results.push(result);
    process.stdout.write(JSON.stringify(result) + '\n');
    await context.close();
  }
  // Progressive enhancement: authentication and forms also work with JS disabled.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(configuration.url);
  await page.getByLabel('Login administratora').fill(configuration.username);
  await page.getByLabel('Hasło', { exact: true }).fill(configuration.password);
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await page.locator('#package').setInputFiles(configuration.package);
  await page
    .getByRole('button', { name: 'Sprawdź pakiet', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Zainstaluj wydanie 0.6.2' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Usuń plan', exact: true }).click();
  await expect(page.locator('.notice[role="status"]')).toContainText(
    'Plan został usunięty',
  );
  await context.close();
  await writeFile(
    'test-results/U2-BROWSER-RESULTS.json',
    JSON.stringify(
      {
        chromium: browser.version(),
        fixtureRelease: '0.6.2 is a temporary fixture, not a published game',
        javascriptDisabledUploadAndDiscard: true,
        results,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  if (browser) await browser.close();
  for (const directory of stores) {
    execFileSync('certutil', [
      '-D',
      '-d',
      'sql:' + directory,
      '-n',
      certificateName,
    ]);
  }
  if (server.exitCode === null) {
    server.stdin.end('quit\n');
    await once(server, 'exit');
  }
  lines.close();
}
