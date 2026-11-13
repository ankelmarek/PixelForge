import { describe, expect, it } from 'vitest';
import { RuleSystem } from '../../src/engine/systems/rules';
import {
  ProgressService,
  SaveService,
} from '../../src/engine/systems/progress';
import { validateLevel } from '../../src/engine/api/validation';
import { forestDemo } from '../../src/games/forest-demo';
import raw from '../../public/assets/games/forest-demo/level.json';
const first = validateLevel({
  ...raw,
  entities: [
    { id: 'gem', type: 'collectible', x: 60, y: 150 },
    { id: 'cp', type: 'checkpoint', x: 110, y: 150 },
  ],
});
const second = { ...first, id: 'second' };
function storage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
describe('runtime M1', () => {
  it('zbiera raz, odblokowuje warunek i zapisuje kolejne poziomy', () => {
    const disk = storage();
    const levels = [first, second];
    const progress = new ProgressService(
      new SaveService(forestDemo, levels, disk),
      levels,
    );
    const rules = new RuleSystem();
    forestDemo.registerRules(rules);
    expect(
      rules.allows({ condition: 'allCollected' }, progress.context()),
    ).toBe(false);
    expect(progress.collect('gem')).toBe(true);
    expect(progress.collect('gem')).toBe(false);
    expect(
      rules.allows({ condition: 'allCollected' }, progress.context()),
    ).toBe(true);
    rules.run(
      [{ action: 'toggleFlag', flag: 'activated' }],
      progress.context(),
      {
        setFlag: (name, value) => progress.setFlag(name, value),
        complete: () => progress.completeLevel(),
      },
    );
    expect(rules.allows({ allFlags: ['activated'] }, progress.context())).toBe(
      true,
    );
    progress.checkpoint('cp');
    progress.completeLevel();
    expect(progress.state.levelIndex).toBe(1);
    expect(progress.state.checkpointId).toBeNull();
    expect(progress.flag('activated')).toBe(false);
    expect(new SaveService(forestDemo, levels, disk).read().levelId).toBe(
      'second',
    );
    progress.completeLevel();
    expect(new SaveService(forestDemo, levels, disk).read().completed).toBe(
      true,
    );
    progress.reset();
    expect(progress.state.collectibles).toEqual([]);
    expect(progress.state.completed).toBe(false);
  });
  it('odrzuca nieznane akcje, warunki, encje, duplikaty i błędne patrole', () => {
    for (const entity of [
      { type: 'script' },
      { type: 'switch', onInteract: [{ action: 'eval' }] },
      { type: 'door', requires: { condition: 'missing' } },
      { type: 'enemy', patrol: { min: 80, max: 10, speed: 20 } },
    ])
      expect(() =>
        validateLevel({
          ...raw,
          entities: [{ id: 'a', x: 50, y: 140, ...entity }],
        }),
      ).toThrow();
    expect(() =>
      validateLevel({
        ...first,
        entities: [first.entities![0], first.entities![0]],
      }),
    ).toThrow('Powtórzone ID');
    const rules = new RuleSystem();
    expect(() => rules.registerAction('setFlag', () => {})).toThrow();
  });
  it('izoluje gry i odrzuca uszkodzone, niezgodne i niespójne zapisy', () => {
    const disk = storage(),
      save = new SaveService(forestDemo, [first], disk);
    const state = save.fresh();
    state.lives = 2;
    state.checkpointId = 'cp';
    state.collectibles = ['clearing:gem'];
    save.write(state);
    expect(save.read()).toMatchObject({ lives: 2, checkpointId: 'cp' });
    expect(
      new SaveService({ ...forestDemo, id: 'other' }, [first], disk).read()
        .lives,
    ).toBe(3);
    for (const corrupt of [
      '{',
      JSON.stringify({ ...state, schemaVersion: 99 }),
      JSON.stringify({ ...state, lives: -1 }),
      JSON.stringify({ ...state, checkpointId: 'missing' }),
      JSON.stringify({ ...state, collectibles: ['missing:gem'] }),
      JSON.stringify({ ...state, gameVersion: 'incompatible' }),
    ]) {
      disk.data.set('pixelforge:v2:forest-demo', corrupt);
      expect(save.read()).toEqual({
        ...save.fresh(),
        updatedAt: expect.any(String),
      });
    }
  });
  it('obsługuje brak localStorage i migruje wersję M0', () => {
    const disk = storage();
    disk.setItem(
      'pixelforge:v1:forest-demo',
      '{"schemaVersion":1,"activated":true,"completed":false}',
    );
    expect(
      new SaveService(forestDemo, [first], disk).read().flags[
        'clearing:activated'
      ],
    ).toBe(true);
    const denied = new SaveService(forestDemo, [first], {
      getItem: () => {
        throw new Error();
      },
      setItem: () => {
        throw new Error();
      },
    });
    expect(denied.read()).toEqual({
      ...denied.fresh(),
      updatedAt: expect.any(String),
    });
    expect(denied.write(denied.fresh())).toBe(false);
  });
});
