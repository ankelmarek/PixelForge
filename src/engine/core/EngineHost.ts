import Phaser from 'phaser';
import { expandedViewport, fillViewport } from './viewport';
import type { HostOptions, Snapshot } from '../api/types';
import { loadLevel, validateDefinition } from '../api/validation';
import { createScenes, type Session } from '../scenes/scenes';
import { Input, keyActions, type Action } from '../systems/input';
import { Audio } from '../systems/audio';
import { ProgressService, SaveService } from '../systems/progress';
import { RuleSystem } from '../systems/rules';
import { validateSimulationLevel } from '../simulation/validation';
import {
  createSimulationRuntime,
  type SimulationRuntime,
} from '../simulation/runtime';
import type { SimulationCommand } from '../simulation/types';
import type { ClientCommand, ClientRuntime } from '../api/client';
export class EngineHost {
  private game?: Phaser.Game;
  private abort = new AbortController();
  private input = new Input();
  private audio = new Audio();
  private session?: Session;
  private simulation?: SimulationRuntime;
  private client?: ClientRuntime;
  private paused = false;
  private snapshot?: Snapshot;
  private resize?: ResizeObserver;
  private cleanups: (() => void)[] = [];
  constructor(
    private options: HostOptions & {
      onMessage: (message: string) => void;
      onPause: (paused: boolean) => void;
    },
  ) {}
  async load() {
    try {
      const definition = validateDefinition(this.options.definition);
      if (definition.kind === 'client') {
        const response = await fetch(
          new URL(definition.levelUrl, document.baseURI),
          { signal: this.abort.signal },
        );
        if (!response.ok)
          throw Error(`Nie można wczytać świata (${response.status})`);
        const data: unknown = await response.json();
        if (this.abort.signal.aborted) return;
        this.client = await definition.createRuntime(
          {
            input: this.input,
            audio: this.audio,
            ready: this.options.onReady,
            state: (snapshot) => this.publish(snapshot),
            error: this.options.onError,
            message: this.options.onMessage,
          },
          data,
        );
        if (this.abort.signal.aborted) return;
        this.boot(this.client.scenes, 0);
        return;
      }
      if (definition.kind === 'simulation') {
        const response = await fetch(
          new URL(definition.levelUrl, document.baseURI),
          { signal: this.abort.signal },
        );
        if (!response.ok)
          throw new Error(`Nie można wczytać mapy (${response.status})`);
        const level = validateSimulationLevel(
          await response.json(),
          this.options.worldLimits,
          this.options.display === 'fill' ? expandedViewport : undefined,
        );
        if (this.options.display === 'fill' && level.schemaVersion !== 2)
          throw Error('Pełny widok wymaga świata sektorowego');
        const keys = new Set(Object.keys(definition.assets));
        if (level.schemaVersion === 2) {
          const terrain = level.terrain,
            sheet = definition.spriteSheets?.[terrain.texture];
          if (
            !keys.has(terrain.texture) ||
            sheet?.frameWidth !== level.tileSize ||
            sheet.frameHeight !== level.tileSize
          )
            throw Error('Świat: atlas kafli musi pasować do tileSize');
        }
        for (const node of level.nodes)
          for (const texture of [
            node.texture,
            node.stockVisual?.texture,
            node.fillTexture,
          ])
            if (texture && !keys.has(texture))
              throw new Error(`Brak tekstury: ${texture}`);
        for (const actor of level.actors)
          for (const texture of [actor.texture, actor.cargoTexture])
            if (!keys.has(texture))
              throw new Error(`Brak tekstury: ${texture}`);
        for (const resource of level.resources)
          if (!keys.has(resource.icon))
            throw new Error(`Brak ikony: ${resource.icon}`);
        if (this.abort.signal.aborted) return;
        this.simulation = createSimulationRuntime(definition, level, {
          audio: this.audio,
          ready: this.options.onReady,
          error: this.options.onError,
          message: this.options.onMessage,
          state: (snapshot) => this.publish(snapshot),
        });
        this.boot(this.simulation.scenes, 0);
        return;
      }
      if (this.options.display === 'fill')
        throw Error('Pełny widok wymaga świata sektorowego');
      const rules = new RuleSystem();
      definition.registerRules?.(rules);
      const levels = await Promise.all(
        (definition.levels ?? [definition.levelUrl]).map((url) =>
          loadLevel(url, this.abort.signal, rules),
        ),
      );
      if (new Set(levels.map((level) => level.id)).size !== levels.length)
        throw new Error('Powtórzony identyfikator poziomu');
      for (const level of levels) {
        for (const entity of level.entities ?? [])
          if (entity.texture && !(entity.texture in definition.assets))
            throw new Error(`Brak tekstury encji: ${entity.texture}`);
        for (const texture of [
          level.theme?.background,
          level.theme?.decoration,
        ])
          if (texture && !(texture in definition.assets))
            throw new Error(`Brak tekstury warstwy: ${texture}`);
      }
      const progress = new ProgressService(
        new SaveService(definition, levels),
        levels,
      );
      if (this.abort.signal.aborted) return;
      this.session = {
        definition,
        levels,
        rules,
        input: this.input,
        audio: this.audio,
        progress,
        ready: this.options.onReady,
        error: this.options.onError,
        message: this.options.onMessage,
        state: (snapshot) => {
          this.snapshot = snapshot;
          this.options.onState({ ...snapshot, paused: this.paused });
        },
      };
      this.boot(createScenes(this.session), definition.movement.gravity);
    } catch (error) {
      if (!this.abort.signal.aborted)
        this.options.onError(
          error instanceof Error ? error.message : 'Nie można uruchomić gry',
        );
    }
  }
  private publish(snapshot: Snapshot) {
    this.snapshot = snapshot;
    this.options.onState({ ...snapshot, paused: this.paused });
  }
  private boot(scenes: (typeof Phaser.Scene)[], gravity: number) {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.options.parent,
      width: 320,
      height: 180,
      pixelArt: true,
      roundPixels: true,
      backgroundColor: '#112b32',
      audio: { noAudio: true },
      scale: { mode: Phaser.Scale.NONE },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: gravity },
          fixedStep: true,
        },
      },
      scene: scenes,
      callbacks: { postBoot: () => this.attach() },
    });
  }
  command(command: SimulationCommand) {
    this.simulation?.command(command);
  }
  clientCommand(command: ClientCommand) {
    if (!this.paused && !this.snapshot?.completed && !this.snapshot?.failed)
      this.client?.command(command);
  }
  private attach() {
    const canvas = this.game!.canvas;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      'aria-label',
      this.client
        ? 'Obszar gry'
        : this.simulation
          ? 'Obszar symulatora'
          : 'Obszar platformówki',
    );
    const key = (pressed: boolean) => (event: KeyboardEvent) => {
      const action = keyActions[event.code];
      if (action) {
        event.preventDefault();
        if (!this.paused && !this.simulation)
          this.input.set(action, pressed, event.code);
      }
      if (event.code === 'Escape' && pressed && !event.repeat) {
        event.preventDefault();
        this.pause(!this.paused);
      }
    };
    const down = key(true),
      up = key(false);
    const blur = () => {
      this.input.clear();
      if (!this.snapshot?.completed && !this.snapshot?.failed) this.pause(true);
    };
    const visibility = () => {
      if (document.hidden) blur();
    };
    canvas.addEventListener('keydown', down);
    canvas.addEventListener('keyup', up);
    canvas.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    this.cleanups.push(() => {
      canvas.removeEventListener('keydown', down);
      canvas.removeEventListener('keyup', up);
      canvas.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    });
    // CSS integer scaling and layout shifts can precede Phaser's periodic bounds check.
    // Refresh before native input is transformed so the very first click is accurate.
    const syncPointerBounds = () => {
      const scale = this.game!.scale;
      scale.updateBounds();
      const bounds = scale.canvasBounds;
      if (bounds.width > 0 && bounds.height > 0)
        scale.displayScale.set(
          canvas.width / bounds.width,
          canvas.height / bounds.height,
        );
    };
    const pointerEvents = [
      'mousedown',
      'mousemove',
      'mouseup',
      'touchstart',
      'touchmove',
      'touchend',
      'wheel',
    ];
    pointerEvents.forEach((type) =>
      canvas.addEventListener(type, syncPointerBounds, {
        capture: true,
        passive: true,
      }),
    );
    this.cleanups.push(() =>
      pointerEvents.forEach((type) =>
        canvas.removeEventListener(type, syncPointerBounds, true),
      ),
    );
    this.resize = new ResizeObserver(() => {
      const parent = this.options.parent;
      if (this.options.display === 'fill') {
        const definition = this.options.definition;
        const view = fillViewport(
          parent.clientWidth,
          parent.clientHeight,
          definition.kind === 'client'
            ? definition.preferredViewport
            : undefined,
        );
        if (canvas.width !== view.width || canvas.height !== view.height)
          this.game!.scale.resize(view.width, view.height);
        // Exact integer scaling; at most scale - 1 CSS pixels are clipped at an edge.
        canvas.style.width = `${view.width * view.scale}px`;
        canvas.style.height = `${view.height * view.scale}px`;
        syncPointerBounds();
        return;
      }
      const ratio = Math.min(
        parent.clientWidth / 320,
        parent.clientHeight / 180,
      );
      const scale = ratio >= 1 ? Math.floor(ratio) : ratio;
      canvas.style.width = `${320 * scale}px`;
      canvas.style.height = `${180 * scale}px`;
      syncPointerBounds();
    });
    this.resize.observe(this.options.parent);
  }
  start(resume = false) {
    if (!this.game || (!this.session && !this.simulation && !this.client))
      return;
    this.audio.unlock();
    this.audio.pause(false);
    this.audio.music(this.options.definition.music);
    this.input.clear();
    this.paused = false;
    if (this.client) this.client.start(resume);
    else if (this.simulation) this.simulation.start(resume);
    else if (!resume) this.session!.progress.reset();
    else this.session!.progress.state = this.session!.progress.save.read();
    this.game.scene.stop('Title');
    this.game.scene.stop('Gameplay');
    this.game.scene.start('Gameplay');
    this.game.canvas.focus({ preventScroll: true });
    this.options.onPause(false);
  }
  action(action: Action, pressed: boolean, source: string) {
    if (!this.paused) this.input.set(action, pressed, source);
  }
  pause(paused: boolean) {
    if (
      !this.game?.scene.isActive('Gameplay') &&
      !this.game?.scene.isPaused('Gameplay')
    )
      return;
    this.paused = paused;
    this.audio.pause(paused);
    this.input.clear();
    if (paused) {
      this.session?.progress.persist();
      this.simulation?.persist();
      this.client?.persist();
      this.game.scene.pause('Gameplay');
    } else {
      this.game.scene.resume('Gameplay');
      this.game.canvas.focus({ preventScroll: true });
    }
    if (this.snapshot) this.options.onState({ ...this.snapshot, paused });
    this.options.onPause(paused);
  }
  mute() {
    this.audio.muted = !this.audio.muted;
    return this.audio.muted;
  }
  focus() {
    this.game?.canvas.focus({ preventScroll: true });
  }
  destroy() {
    this.session?.progress.persist();
    this.simulation?.persist();
    this.client?.persist();
    this.abort.abort();
    this.cleanups.forEach((cleanup) => cleanup());
    this.resize?.disconnect();
    this.input.clear();
    this.audio.destroy();
    this.game?.destroy(true);
  }
}
