import Phaser from 'phaser';
import type { HostOptions, Snapshot } from '../api/types';
import { loadLevel, validateGame } from '../api/validation';
import { createScenes, type Session } from '../scenes/scenes';
import { Input, keyActions, type Action } from '../systems/input';
import { Audio } from '../systems/audio';
import { freshProgress, readProgress, writeProgress } from '../systems/save';
export class EngineHost {
  private game?: Phaser.Game;
  private abort = new AbortController();
  private input = new Input();
  private audio = new Audio();
  private session?: Session;
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
      const definition = validateGame(this.options.definition);
      const level = await loadLevel(definition.levelUrl, this.abort.signal);
      if (this.abort.signal.aborted) return;
      this.session = {
        definition,
        level,
        input: this.input,
        audio: this.audio,
        progress: readProgress(definition.id),
        ready: this.options.onReady,
        error: this.options.onError,
        message: this.options.onMessage,
        state: (snapshot) => {
          this.snapshot = snapshot;
          this.options.onState({ ...snapshot, paused: this.paused });
        },
      };
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
            gravity: { x: 0, y: definition.movement.gravity },
            fixedStep: true,
          },
        },
        scene: createScenes(this.session),
        callbacks: { postBoot: () => this.attach() },
      });
    } catch (error) {
      if (!this.abort.signal.aborted)
        this.options.onError(
          error instanceof Error ? error.message : 'Nie można uruchomić gry',
        );
    }
  }
  private attach() {
    const canvas = this.game!.canvas;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      'aria-label',
      'Obszar gry. Strzałki: ruch, spacja: skok, Shift: interakcja, Escape: pauza.',
    );
    const key = (pressed: boolean) => (event: KeyboardEvent) => {
      const action = keyActions[event.code];
      if (action) {
        event.preventDefault();
        if (!this.paused) this.input.set(action, pressed, event.code);
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
      this.pause(true);
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
    this.resize = new ResizeObserver(() => {
      const parent = this.options.parent;
      const ratio = Math.min(
        parent.clientWidth / 320,
        parent.clientHeight / 180,
      );
      const scale = ratio >= 1 ? Math.floor(ratio) : ratio;
      canvas.style.width = `${320 * scale}px`;
      canvas.style.height = `${180 * scale}px`;
    });
    this.resize.observe(this.options.parent);
  }
  start(resume = false) {
    if (!this.game || !this.session) return;
    this.audio.unlock();
    this.input.clear();
    this.paused = false;
    if (!resume) {
      this.session.progress = freshProgress();
      writeProgress(this.session.definition.id, this.session.progress);
    }
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
    this.input.clear();
    if (paused) this.game.scene.pause('Gameplay');
    else {
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
    this.abort.abort();
    this.cleanups.forEach((cleanup) => cleanup());
    this.resize?.disconnect();
    this.input.clear();
    this.audio.destroy();
    this.game?.destroy(true);
  }
}
