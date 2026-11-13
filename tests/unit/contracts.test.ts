import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateGame, validateLevel } from '../../src/engine/api/validation';
import { platformDefinition, platformLevel } from '../fixtures/content';
import {
  freshProgress,
  readProgress,
  writeProgress,
} from '../../src/engine/systems/save';
import { Input } from '../../src/engine/systems/input';
const level: unknown = platformLevel;
describe('kontrakty rdzenia', () => {
  it('akceptuje definicję gry i mapę', () => {
    expect(validateGame(platformDefinition).id).toBe('contract-fixture');
    expect(validateLevel(level).platforms.length).toBeGreaterThan(1);
  });
  it.each([
    null,
    {},
    { ...platformDefinition, schemaVersion: 2 },
    { ...platformDefinition, levelUrl: '../secret' },
    { ...platformDefinition, movement: { speed: -1 } },
  ])('odrzuca błędny manifest %j', (value) => {
    expect(() => validateGame(value)).toThrow();
  });
  it('odrzuca nieznaną akcję i geometrię poza poziomem', () => {
    const valid = validateLevel(level);
    expect(() =>
      validateLevel({
        ...valid,
        interaction: { ...valid.interaction, action: 'eval' },
      }),
    ).toThrow('nieznana akcja');
    expect(() =>
      validateLevel({
        ...valid,
        platforms: [{ x: 790, y: 10, width: 20, height: 10 }],
      }),
    ).toThrow('poza poziomem');
    expect(() =>
      validateLevel({ ...valid, spawn: { x: NaN, y: 20 } }),
    ).toThrow();
  });
  it('izoluje zapisy, rozpoznaje wersję, uszkodzony JSON i brak dostępu', () => {
    const records = new Map<string, string>();
    const storage = {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => {
        records.set(key, value);
      },
    };
    expect(
      writeProgress(
        'a',
        { schemaVersion: 1, activated: true, completed: false },
        storage,
      ),
    ).toBe(true);
    expect(readProgress('a', storage).activated).toBe(true);
    expect(readProgress('b', storage)).toEqual(freshProgress());
    for (const value of [
      '{broken',
      '{"schemaVersion":2}',
      '{"schemaVersion":1,"activated":false,"completed":true}',
    ]) {
      records.set('pixelforge:v1:a', value);
      expect(readProgress('a', storage)).toEqual(freshProgress());
    }
    expect(
      readProgress('a', {
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toEqual(freshProgress());
    expect(
      writeProgress('a', freshProgress(), {
        setItem: () => {
          throw new Error('quota');
        },
      }),
    ).toBe(false);
  });
  it('obsługuje zablokowany getter localStorage', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'localStorage',
    );
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(readProgress('blocked')).toEqual(freshProgress());
      expect(writeProgress('blocked', freshProgress())).toBe(false);
    } finally {
      if (descriptor)
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
  it('łączy źródła wejścia i konsumuje pojedynczą krawędź skoku', () => {
    const input = new Input();
    input.set('jump', true, 'Space');
    expect(input.consume('jump')).toBe(true);
    expect(input.consume('jump')).toBe(false);
    input.set('right', true, 'KeyD');
    input.set('right', true, 'pointer:1');
    input.set('right', false, 'KeyD');
    expect(input.down('right')).toBe(true);
    input.clear();
    expect(input.down('right')).toBe(false);
  });
  it('rdzeń nie zna katalogu gier', async () => {
    const { globSync } = await import('node:fs');
    for (const path of globSync('src/engine/**/*.ts'))
      expect(readFileSync(path, 'utf8')).not.toMatch(
        /(?:from|import\s*\()\s*['"][^'"]*(?:games|app)\//,
      );
  });
});
