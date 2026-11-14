import type { ClientDefinition } from '../../engine/api/client';
import { createControls } from './controls';
export const winery: ClientDefinition = {
  kind: 'client',
  schemaVersion: 1,
  id: 'winobranie-rts',
  version: '0.1.0',
  title: 'Winobranie RTS',
  description: 'Twoja ziemia. Pierwszy zbiór. Początek winnicy.',
  viewport: { width: 320, height: 180 },
  preferredViewport: { width: 640, height: 360 },
  levelUrl: 'assets/games/winobranie-rts/world.json',
  assets: {
    background: 'assets/games/winobranie-rts/cover-v1.png',
    objects: 'assets/games/winobranie-rts/objects.png',
  },
  music: {
    notes: [48, 55, 60, 64, 0, 62, 59, 55, 48, 0, 55, 60, 67, 64, 60, 0],
    beatSeconds: 0.6,
    volume: 0.009,
  },
  catalog: {
    cover: 'assets/games/winobranie-rts/cover-v1.png',
    launchLabel: 'Rozpocznij sezon',
    badge: 'WINNICA · W1',
    detail: 'Winobranie RTS',
  },
  presentation: {
    completionTitle: 'Pierwsze udane winobranie',
    failureTitle: 'Sezon zamknięty',
    objectiveLabel: 'Sprzedany moszcz',
    actionLabel: 'Gospodarstwo',
  },
  createControls,
  async createRuntime(context, data) {
    const { createVineyardRuntime } = await import('./runtime');
    return createVineyardRuntime(winery, context, data);
  },
};
