import type { ClientDefinition } from '../../engine/api/client';
import { createControls } from './controls';
import './style.css';
export const station: ClientDefinition = {
  kind: 'client',
  schemaVersion: 1,
  id: 'gas-station',
  version: '0.2.0',
  title: 'Stacja na Trasie',
  description:
    'ORLAR i Skoczka. Własne drogi, nowe stanowiska i wybór gospodarza sklepu.',
  viewport: { width: 320, height: 180 },
  preferredViewport: { width: 640, height: 360 },
  levelUrl: 'assets/games/gas-station/world.json',
  assets: Object.fromEntries(
    [
      'cover',
      'tiles',
      'cars',
      'van',
      'freight',
      'truck',
      'people',
      'shop',
      'skoczka',
      'pump',
      'tree',
    ].map((name) => [
      name === 'tiles'
        ? 'station-tiles'
        : name === 'cover'
          ? 'background'
          : name,
      `assets/games/gas-station/${name}.png`,
    ]),
  ),
  spriteSheets: {
    'station-tiles': { frameWidth: 16, frameHeight: 16 },
    cars: { frameWidth: 64, frameHeight: 64 },
    van: { frameWidth: 64, frameHeight: 64 },
    freight: { frameWidth: 128, frameHeight: 128 },
    truck: { frameWidth: 128, frameHeight: 128 },
    people: { frameWidth: 32, frameHeight: 32 },
    pump: { frameWidth: 64, frameHeight: 64 },
  },
  music: {
    notes: [48, 55, 60, 0, 64, 60, 57, 0, 53, 60, 65, 64, 62, 0, 55, 0],
    beatSeconds: 0.48,
    volume: 0.008,
  },
  catalog: {
    cover: 'assets/games/gas-station/cover.png',
    launchLabel: 'Otwórz stację',
    badge: 'ROZBUDOWA I SKOCZKA · S2',
    detail: 'Stacja na Trasie',
  },
  presentation: {
    completionTitle: 'Dobry początek!',
    failureTitle: 'Koniec zmiany',
    objectiveLabel: 'Obsłużeni klienci',
    actionLabel: 'Stacja',
  },
  createControls,
  async createRuntime(context, data) {
    const { createStationRuntime } = await import('./runtime');
    return createStationRuntime(station, context, data);
  },
};
