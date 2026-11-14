import { expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import { games } from '../../src/games/registry';
import { platformDefinition } from '../fixtures/content';
import { validateGame } from '../../src/engine/api/validation';
it('aktywny katalog zawiera wybrany tytuł P3, bez porzuconych gier', () => {
  expect(games.map((game) => game.id)).toEqual(['earthworm', 'winobranie-rts']);
  for (const file of globSync('tests/**/*.{ts,html}'))
    expect(readFileSync(file, 'utf8')).not.toMatch(
      /(?:from|import\s*\()\s*['"][^'"]*games\/(?:forest-demo|winobranie)(?:\/|['"])/,
    );
});
it('gry korzystają wyłącznie z publicznego API, rdzeń nie importuje produktów', () => {
  for (const file of globSync('src/games/**/*.ts'))
    expect(readFileSync(file, 'utf8')).not.toMatch(
      /from\s*['"][^'"]*engine\/(?!api(?:\/|['"]))/,
    );
  for (const file of globSync('src/engine/**/*.ts'))
    expect(readFileSync(file, 'utf8')).not.toMatch(
      /(?:from|import\s*\()\s*['"][^'"]*(?:games|demos|app)\//,
    );
});
it('muzyka ma walidowaną głośność i skończony katalog nut', () => {
  expect(() =>
    validateGame({
      ...platformDefinition,
      music: { notes: [60], beatSeconds: 0.5, volume: 10 },
    }),
  ).toThrow();
  expect(() =>
    validateGame({
      ...platformDefinition,
      music: { notes: ['script'], beatSeconds: 0.5, volume: 0.01 },
    }),
  ).toThrow();
});
