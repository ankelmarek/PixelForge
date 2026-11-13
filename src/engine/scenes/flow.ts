import Phaser from 'phaser';
export interface SceneContent {
  assets: Record<string, string>;
  spriteSheets?: Record<string, { frameWidth: number; frameHeight: number }>;
}
export function createFlowScenes(
  content: SceneContent,
  ready: () => void,
  error: (message: string) => void,
) {
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
        error(`Brak zasobu: ${file.key}. Wróć do katalogu i spróbuj ponownie.`),
      );
      for (const [key, url] of Object.entries(content.assets)) {
        const sheet =
          content.spriteSheets?.[key] ??
          (key === 'player' ? { frameWidth: 16, frameHeight: 24 } : undefined);
        const path = new URL(url, document.baseURI).href;
        if (sheet) this.load.spritesheet(key, path, sheet);
        else this.load.image(key, path);
      }
    }
    create() {
      if (Object.keys(content.assets).every((key) => this.textures.exists(key)))
        this.scene.start('Title');
    }
  }
  class Title extends Phaser.Scene {
    constructor() {
      super('Title');
    }
    create() {
      this.add.image(
        160,
        90,
        this.textures.exists('cover') ? 'cover' : 'background',
      );
      ready();
    }
  }
  return [Boot, Preload, Title];
}
