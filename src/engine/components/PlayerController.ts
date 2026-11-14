import type Phaser from 'phaser';
import type { GameDefinition } from '../api/types';
import type { Input } from '../systems/input';
export class PlayerController {
  private coyote = 0;
  private buffered = 0;
  constructor(
    private player: Phaser.Physics.Arcade.Sprite,
    private input: Input,
    private movement: GameDefinition['movement'],
    private jumpSound: () => void,
  ) {
    player
      .setMaxVelocity(movement.speed, 450)
      .setDragX(movement.acceleration ?? 900);
  }
  update(delta: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.coyote = body.blocked.down ? 90 : Math.max(0, this.coyote - delta);
    this.buffered = this.input.consume('jump')
      ? 100
      : Math.max(0, this.buffered - delta);
    const direction =
      Number(this.input.down('right')) - Number(this.input.down('left'));
    this.player.setAccelerationX(
      direction * (this.movement.acceleration ?? 900),
    );
    if (direction) this.player.setFlipX(direction < 0);
    if (this.buffered > 0 && this.coyote > 0) {
      this.player.setVelocityY(-this.movement.jump);
      this.coyote = 0;
      this.buffered = 0;
      this.jumpSound();
    }
  }
}
