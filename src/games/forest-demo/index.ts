import type { GameDefinition } from '../../engine/api/types';
export const forestDemo = {
  schemaVersion: 1,
  id: 'forest-demo',
  title: 'Leśny sygnał',
  description:
    'Mały wędrowiec. Uśpiony las. Jedno światło, które wskaże drogę.',
  viewport: { width: 320, height: 180 },
  levelUrl: 'assets/games/forest-demo/level.json',
  assets: {
    player: 'assets/games/forest-demo/player.png',
    background: 'assets/games/forest-demo/background.png',
    terrain: 'assets/games/forest-demo/terrain.png',
    beacon: 'assets/games/forest-demo/beacon.png',
    portal: 'assets/games/forest-demo/portal.png',
  },
  movement: { speed: 88, jump: 235, gravity: 650 },
} satisfies GameDefinition;
