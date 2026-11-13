import { registerForestRules } from './rules';
import type { GameDefinition } from '../../engine/api/types';
export const forestDemo = {
  registerRules: registerForestRules,
  schemaVersion: 1,
  id: 'forest-demo',
  title: 'Leśny sygnał',
  description:
    'Trzy krainy, zagubione odłamki i światło ukryte w sercu starego lasu.',
  viewport: { width: 320, height: 180 },
  version: '0.2.0',
  startingLives: 7,
  levelUrl: 'assets/games/forest-demo/levels/clearing.json',
  levels: [
    'assets/games/forest-demo/levels/clearing.json',
    'assets/games/forest-demo/levels/marsh.json',
    'assets/games/forest-demo/levels/sanctuary.json',
  ],
  spriteSheets: { enemy: { frameWidth: 16, frameHeight: 16 } },
  assets: {
    player: 'assets/games/forest-demo/player.png',
    background: 'assets/games/forest-demo/background.png',
    terrain: 'assets/games/forest-demo/terrain.png',
    beacon: 'assets/games/forest-demo/beacon.png',
    portal: 'assets/games/forest-demo/portal.png',
    dawn: 'assets/games/forest-demo/dawn.png',
    ruins: 'assets/games/forest-demo/ruins.png',
    gem: 'assets/games/forest-demo/gem.png',
    enemy: 'assets/games/forest-demo/enemy.png',
    checkpoint: 'assets/games/forest-demo/checkpoint.png',
    hazard: 'assets/games/forest-demo/hazard.png',
    lock: 'assets/games/forest-demo/lock.png',
    flowers: 'assets/games/forest-demo/flowers.png',
    ferns: 'assets/games/forest-demo/ferns.png',
    stones: 'assets/games/forest-demo/stones.png',
  },
  music: {
    notes: [57, 64, 69, 0, 67, 64, 60, 0, 57, 62, 65, 0, 64, 60, 57, 0],
    beatSeconds: 0.65,
    volume: 0.009,
  },
  movement: { speed: 88, jump: 235, gravity: 650 },
} satisfies GameDefinition;
