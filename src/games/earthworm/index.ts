import type { ClientDefinition } from '../../engine/api/client';
export const earthworm: ClientDefinition = {
  kind: 'client',
  schemaVersion: 1,
  id: 'earthworm',
  version: '2.0.0',
  title: 'Życie Dżdżownicy',
  description: 'Mała dżdżownica. Wielki świat pod ziemią.',
  viewport: { width: 320, height: 180 },
  levelUrl: 'assets/games/earthworm/soil-world.json',
  assets: {
    background: 'assets/games/earthworm/soil-cover.png',
    garden: 'assets/games/earthworm/garden-atlas.png',
    worm: 'assets/games/earthworm/worm-atlas.png',
    underground: 'assets/games/earthworm/soil-atlas.png',
  },
  music: {
    notes: [48, 0, 55, 60, 0, 64, 62, 0, 55, 0, 60, 67, 64, 0, 60, 55],
    beatSeconds: 0.65,
    volume: 0.012,
  },
  presentation: {
    completionTitle: 'Dorosła dżdżownica',
    failureTitle: 'Koniec wyprawy',
    objectiveLabel: 'Punkty dojrzałości',
    actionLabel: 'Interakcja lub zwinięcie ciała',
  },
  catalog: {
    cover: 'assets/games/earthworm/soil-cover.png',
    launchLabel: 'Zagraj',
    badge: 'POD POWIERZCHNIĄ',
    detail: 'Życie Dżdżownicy',
  },
  async createRuntime(context, data) {
    const { createEarthwormRuntime } = await import('./runtime');
    return createEarthwormRuntime(earthworm, context, data);
  },
};
