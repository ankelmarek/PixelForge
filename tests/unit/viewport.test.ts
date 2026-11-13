import { expect, it } from 'vitest';
import { expandedViewport, fillViewport } from '../../src/engine/core/viewport';
import { validateSimulationLevel } from '../../src/engine/simulation/validation';
import world from '../../public/assets/demos/large-world/world-4096.json';

it('pełny viewport zachowuje całkowitą skalę i budżet także na skrajnych ekranach', () => {
  for (const [width, height] of [
    [320, 568],
    [412, 839],
    [844, 390],
    [1440, 1000],
    [7680, 2160],
    [200, 5000],
  ]) {
    const view = fillViewport(width, height);
    expect(Number.isInteger(view.scale)).toBe(true);
    expect(view.width).toBeLessThanOrEqual(expandedViewport.width);
    expect(view.height).toBeLessThanOrEqual(expandedViewport.height);
    expect(view.width * view.scale).toBeGreaterThanOrEqual(width);
    expect(view.height * view.scale).toBeGreaterThanOrEqual(height);
  }
});
it('pełny widok wymaga cache i świata mieszczących maksymalny viewport', () => {
  expect(() =>
    validateSimulationLevel(world, undefined, expandedViewport),
  ).not.toThrow();
  const smallCache = structuredClone(world);
  smallCache.terrain.cacheSectors = 24;
  expect(() =>
    validateSimulationLevel(smallCache, undefined, expandedViewport),
  ).toThrow(/cache/);
});
