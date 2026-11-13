import Phaser from 'phaser';
import type { GameDefinition, LevelDefinition, Snapshot } from '../api/types';
import type { Input } from '../systems/input';
import type { Audio } from '../systems/audio';
import { writeProgress, type Progress } from '../systems/save';
export interface Session {
  definition: GameDefinition;
  level: LevelDefinition;
  input: Input;
  audio: Audio;
  progress: Progress;
  ready: () => void;
  state: (snapshot: Snapshot) => void;
  error: (message: string) => void;
  message: (message: string) => void;
}
export function createScenes(session: Session) {
  const { definition: game, level, input, audio } = session;
  class Boot extends Phaser.Scene {
    constructor() {
      super('Boot');
    }
    create() {
      this.scene.start('Preload');
    }
  }
  class Preload extends Phaser.Scene {
    constructor() {
      super('Preload');
    }
    preload() {
      this.load.on('loaderror', (file: Phaser.Loader.File) =>
        session.error(
          `Brak zasobu: ${file.key}. Wróć do katalogu i spróbuj ponownie.`,
        ),
      );
      this.load.spritesheet(
        'player',
        new URL(game.assets.player, document.baseURI).href,
        { frameWidth: 16, frameHeight: 24 },
      );
      for (const key of ['background', 'terrain', 'beacon', 'portal'] as const)
        this.load.image(key, new URL(game.assets[key], document.baseURI).href);
    }
    create() {
      if (Object.keys(game.assets).every((key) => this.textures.exists(key)))
        this.scene.start('Title');
    }
  }
  class Title extends Phaser.Scene {
    constructor() {
      super('Title');
    }
    create() {
      this.add.image(160, 90, 'background');
      session.ready();
    }
  }
  class Gameplay extends Phaser.Scene {
    private backdrop!: Phaser.GameObjects.TileSprite;
    private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
      .matches;
    private player!: Phaser.Physics.Arcade.Sprite;
    private beacon!: Phaser.GameObjects.Image;
    private portal!: Phaser.GameObjects.Image;
    private finished = false;
    private tick = 0;
    private hint = '';
    private saveUnavailable = false;
    constructor() {
      super('Gameplay');
    }
    create() {
      this.finished = false;
      this.tick = 0;
      this.hint = '';
      this.saveUnavailable = false;
      this.backdrop = this.add
        .tileSprite(0, 0, 320, 180, 'background')
        .setOrigin(0)
        .setScrollFactor(0);
      this.physics.world.setBounds(0, 0, level.width, level.height);
      const platforms = this.physics.add.staticGroup();
      level.platforms.forEach((p) => {
        const terrain = this.add
          .tileSprite(p.x, p.y, p.width, p.height, 'terrain')
          .setOrigin(0);
        this.physics.add.existing(terrain, true);
        platforms.add(terrain);
      });
      // Foreground decoration is supplied by the game's terrain texture.
      this.beacon = this.add
        .image(level.interaction.x, level.interaction.y, 'beacon')
        .setOrigin(0.5, 1);
      this.portal = this.add
        .image(level.exit.x, level.exit.y, 'portal')
        .setOrigin(0.5, 1);
      if (!this.anims.exists('run'))
        this.anims.create({
          key: 'run',
          frames: this.anims.generateFrameNumbers('player', {
            start: 1,
            end: 3,
          }),
          frameRate: 10,
          repeat: -1,
        });
      this.player = this.physics.add
        .sprite(level.spawn.x, level.spawn.y, 'player')
        .setCollideWorldBounds(true);
      this.player.body!.setSize(10, 21);
      this.player.body!.setOffset(3, 3);
      this.physics.add.collider(this.player, platforms);
      this.cameras.main
        .setBounds(0, 0, level.width, level.height)
        .startFollow(this.player, true, 1, 1, -44, 15);
      this.cameras.main.setRoundPixels(true);
      if (session.progress.completed) {
        this.player.setX(level.exit.x);
        this.finished = true;
      } else if (session.progress.activated)
        this.player.setPosition(level.interaction.x, level.interaction.y - 16);
      // Apply controls before Arcade steps, then publish positions after body/sprite sync.
      this.events.on(Phaser.Scenes.Events.PRE_UPDATE, this.applyControls, this);
      this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.emitState, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.events.off(
          Phaser.Scenes.Events.PRE_UPDATE,
          this.applyControls,
          this,
        );
        this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.emitState, this);
      });
      this.emitState();
    }
    private applyControls() {
      if (this.finished) {
        this.player.setVelocity(0);
        return;
      }
      const direction =
        Number(input.down('right')) - Number(input.down('left'));
      this.player.setVelocityX(direction * game.movement.speed);
      if (direction) this.player.setFlipX(direction < 0);
      if (input.consume('jump') && this.player.body?.blocked.down) {
        this.player.setVelocityY(-game.movement.jump);
        audio.play('jump');
      }
    }
    private emitState() {
      session.state({
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        grounded: !!this.player.body?.blocked.down,
        activated: session.progress.activated,
        completed: this.finished,
        paused: false,
      });
    }
    update(_time: number, delta: number) {
      this.backdrop.tilePositionX =
        this.cameras.main.scrollX * (this.reducedMotion ? 0 : 0.12);
      if (this.finished) {
        return;
      }
      this.tick += Math.min(delta, 100);
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const direction =
        Number(input.down('right')) - Number(input.down('left'));
      if (!body.blocked.down) {
        this.player.anims.stop();
        this.player.setFrame(4);
      } else if (direction) this.player.play('run', true);
      else {
        this.player.anims.stop();
        this.player.setFrame(
          this.reducedMotion || Math.floor(this.tick / 700) % 2 === 0 ? 0 : 5,
        );
      }
      const near =
        Math.abs(this.player.x - level.interaction.x) < 26 &&
        Math.abs(this.player.y - level.interaction.y) < 32;
      let hint = '';
      if (input.consume('interact') && near) {
        session.progress.activated = !session.progress.activated;
        audio.play('activate');
        this.saveUnavailable = !writeProgress(game.id, session.progress);
      }
      const glow = this.reducedMotion
        ? 1
        : 0.85 + Math.sin(this.tick / 250) * 0.15;
      this.beacon.setAlpha(near ? glow : 0.7);
      this.beacon.setTint(
        session.progress.activated ? 0xffffff : near ? 0xb7d9b0 : 0x73968e,
      );
      this.portal.setAlpha(session.progress.activated ? 1 : 0.45);
      if (this.saveUnavailable) hint += ' Zapis lokalny niedostępny.';
      if (
        Math.abs(this.player.x - level.exit.x) < 20 &&
        session.progress.activated
      ) {
        this.finished = true;
        session.progress.completed = true;
        audio.play('complete');
        writeProgress(game.id, session.progress);
      }
      if (hint !== this.hint) {
        this.hint = hint;
        session.message(hint);
      }
    }
  }
  return [Boot, Preload, Title, Gameplay];
}
