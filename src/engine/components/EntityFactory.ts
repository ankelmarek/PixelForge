import Phaser from 'phaser';
import type { EntityDefinition } from '../api/types';
export interface Entity {
  definition: EntityDefinition;
  sprite: Phaser.Physics.Arcade.Sprite;
}
const defaults = {
  trigger: 'beacon',
  collectible: 'beacon',
  enemy: 'player',
  hazard: 'terrain',
  checkpoint: 'beacon',
  switch: 'beacon',
  door: 'portal',
};
export function createEntity(
  scene: Phaser.Scene,
  definition: EntityDefinition,
): Entity {
  const sprite = scene.physics.add.sprite(
    definition.x,
    definition.y,
    definition.texture ?? defaults[definition.type],
  );
  sprite.setOrigin(0.5, 1);
  if (definition.width && definition.height)
    sprite.setDisplaySize(definition.width, definition.height);
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body
    .setAllowGravity(definition.type === 'enemy')
    .setImmovable(definition.type !== 'enemy');
  body
    .setSize(sprite.width * 0.75, sprite.height * 0.8)
    .setOffset(sprite.width * 0.125, sprite.height * 0.2);
  sprite.setDepth(10);
  if (definition.type === 'trigger' && !definition.texture)
    sprite.setVisible(false);
  return { definition, sprite };
}
export function patrol(entity: Entity) {
  const config = entity.definition.patrol;
  if (!config || !entity.sprite.active) return;
  const body = entity.sprite.body as Phaser.Physics.Arcade.Body;
  const direction =
    entity.sprite.x <= config.min
      ? 1
      : entity.sprite.x >= config.max
        ? -1
        : body.velocity.x >= 0
          ? 1
          : -1;
  entity.sprite.setVelocityX(direction * config.speed).setFlipX(direction < 0);
}
