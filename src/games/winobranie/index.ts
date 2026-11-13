import type { SimulationDefinition } from '../../engine/api';
const base = 'assets/games/winobranie/';
export const winobranie = {
  schemaVersion: 1,
  kind: 'simulation',
  id: 'winobranie',
  title: 'Winobranie',
  description:
    'Słoneczne zbocza, pełne skrzynki i pierwsza partia soku. Mała winnica w twoich rękach.',
  version: '0.3.0',
  viewport: { width: 320, height: 180 },
  levelUrl: `${base}world.json`,
  assets: Object.fromEntries(
    [
      'background',
      'cover',
      'worker',
      'vehicle',
      'vine',
      'fruit',
      'depot',
      'cargo',
      'press',
      'tank',
      'juice',
    ].map((key) => [key, `${base}${key}.png`]),
  ),
  spriteSheets: {
    worker: { frameWidth: 16, frameHeight: 24 },
    vehicle: { frameWidth: 48, frameHeight: 32 },
    press: { frameWidth: 112, frameHeight: 96 },
  },
  music: {
    notes: [60, 64, 67, 0, 69, 67, 64, 0, 62, 65, 69, 0, 67, 64, 60, 0],
    beatSeconds: 0.75,
    volume: 0.009,
  },
  catalog: {
    emblem: `${base}fruit.png`,
    cover: `${base}cover.png`,
    launchLabel: 'Otwórz winnicę',
    badge: 'SYMULATOR',
    detail: 'Mysz · 12 rzędów',
  },
} satisfies SimulationDefinition;
