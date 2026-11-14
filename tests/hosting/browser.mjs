import { chromium, devices, expect } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import process from 'node:process';

const server = spawn('python3', ['-u', 'tests/hosting/browser_fixture.py'], {
  stdio: ['pipe', 'pipe', 'inherit'],
});
const lines = createInterface({ input: server.stdout });
const config = await Promise.race([
  once(lines, 'line').then(([line]) => JSON.parse(line)),
  once(server, 'exit').then(() => {
    throw Error('Apache hosting fixture failed');
  }),
]);
const nickname = 'PixelForge-hosting-test-' + randomUUID();
const stores = [];
let browser;
const results = [];
try {
  for (const directory of [
    homedir() + '/.pki/nssdb',
    homedir() + '/.local/share/pki/nssdb',
  ]) {
    await mkdir(directory, { recursive: true });
    try {
      await readFile(directory + '/cert9.db');
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
      nickname,
      '-t',
      'C,,',
      '-i',
      config.ca,
    ]);
    stores.push(directory);
  }
  browser = await chromium.launch();
  await mkdir('test-results', { recursive: true });
  for (const site of config.servers) {
    const context = await browser.newContext(
      site.device === 'mobile'
        ? devices['Pixel 7']
        : {
            viewport: { width: 1366, height: 900 },
            javaScriptEnabled: site.device !== 'no-js',
          },
    );
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        !/^Failed to load resource:/.test(message.text())
      )
        errors.push(message.text());
    });
    await page.goto(site.origin + '/setup.php');
    let key = site.key;
    if (site.device !== 'no-js') {
      expect(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollWidth,
        ),
      ).toBeLessThanOrEqual(page.viewportSize().width);
      await page.screenshot({
        path: `test-results/hosting-setup-${site.device}.png`,
        fullPage: true,
      });
      const downloadPromise = page.waitForEvent('download');
      await page
        .getByRole('button', { name: 'Pobierz konfigurację', exact: true })
        .click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('install-settings.php');
      const file = await download.path();
      const contents = await readFile(file, 'utf8');
      key = contents.match(/'setupKey' => '([0-9a-f]{64})'/)[1];
      expect(contents).toContain(`'origin' => '${site.origin}'`);
      // Models the explicit owner's file-manager upload; HTTP cannot do this.
      await copyFile(file, site.settingsPath);
      await page
        .getByRole('link', { name: 'Konfiguracja wgrana — dalej' })
        .click();
    }
    await page.getByLabel('Klucz instalacji z pliku konfiguracji').fill(key);
    await page.getByLabel('Login administratora').fill(site.username);
    await page
      .getByLabel('Hasło (16–72 bajty)', { exact: true })
      .fill(site.password);
    await page.getByLabel('Powtórz hasło', { exact: true }).fill(site.password);
    await page
      .getByRole('button', { name: 'Sprawdź i zainstaluj', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Instalacja zakończona' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Otwórz panel', exact: true }).click();
    await page.getByLabel('Login administratora').fill(site.username);
    await page.getByLabel('Hasło', { exact: true }).fill(site.password);
    await page
      .getByRole('button', { name: 'Zaloguj się', exact: true })
      .click();
    await expect(page.locator('[data-active]')).toHaveText('0.8.0');
    let game, save;
    if (site.device !== 'no-js') {
      game = await context.newPage();
      game.on('pageerror', (error) => errors.push(error.message));
      await game.goto(site.origin + '/pixelforge.php');
      expect(game.url()).toBe(site.origin + '/PixelForge/index.html');
      await game.goto(game.url() + '?diagnostics=1');
      await game.locator('[data-game="earthworm"]').click();
      await game.locator('#start').click();
      const state = () =>
        game
          .locator('#diagnostics')
          .evaluate((element) => JSON.parse(element.dataset.state));
      for (const [x, y] of [
        [680, 456],
        [720, 488],
        [800, 496],
        [768, 528],
      ]) {
        const c = (await state()).camera,
          r = await game.locator('#stage canvas').boundingBox();
        const px =
          r.x +
          (((x - c.scrollX - c.width / 2) * c.zoom + c.width / 2) / c.width) *
            r.width;
        const py =
          r.y +
          (((y - c.scrollY - c.height / 2) * c.zoom + c.height / 2) /
            c.height) *
            r.height;
        if (site.device === 'mobile') await game.touchscreen.tap(px, py);
        else await game.mouse.click(px, py);
        await expect
          .poll(async () => {
            const s = await state();
            return Math.hypot(s.x - x, s.y - y);
          })
          .toBeLessThan(4);
      }
      await expect.poll(async () => (await state()).stats.blooms).toBe(1);
      await game.locator('#pause').click();
      save = await game.evaluate(() =>
        globalThis.localStorage.getItem('pixelforge:client:v3:earthworm'),
      );
      expect(save).toBeTruthy();
    }
    await page.locator('#package').setInputFiles(config.package);
    await page
      .getByRole('button', { name: 'Sprawdź pakiet', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: '0.8.0 → 0.8.1', exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-active]')).toHaveText('0.8.0');
    await page
      .getByRole('button', { name: 'Zainstaluj wydanie 0.8.1', exact: true })
      .click();
    await expect(page.locator('[data-active]')).toHaveText('0.8.1');
    await page
      .getByRole('link', { name: 'Przywróć poprzednią wersję', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Potwierdź przywrócenie', exact: true })
      .click();
    await expect(page.locator('[data-active]')).toHaveText('0.8.0');
    if (game) {
      expect(
        await game.evaluate(() =>
          globalThis.localStorage.getItem('pixelforge:client:v3:earthworm'),
        ),
      ).toBe(save);
      await game.reload();
      await game.locator('[data-game="earthworm"]').click();
      await game.locator('#resume').click();
      await expect
        .poll(async () =>
          game
            .locator('#diagnostics')
            .evaluate((e) => JSON.parse(e.dataset.state).stats.blooms),
        )
        .toBe(1);
      await game.locator('#pause').click();
      expect(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollWidth,
        ),
      ).toBeLessThanOrEqual(page.viewportSize().width);
      await page.screenshot({
        path: `test-results/hosting-panel-${site.device}.png`,
        fullPage: true,
      });
    }
    const check = await context.newPage();
    const denied = await check.goto(
      site.origin + '/_pixelforge/data/panel/config.json',
    );
    expect(denied.status()).toBe(403);
    expect((await check.goto(site.origin + '/setup.php')).status()).toBe(410);
    await check.close();
    await page.getByRole('button', { name: 'Wyloguj', exact: true }).click();
    await expect(page.getByLabel('Hasło', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    results.push({
      device: site.device,
      tlsVerified: true,
      setup: true,
      installAndRollback: true,
      privateHttp403: true,
      wormSaveResumed: site.device !== 'no-js',
      errors,
    });
    process.stdout.write(JSON.stringify(results.at(-1)) + '\n');
    await context.close();
  }
  await writeFile(
    'test-results/HOSTING-BROWSER-RESULTS.json',
    JSON.stringify(
      {
        chromium: browser.version(),
        release:
          '0.8.1 is a temporary fixture with unchanged 0.8.0 payload, not a game release',
        results,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  if (browser) await browser.close();
  for (const directory of stores)
    execFileSync('certutil', ['-D', '-d', 'sql:' + directory, '-n', nickname]);
  if (server.exitCode === null) {
    server.stdin.end('quit\n');
    await once(server, 'exit');
  }
  lines.close();
}
