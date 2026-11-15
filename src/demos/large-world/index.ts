import type { SimulationDefinition } from '../../engine/api';
const base = 'assets/demos/large-world/';
export function worldDemo(size: 4096 | 8192): SimulationDefinition {
  return {
    schemaVersion: 1,
    kind: 'simulation',
    id: `world-lab-${size}`,
    version: '1.0.0',
    title: `Atlas ${size}`,
    description: 'Laboratorium dużego świata',
    viewport: { width: 320, height: 180 },
    levelUrl: `${base}world-${size}.json`,
    assets: {
      background: `${base}cover.png`,
      ...Object.fromEntries(
        [
          'cover',
          'tiles',
          'worker',
          'vehicle',
          'source',
          'depot',
          'processor',
          'storage',
          'cargo',
        ].map((name) => [name, `${base}${name}.png`]),
      ),
    },
    spriteSheets: {
      tiles: { frameWidth: 16, frameHeight: 16 },
      worker: { frameWidth: 16, frameHeight: 24 },
      vehicle: { frameWidth: 48, frameHeight: 32 },
      processor: { frameWidth: 64, frameHeight: 48 },
    },
    catalog: {
      cover: `${base}cover.png`,
      launchLabel: 'Otwórz',
      badge: 'P1',
      detail: 'Demonstracja techniczna',
    },
  };
}
