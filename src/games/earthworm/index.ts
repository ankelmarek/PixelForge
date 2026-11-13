import type { ClientDefinition } from '../../engine/api/client';
export const earthworm: ClientDefinition = {
  kind: 'client',
  schemaVersion: 1,
  id: 'earthworm',
  version: '1.0.0',
  title: 'Życie Dżdżownicy',
  description: 'Małe życie. Wielki ogród.',
  viewport: { width: 320, height: 180 },
  levelUrl: 'assets/games/earthworm/world.json',
  assets: {
    background: 'assets/games/earthworm/cover.png',
    cover: 'assets/games/earthworm/cover.png',
    creatures: 'assets/games/earthworm/creatures.png',
    plants: 'assets/games/earthworm/plants.png',
    pool: 'assets/games/earthworm/pool.png',
    soil: 'assets/games/earthworm/soil.png',
  },
  spriteSheets: {
    creatures: { frameWidth: 32, frameHeight: 32 },
    plants: { frameWidth: 64, frameHeight: 64 },
  },
  music: {
    notes: [48, 0, 55, 60, 0, 64, 62, 0, 55, 0, 60, 67, 64, 0, 60, 55],
    beatSeconds: 0.65,
    volume: 0.012,
  },
  presentation: {
    completionTitle: 'Ogród znów żyje',
    failureTitle: 'Koniec wyprawy',
    objectiveLabel: 'Ożywione korzenie',
    actionLabel: 'Zwiń lub rozwiń ciało',
  },
  catalog: {
    cover: 'assets/games/earthworm/cover.png',
    launchLabel: 'Zagraj',
    badge: 'PIERWSZY OGRÓD / P3',
    detail: 'Życie Dżdżownicy',
  },
  async createRuntime(context, data) {
    const { createEarthwormRuntime } = await import('./runtime');
    return createEarthwormRuntime(earthworm, context, data);
  },
};
