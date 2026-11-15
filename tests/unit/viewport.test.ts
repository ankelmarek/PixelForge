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

it('kamera zachowuje fazę pikseli i granice przy zoomie 0.5, także dla nieparzystego viewportu', async () => {
  const { pixelAlignedScroll } =
    await import('../../src/engine/simulation/camera');
  for (const viewport of [180, 250, 319, 412, 839]) {
    for (const scroll of [-100, 0, 127.25, 2001.75, 4096, 5000]) {
      const result = pixelAlignedScroll(scroll, viewport, 4096, 0.5);
      const left = result + viewport / 2 - viewport;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + viewport * 2).toBeLessThanOrEqual(4096);
      expect(Number.isInteger(left * 0.5)).toBe(true);
      expect(pixelAlignedScroll(result, viewport, 4096, 0.5)).toBe(result);
    }
    for (const zoom of [0.5, 1 / 1.2, 1 / 1.2 ** 2]) {
      const maximum = 4096 - viewport / (2 * zoom) - viewport / 2;
      expect(pixelAlignedScroll(maximum, viewport, 4096, zoom)).toBeCloseTo(
        maximum,
        8,
      );
    }
  }
});

it('gęstszy widok klienta pozostaje w istniejącym budżecie sektorów', () => {
  for (const [width, height] of [
    [1440, 900],
    [7680, 4320],
    [412, 915],
    [200, 5000],
  ]) {
    const view = fillViewport(width, height, { width: 640, height: 360 });
    expect(view.width).toBeLessThanOrEqual(640);
    expect(view.height).toBeLessThanOrEqual(960);
    expect(view.width * view.scale).toBeGreaterThanOrEqual(width);
    expect(view.height * view.scale).toBeGreaterThanOrEqual(height);
  }
});
