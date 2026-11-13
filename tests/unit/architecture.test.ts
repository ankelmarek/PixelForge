import { expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import { games } from '../../src/games/registry';
import { platformDefinition } from '../fixtures/content';
import { validateGame } from '../../src/engine/api/validation';
it('aktywny katalog jest pusty i testy nie importują porzuconych gier', () => {
  expect(games).toEqual([]);
  for (const file of globSync('tests/**/*.{ts,html}'))
    expect(readFileSync(file, 'utf8')).not.toMatch(
      /(?:from|import\s*\()\s*['"][^'"]*games\/(?:forest-demo|winobranie)/,
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
