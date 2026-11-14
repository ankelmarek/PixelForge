import { chromium, devices, expect } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import process from 'node:process';

// Production ZIP -> PHP install -> browser resume -> PHP rollback -> resume.
const root = resolve(import.meta.dirname, '../..');
const php = process.env.PIXELFORGE_PHP ?? 'php';
const temporary = await realpath(
  await mkdtemp(tmpdir() + '/pixelforge-u1-browser-'),
);
const cli = resolve(root, 'admin-updater/cli.php');
const fixture = resolve(root, 'tests/updater/browser-fixture.py');
const configPath = temporary + '/config.json';
execFileSync('python3', [fixture, 'prepare', temporary], { stdio: 'pipe' });
const command = (name, ...args) =>
  JSON.parse(
    execFileSync(php, [cli, name, configPath, ...args], {
      cwd: root,
      encoding: 'utf8',
    }),
  );
command('doctor');
command('init');
const server = spawn('python3', ['-u', fixture, 'serve', temporary], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
const lines = createInterface({ input: server.stdout });
const [port] = await once(lines, 'line');
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const device of ['desktop', 'mobile'])
    for (const path of ['/', '/PixelForge/'])
      for (const size of [4096, 8192]) {
        const context = await browser.newContext(
          device === 'mobile'
            ? devices['Pixel 7']
            : { viewport: { width: 1280, height: 720 } },
        );
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('response', (response) => {
          if (
            response.status() >= 400 &&
            !response.url().includes('favicon.ico')
          )
            errors.push(response.status() + ' ' + response.url());
        });
        const base = 'http://127.0.0.1:' + port + path;
        const state = () =>
          page
            .locator('#diagnostics')
            .evaluate((element) => JSON.parse(element.dataset.state));
        const open = async (resume) => {
          await page.goto(base + '?diagnostics=1');
          await page.locator('[data-world="' + size + '"]').click();
          await page.locator(resume ? '#resume' : '#start').click();
          await expect.poll(async () => (await state()).world?.missing).toBe(0);
          await expect(page.locator('#error')).toBeEmpty();
        };
        await open(false);
        await page.locator('[data-focus="remote-source"]').click();
        for (let index = 0; index < 4; index++)
          await page.locator('#zoom-out').click();
        await expect.poll(async () => (await state()).world.missing).toBe(0);
        await page.locator('#pause').click();
        const saved = await state();
        const keys = await page.evaluate(() =>
          Object.keys(globalThis.localStorage).sort(),
        );
        expect(keys.length).toBeGreaterThan(0);
        const plan = command(
          'prepare',
          temporary + '/packages/pixelforge-0.6.2-full.zip',
        );
        const installed = command('apply', plan.id, plan.packageHash).state;
        expect(installed.active.version).toBe('0.6.2');
        await open(true);
        const resumed = await state();
        expect(resumed.camera.scrollX).toBeCloseTo(saved.camera.scrollX, 0);
        expect(resumed.camera.scrollY).toBeCloseTo(saved.camera.scrollY, 0);
        expect(resumed.camera.zoom).toBe(saved.camera.zoom);
        expect(resumed.elapsed).toBeGreaterThanOrEqual(saved.elapsed);
        expect(
          await page.evaluate(() =>
            Object.keys(globalThis.localStorage).sort(),
          ),
        ).toEqual(keys);
        const response = await page.request.get(base + 'manifest.json');
        expect((await response.json()).releaseVersion).toBe('0.6.2');
        await page.locator('#pause').click();
        command('rollback', installed.active.id, installed.previous.id);
        await open(true);
        expect((await state()).camera.scrollX).toBeCloseTo(
          saved.camera.scrollX,
          0,
        );
        const reverted = await page.request.get(base + 'manifest.json');
        expect((await reverted.json()).releaseVersion).toBe('0.6.1');
        expect(errors).toEqual([]);
        const result = {
          device,
          path,
          size,
          install: '0.6.1 -> 0.6.2',
          rollback: '0.6.2 -> 0.6.1',
          savedCameraRestored: true,
          errors,
        };
        results.push(result);
        process.stdout.write(JSON.stringify(result) + '\n');
        await context.close();
      }
  expect(results).toHaveLength(8);
} finally {
  await browser.close();
  server.kill('SIGTERM');
  await once(server, 'exit');
  lines.close();
  if (process.env.PIXELFORGE_UPDATER_REPORT)
    await writeFile(
      process.env.PIXELFORGE_UPDATER_REPORT,
      JSON.stringify(
        {
          chromium: browser.version(),
          php: execFileSync(php, ['-r', 'echo PHP_VERSION;'], {
            encoding: 'utf8',
          }),
          fixtureRelease: '0.6.2 is a local test fixture, not a published game',
          results,
        },
        null,
        2,
      ) + '\n',
    );
  await rm(temporary, { recursive: true, force: true });
}
