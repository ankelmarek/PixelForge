import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { forestDemo } from '../../src/games/forest-demo';
import { validateGame, validateLevel } from '../../src/engine/api/validation';
import { RuleSystem } from '../../src/engine/systems/rules';
import {
  SaveService,
  ProgressService,
} from '../../src/engine/systems/progress';
it('wszystkie mapy kampanii mają prawidłowe encje, osiągalne podparcia i pełny przepływ flag', () => {
  const rules = new RuleSystem();
  forestDemo.registerRules(rules);
  const levels = forestDemo.levels.map((path) =>
    validateLevel(JSON.parse(readFileSync(`public/${path}`, 'utf8')), rules),
  );
  expect(new Set(levels.map((level) => level.id)).size).toBe(3);
  const records = new Map<string, string>();
  const storage = {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => {
      records.set(key, value);
    },
  };
  const progress = new ProgressService(
    new SaveService(forestDemo, levels, storage),
    levels,
  );
  for (const level of levels) {
    expect(rules.allows(level.exitRequires, progress.context())).toBe(false);
    const gems = level.entities!.filter(
      (entity) => entity.type === 'collectible',
    );
    expect(gems.length).toBeGreaterThanOrEqual(5);
    for (const gem of gems) {
      expect(
        level.platforms.some(
          (platform) =>
            gem.x >= platform.x &&
            gem.x < platform.x + platform.width &&
            platform.y >= gem.y &&
            platform.y - gem.y < 24,
        ),
      ).toBe(true);
      progress.collect(gem.id);
    }
    expect(
      rules.allows({ condition: 'allCollected' }, progress.context()),
    ).toBe(true);
    progress.setFlag('activated', true);
    expect(rules.allows(level.exitRequires, progress.context())).toBe(true);
    progress.completeLevel();
  }
  expect(progress.state.completed).toBe(true);
  expect(progress.state.collectibles).toHaveLength(22);
  expect(progress.save.read().completed).toBe(true);
});

it('waliduje parametry muzyki i tła zamiast dopuszczać błędną konfigurację', () => {
  expect(() =>
    validateGame({
      ...forestDemo,
      music: { notes: [69], beatSeconds: 0.5, volume: 10 },
    }),
  ).toThrow();
  expect(() =>
    validateGame({
      ...forestDemo,
      music: { notes: ['script'], beatSeconds: 0.5, volume: 0.01 },
    }),
  ).toThrow();
});
