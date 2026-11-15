import Phaser from 'phaser';
import type { MutableGrid } from './mutable-grid';
import type { WorldView } from './sectors';

/** Bounded, disposable sector textures; updates only dirty sectors in view. */
export class MutableTerrainRenderer {
  private views = new Map<
    string,
    {
      image: Phaser.GameObjects.Image;
      texture: Phaser.Textures.CanvasTexture;
      revision: number;
    }
  >();
  constructor(
    private scene: Phaser.Scene,
    private grid: MutableGrid,
    private paint: (
      ctx: CanvasRenderingContext2D,
      value: number,
      x: number,
      y: number,
      localX: number,
      localY: number,
    ) => void,
  ) {}
  get stats() {
    return {
      rendered: this.views.size,
      textureBytes:
        this.views.size * (this.grid.sectorCells * this.grid.tileSize) ** 2 * 4,
    };
  }
  update(view: WorldView) {
    const size = this.grid.sectorCells * this.grid.tileSize,
      wanted = new Set<string>();
    for (
      let y = Math.max(0, Math.floor(view.y / size));
      y <
      Math.min(
        Math.ceil(this.grid.height / size),
        Math.ceil((view.y + view.height) / size),
      );
      y++
    )
      for (
        let x = Math.max(0, Math.floor(view.x / size));
        x <
        Math.min(
          Math.ceil(this.grid.width / size),
          Math.ceil((view.x + view.width) / size),
        );
        x++
      ) {
        const key = `mutable-${x}-${y}`;
        wanted.add(key);
        let entry = this.views.get(key);
        if (!entry) {
          const texture = this.scene.textures.createCanvas(key, size, size)!;
          texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
          entry = {
            texture,
            image: this.scene.add
              .image(x * size, y * size, key)
              .setOrigin(0)
              .setDepth(-100),
            revision: -1,
          };
          this.views.set(key, entry);
        }
        if (entry.revision !== this.grid.revision(x, y)) {
          const ctx = entry.texture.context;
          ctx.imageSmoothingEnabled = false;
          for (let row = 0; row < this.grid.sectorCells; row++)
            for (let col = 0; col < this.grid.sectorCells; col++) {
              const gx = x * this.grid.sectorCells + col,
                gy = y * this.grid.sectorCells + row;
              this.paint(
                ctx,
                this.grid.get(gx, gy),
                gx,
                gy,
                col * this.grid.tileSize,
                row * this.grid.tileSize,
              );
            }
          entry.texture.refresh();
          entry.revision = this.grid.revision(x, y);
        }
      }
    for (const [key, entry] of this.views)
      if (!wanted.has(key)) {
        entry.image.destroy();
        this.scene.textures.remove(key);
        this.views.delete(key);
      }
  }
  destroy() {
    for (const [key, entry] of this.views) {
      entry.image.destroy();
      this.scene.textures.remove(key);
    }
    this.views.clear();
  }
}
