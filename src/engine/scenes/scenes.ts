import Phaser from 'phaser';
import { createFlowScenes } from './flow';
import type { GameDefinition, LevelDefinition, Snapshot } from '../api/types';
import type { Input } from '../systems/input';
import type { Audio } from '../systems/audio';
import type { ProgressService } from '../systems/progress';
import type { RuleSystem } from '../systems/rules';
import { PlayerController } from '../components/PlayerController';
import { createEntity, patrol, type Entity } from '../components/EntityFactory';
export interface Session {
  definition: GameDefinition;
  levels: LevelDefinition[];
  input: Input;
  audio: Audio;
  progress: ProgressService;
  rules: RuleSystem;
  ready: () => void;
  state: (snapshot: Snapshot) => void;
  error: (message: string) => void;
  message: (message: string) => void;
}
export function createScenes(session: Session) {
  const { definition: game, input, audio, progress, rules } = session;
  class Gameplay extends Phaser.Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private controller!: PlayerController;
    private backdrop!: Phaser.GameObjects.TileSprite;
    private beacon!: Phaser.GameObjects.Image;
    private portal!: Phaser.GameObjects.Image;
    private entities: Entity[] = [];
    private lock?: Phaser.GameObjects.Image;
    private pips: { id: string; image: Phaser.GameObjects.Image }[] = [];
    private level!: LevelDefinition;
    private invulnerableUntil = 0;
    private hurtUntil = 0;
    private tick = 0;
    private changing = false;
    private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
      .matches;
    constructor() {
      super('Gameplay');
    }
    create() {
      this.level = progress.level;
      const level = this.level;
      this.entities = [];
      this.pips = [];
      this.hurtUntil = 0;
      this.lock = undefined;
      this.tick = 0;
      this.invulnerableUntil = progress.state.elapsedSeconds + 0.5;
      this.changing = false;
      this.backdrop = this.add
        .tileSprite(0, 0, 320, 180, level.theme?.background ?? 'background')
        .setOrigin(0)
        .setScrollFactor(0);
      this.physics.world.setBounds(0, 0, level.width, level.height + 80);
      const platforms = this.physics.add.staticGroup();
      level.platforms.forEach((p) => {
        const terrain = this.add
          .tileSprite(p.x, p.y, p.width, p.height, 'terrain')
          .setOrigin(0)
          .setDepth(2);
        if (level.theme) terrain.setTint(level.theme.tint);
        this.physics.add.existing(terrain, true);
        platforms.add(terrain);
      });
      if (level.theme?.decoration) {
        for (let x = 56; x < level.width; x += 97) {
          if (
            (level.entities ?? []).some(
              (e) =>
                ['hazard', 'enemy', 'checkpoint', 'switch'].includes(e.type) &&
                Math.abs(e.x - x) < 30,
            )
          )
            continue;
          this.add
            .image(x, 157, level.theme.decoration)
            .setOrigin(0.5, 1)
            .setDepth(25)
            .setAlpha(0.8);
        }
      }
      this.beacon = this.add
        .image(level.interaction.x, level.interaction.y, 'beacon')
        .setOrigin(0.5, 1)
        .setDepth(3);
      this.portal = this.add
        .image(level.exit.x, level.exit.y, 'portal')
        .setOrigin(0.5, 1)
        .setDepth(3);
      if (this.textures.exists('lock'))
        this.lock = this.add
          .image(level.exit.x, level.exit.y - 23, 'lock')
          .setDepth(4);
      const collectibles = (level.entities ?? []).filter(
        (e) => e.type === 'collectible',
      );
      for (const [index, entity] of collectibles.entries()) {
        const image = this.add
          .image(
            level.interaction.x + (index - (collectibles.length - 1) / 2) * 5,
            level.interaction.y - 38,
            entity.texture ?? 'beacon',
          )
          .setScale(0.28)
          .setDepth(4);
        this.pips.push({ id: entity.id, image });
      }
      // Explicit entities replace the compatibility interaction used by M0 maps.
      this.beacon.setVisible(
        !(level.entities ?? []).some((e) => e.type === 'switch'),
      );
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
        .setCollideWorldBounds(true)
        .setDepth(20);
      this.player.body!.setSize(10, 21);
      this.player.body!.setOffset(3, 3);
      this.controller = new PlayerController(
        this.player,
        input,
        game.movement,
        () => audio.play('jump'),
      );
      this.physics.add.collider(this.player, platforms);
      for (const definition of level.entities ?? []) {
        if (
          definition.type === 'collectible' &&
          progress.context().collected.includes(definition.id)
        )
          continue;
        const entity = createEntity(this, definition);
        this.entities.push(entity);
        if (
          definition.type === 'checkpoint' &&
          progress.state.checkpointId === definition.id
        )
          entity.sprite.setTint(0xe5ffd2);
        if (definition.type === 'collectible' && !this.reducedMotion)
          this.tweens.add({
            targets: entity.sprite,
            y: definition.y - 2,
            duration: 850,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        if (definition.type === 'enemy') {
          this.physics.add.collider(entity.sprite, platforms);
          if (game.spriteSheets?.[definition.texture ?? '']) {
            const key = `patrol:${definition.texture}`;
            if (!this.anims.exists(key))
              this.anims.create({
                key,
                frames: this.anims.generateFrameNumbers(definition.texture!, {
                  start: 0,
                  end: 1,
                }),
                frameRate: 5,
                repeat: -1,
              });
            entity.sprite.play(key);
          }
        }
        this.physics.add.overlap(this.player, entity.sprite, () =>
          this.overlap(entity),
        );
      }
      this.cameras.main
        .setBounds(0, 0, level.width, level.height)
        .startFollow(this.player, true, 1, 1, -44, 15)
        .setRoundPixels(true);
      const checkpoint = level.entities?.find(
        (e) => e.id === progress.state.checkpointId,
      );
      if (checkpoint) this.player.setPosition(checkpoint.x, checkpoint.y - 16);
      else if (progress.flag('activated') && !level.entities?.length)
        this.player.setPosition(level.interaction.x, level.interaction.y - 16);
      if (progress.state.completed) this.player.setX(level.exit.x);
      this.events.on(Phaser.Scenes.Events.PRE_UPDATE, this.controls, this);
      this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.emit, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.events.off(Phaser.Scenes.Events.PRE_UPDATE, this.controls, this);
        this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.emit, this);
      });
      this.emit();
    }
    private stopped() {
      return (
        progress.state.completed || progress.state.lives === 0 || this.changing
      );
    }
    private controls(_time: number, delta: number) {
      if (this.stopped()) {
        this.player.setVelocity(0).setAccelerationX(0);
        return;
      }
      this.controller.update(Math.min(delta, 100));
      this.entities.forEach(patrol);
    }
    private emit() {
      session.state({
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        grounded: !!this.player.body?.blocked.down,
        activated: progress.flag('activated'),
        completed: progress.state.completed,
        failed: progress.state.lives === 0,
        paused: false,
        lives: progress.state.lives,
        collected: progress.context().collected.length,
        total:
          this.level.entities?.filter((e) => e.type === 'collectible').length ??
          0,
        levelIndex: progress.state.levelIndex,
        levelCount: session.levels.length,
        levelName: this.level.title ?? this.level.id,
        checkpoint: progress.state.checkpointId,
        elapsed: Math.floor(progress.state.elapsedSeconds),
      });
    }
    private burst(x: number, y: number, texture = 'beacon') {
      if (this.reducedMotion) return;
      for (let i = 0; i < 6; i++) {
        const particle = this.add
          .image(x, y, texture)
          .setScale(0.18)
          .setDepth(30);
        this.tweens.add({
          targets: particle,
          x: x + Math.cos(i) * 18,
          y: y - 12 + Math.sin(i) * 14,
          alpha: 0,
          duration: 350,
          onComplete: () => particle.destroy(),
        });
      }
    }
    private overlap(entity: Entity) {
      if (this.stopped()) return;
      const { definition: e, sprite } = entity;
      if (!sprite.active) return;
      if (
        e.type === 'trigger' &&
        rules.allows(e.requires, progress.context())
      ) {
        rules.run(
          e.onInteract ?? [{ action: 'setFlag', flag: e.flag ?? e.id }],
          progress.context(),
          {
            setFlag: (name, value) => progress.setFlag(name, value),
            complete: () => this.complete(),
          },
        );
        sprite.disableBody(true, true);
        this.persist();
      } else if (e.type === 'collectible' && progress.collect(e.id)) {
        this.burst(sprite.x, sprite.y - 8, e.texture);
        this.tweens.killTweensOf(sprite);
        sprite.destroy();
        audio.play('collect');
      } else if (e.type === 'checkpoint' && progress.checkpoint(e.id)) {
        sprite.setTint(0xe5ffd2);
        this.burst(sprite.x, sprite.y - 8);
        audio.play('activate');
      } else if (e.type === 'enemy' || e.type === 'hazard') {
        if (
          e.type === 'enemy' &&
          e.texture &&
          game.spriteSheets?.[e.texture] &&
          this.textures.get(e.texture).frameTotal > 3 &&
          progress.state.elapsedSeconds >= this.invulnerableUntil
        ) {
          sprite.anims.pause();
          sprite.setFrame(2);
          this.time.delayedCall(220, () => {
            if (sprite.active) sprite.anims.resume();
          });
        }
        this.hit();
      }
    }
    private hit() {
      if (
        progress.state.elapsedSeconds < this.invulnerableUntil ||
        this.stopped()
      )
        return;
      const alive = progress.damage();
      audio.play('hit');
      this.invulnerableUntil = progress.state.elapsedSeconds + 1.4;
      this.hurtUntil = progress.state.elapsedSeconds + 0.35;
      if (!this.reducedMotion) this.cameras.main.shake(90, 0.003);
      if (alive) {
        const spawn =
          this.level.entities?.find(
            (e) => e.id === progress.state.checkpointId,
          ) ?? this.level.spawn;
        this.player
          .setPosition(
            spawn.x,
            spawn.y - (progress.state.checkpointId ? 16 : 0),
          )
          .setVelocity(0);
        (this.player.body as Phaser.Physics.Arcade.Body).reset(
          this.player.x,
          this.player.y,
        );
      }
    }
    private complete() {
      if (this.changing || this.stopped()) return;
      const index = progress.state.levelIndex;
      progress.completeLevel();
      audio.play('complete');
      if (index !== progress.state.levelIndex) {
        this.changing = true;
        input.clear();
        this.scene.restart();
      }
    }
    update(_time: number, delta: number) {
      this.backdrop.tilePositionX =
        this.cameras.main.scrollX * (this.reducedMotion ? 0 : 0.12);
      if (this.stopped()) return;
      const elapsed = Math.min(delta, 100) / 1000;
      progress.state.elapsedSeconds += elapsed;
      this.tick += Math.min(delta, 100);
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const hurt = progress.state.elapsedSeconds < this.hurtUntil;
      this.player.setTint(hurt ? 0xf6ac91 : 0xffffff).setAlpha(hurt ? 0.75 : 1);
      if (hurt && this.textures.get('player').frameTotal > 7) {
        this.player.anims.stop();
        this.player.setFrame(6);
      } else if (!body.blocked.down) {
        this.player.anims.stop();
        this.player.setFrame(4);
      } else if (Math.abs(body.velocity.x) > 6) this.player.play('run', true);
      else {
        this.player.anims.stop();
        this.player.setFrame(
          this.reducedMotion || Math.floor(this.tick / 700) % 2 === 0 ? 0 : 5,
        );
      }
      if (this.player.y > this.level.height + 12) this.hit();
      const context = progress.context();
      const switches = this.entities.filter(
        (e) => e.definition.type === 'switch' || e.definition.type === 'door',
      );
      let interacted = false;
      const pressed = input.consume('interact');
      for (const entity of switches) {
        const e = entity.definition;
        const near =
          Math.abs(this.player.x - e.x) < 27 &&
          Math.abs(this.player.y - e.y) < 35;
        const allowed = rules.allows(e.requires, context);
        const flag = progress.flag(e.flag ?? 'activated');
        entity.sprite.setTint(flag ? 0xffffff : allowed ? 0xb3d5ac : 0x5d746e);
        entity.sprite.setAlpha(
          near && !this.reducedMotion
            ? 0.85 + Math.sin(this.tick / 180) * 0.15
            : 1,
        );
        if (pressed && near && !interacted && allowed) {
          interacted = true;
          rules.run(
            e.onInteract ?? [
              { action: 'toggleFlag', flag: e.flag ?? 'activated' },
            ],
            context,
            {
              setFlag: (name, value) => progress.setFlag(name, value),
              complete: () => this.complete(),
            },
          );
          this.burst(e.x, e.y - 16);
          audio.play('activate');
          this.persist();
        }
      }
      const legacyNear =
        Math.abs(this.player.x - this.level.interaction.x) < 26 &&
        Math.abs(this.player.y - this.level.interaction.y) < 32;
      if (!switches.length && pressed && legacyNear) {
        progress.setFlag('activated', !progress.flag('activated'));
        audio.play('activate');
        this.persist();
      }
      this.beacon
        .setTint(progress.flag('activated') ? 0xffffff : 0x73968e)
        .setAlpha(legacyNear ? 1 : 0.7);
      const unlocked = rules.allows(
        this.level.exitRequires ?? { allFlags: ['activated'] },
        progress.context(),
      );
      this.portal.setAlpha(unlocked ? 1 : 0.4);
      this.lock?.setVisible(!unlocked);
      for (const pip of this.pips)
        pip.image.setAlpha(context.collected.includes(pip.id) ? 1 : 0.25);
      if (
        Math.abs(this.player.x - this.level.exit.x) < 18 &&
        Math.abs(this.player.y - this.level.exit.y) < 38 &&
        unlocked
      )
        this.complete();
    }
    private persist() {
      if (!progress.persist()) session.message('Zapis lokalny niedostępny.');
    }
  }
  return [...createFlowScenes(game, session.ready, session.error), Gameplay];
}
