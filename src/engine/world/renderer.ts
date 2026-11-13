import Phaser from 'phaser';
import type {
  SectorData,
  SectorReference,
  WorldLevel,
} from '../simulation/types';
import { SectorCache, sectorsInView, type WorldView } from './sectors';
export function cameraView(camera: Phaser.Cameras.Scene2D.Camera): WorldView {
  return {
    x: camera.scrollX + camera.width / 2 - camera.width / (2 * camera.zoom),
    y: camera.scrollY + camera.height / 2 - camera.height / (2 * camera.zoom),
    width: camera.width / camera.zoom,
    height: camera.height / camera.zoom,
  };
}
/** One small texture per resident sector batches all immutable tile layers. */
export class SectorRenderer {
  private cache: SectorCache;
  private views = new Map<string, Phaser.GameObjects.Image>();
  private prefix: string;
  private missing = 0;
  constructor(
    private scene: Phaser.Scene,
    readonly level: WorldLevel,
    levelUrl: string,
    error: (message: string) => void,
  ) {
    this.prefix = `sector-${level.id}-`;
    scene.cameras.main.setBackgroundColor(level.terrain.fallbackColor);
    const base = new URL(levelUrl, document.baseURI);
    this.cache = new SectorCache(
      level,
      async (ref, signal) => {
        const response = await fetch(new URL(ref.url, base), { signal });
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        // Small sector payloads only; malformed/oversized content is a content error.
        const text = await response.text();
        if (text.length > 262144) throw Error('przekroczony rozmiar danych');
        return JSON.parse(text) as unknown;
      },
      error,
    );
  }
  get stats() {
    const size = this.level.terrain.sectorSize * this.level.tileSize;
    return {
      ...this.cache.stats,
      rendered: this.views.size,
      missing: this.missing,
      textureBytes: this.views.size * size * size * 4,
    };
  }
  update(view: WorldView) {
    const wanted = sectorsInView(this.level, view),
      ids = new Set(wanted.map((r) => r.id));
    this.cache.update(wanted);
    for (const [id, image] of this.views)
      if (!ids.has(id)) {
        image.destroy();
        this.scene.textures.remove(this.prefix + id);
        this.views.delete(id);
      }
    let created = 0;
    for (const ref of wanted) {
      const data = this.cache.get(ref.id);
      if (!this.views.has(ref.id) && data && created < 2) {
        this.create(ref, data);
        created++;
      }
    }
    this.missing = sectorsInView(this.level, view, 0).filter(
      (r) => !this.views.has(r.id),
    ).length;
  }
  private create(ref: SectorReference, data: SectorData) {
    const tile = this.level.tileSize,
      cells = this.level.terrain.sectorSize,
      size = tile * cells;
    const key = this.prefix + ref.id;
    const texture = this.scene.textures.createCanvas(key, size, size)!;
    const context = texture.context;
    context.imageSmoothingEnabled = false;
    for (const layer of data.layers) {
      let index = 0;
      for (const [frame, count] of layer.runs) {
        if (frame < 0) {
          index += count;
          continue;
        }
        const source = this.scene.textures.getFrame(
          this.level.terrain.texture,
          frame,
        );
        for (let i = 0; i < count; i++, index++)
          context.drawImage(
            source.source.image as CanvasImageSource,
            source.cutX,
            source.cutY,
            tile,
            tile,
            (index % cells) * tile,
            Math.floor(index / cells) * tile,
            tile,
            tile,
          );
      }
    }
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.views.set(
      ref.id,
      this.scene.add
        .image(ref.x * size, ref.y * size, key)
        .setOrigin(0)
        .setDepth(-1),
    );
  }
  destroy() {
    this.cache.destroy();
    for (const [id, image] of this.views) {
      image.destroy();
      this.scene.textures.remove(this.prefix + id);
    }
    this.views.clear();
  }
}
