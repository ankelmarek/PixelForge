import Phaser from 'phaser';
import type { Snapshot } from '../api/types';
import type { Audio } from '../systems/audio';
import { createFlowScenes } from '../scenes/flow';
import { SimulationModel } from './model';
import { SimulationSave } from './save';
import { PointerInputService } from './pointer';
import type {
  ActorState,
  SimulationCommand,
  SimulationDefinition,
  SimulationLevel,
  SimulationNode,
} from './types';
interface Options {
  audio: Audio;
  ready: () => void;
  state: (snapshot: Snapshot) => void;
  error: (message: string) => void;
  message: (message: string) => void;
}
export interface SimulationRuntime {
  definition: SimulationDefinition;
  scenes: (typeof Phaser.Scene)[];
  start: (resume: boolean) => void;
  persist: () => boolean;
  command: (command: SimulationCommand) => void;
}
export function createSimulationRuntime(
  definition: SimulationDefinition,
  level: SimulationLevel,
  options: Options,
): SimulationRuntime {
  const model = new SimulationModel(level),
    save = new SimulationSave(definition, model),
    tile = level.tileSize;
  let active: Gameplay | undefined,
    lastSaved = 0,
    started = false;
  const persist = () => {
    if (!started) return true;
    lastSaved = model.state.seconds;
    const ok = save.write();
    if (!ok) options.message('Zapis lokalny niedostępny.');
    return ok;
  };
  class Gameplay extends Phaser.Scene {
    private pointer!: PointerInputService;
    private graphics!: Phaser.GameObjects.Graphics;
    private hover: string | null = null;
    private actorSprites = new Map<
      string,
      {
        sprite: Phaser.GameObjects.Sprite;
        shadow: Phaser.GameObjects.Ellipse;
        cargo: Phaser.GameObjects.Image[];
        lastX: number;
      }
    >();
    private nodeSprites = new Map<
      string,
      {
        sprite: Phaser.GameObjects.Sprite;
        stock: Phaser.GameObjects.Image[];
        fill?: Phaser.GameObjects.Image;
      }
    >();
    private emitted = 0;
    private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    constructor() {
      super('Gameplay');
    }
    create() {
      // Bridge the Phaser-owned scene to the host command interface.
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      active = this;
      this.actorSprites.clear();
      this.nodeSprites.clear();
      this.emitted = -1;
      this.hover = null;
      this.add.image(0, 0, 'background').setOrigin(0).setDepth(-1);
      for (const node of level.nodes) {
        const x = (node.x + node.width / 2) * tile,
          y = (node.y + node.height) * tile;
        const sprite = this.add
          .sprite(x, y, node.texture)
          .setOrigin(0.5, 1)
          .setDepth(y);
        const stock = (node.stockVisual?.slots ?? []).map((p) =>
          this.add
            .image(x + p.x * tile, y + p.y * tile, node.stockVisual!.texture)
            .setScale(node.stockVisual!.scale ?? 1)
            .setOrigin(0.5, 1)
            .setDepth(y + 0.1),
        );
        const fill = node.fillTexture
          ? this.add
              .image(
                x + node.fillOffset!.x,
                y + node.fillOffset!.y,
                node.fillTexture,
              )
              .setOrigin(0.5, 1)
              .setDepth(y + 0.05)
          : undefined;
        this.nodeSprites.set(node.id, { sprite, stock, fill });
      }
      for (const actor of level.actors) {
        const sprite = this.add.sprite(0, 0, actor.texture).setOrigin(0.5, 1);
        const shadow = this.add.ellipse(
          0,
          0,
          actor.kind === 'vehicle' ? 38 : 11,
          actor.kind === 'vehicle' ? 8 : 3,
          0x45553e,
          0.28,
        );
        const cargo = Array.from(
          {
            length:
              actor.kind === 'vehicle' ? Math.ceil(actor.capacity / 4) : 1,
          },
          () =>
            this.add
              .image(0, 0, actor.cargoTexture)
              .setScale(actor.kind === 'vehicle' ? 0.5 : 0.65)
              .setOrigin(0.5, 1),
        );
        this.actorSprites.set(actor.id, {
          sprite,
          shadow,
          cargo,
          lastX: actor.x,
        });
      }
      this.graphics = this.add.graphics().setDepth(100000);
      this.cameras.main
        .setBounds(0, 0, level.width * tile, level.height * tile)
        .setRoundPixels(true);
      this.pointer = new PointerInputService(
        this,
        level,
        (x, y) => this.hit(x, y),
        (id) => this.click(id),
        (id) => {
          this.hover = id;
        },
      );
      this.pointer.reset();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.pointer.destroy();
        active = undefined;
      });
      this.render();
      this.emit();
    }
    private hit(x: number, y: number): string | null {
      for (const actor of [...model.state.actors].sort((a, b) => b.y - a.y)) {
        const sprite = this.actorSprites.get(actor.id)!.sprite;
        if (
          Phaser.Geom.Rectangle.Contains(
            new Phaser.Geom.Rectangle(
              sprite.x - sprite.width / 2,
              sprite.y - sprite.height,
              sprite.width,
              sprite.height,
            ),
            x,
            y,
          )
        )
          return actor.id;
      }
      for (const node of [...level.nodes].sort((a, b) => b.y - a.y))
        if (
          Phaser.Geom.Rectangle.Contains(
            new Phaser.Geom.Rectangle(
              node.x * tile,
              node.y * tile,
              node.width * tile,
              node.height * tile,
            ),
            x,
            y,
          )
        )
          return node.id;
      return null;
    }
    private click(id: string | null) {
      if (model.state.completed) return;
      if (id === null || model.state.actors.some((a) => a.id === id)) {
        model.select(id);
        return;
      }
      const node = model.definition(id);
      let ok = false;
      if (node.kind === 'source') ok = model.gather(id);
      else if (node.kind === 'depot') ok = model.transport('load', id);
      else if (node.kind === 'processor') {
        const selected = model.state.actors.find(
          (a) => a.id === model.selected,
        );
        if (
          selected &&
          model.actorDefinition(selected.id).kind === 'vehicle' &&
          (Object.values(selected.cargo).some(Boolean) ||
            selected.current?.kind === 'load' ||
            selected.queue.some((j) => j.kind === 'load'))
        )
          ok = model.transport('deliver', id);
        else {
          model.toggleProcessor(id);
          ok = true;
        }
      }
      options.audio.play(ok ? 'activate' : 'hit');
      persist();
    }
    command(command: SimulationCommand) {
      if (command.type === 'select') model.select(command.id);
      else if (command.type === 'cancel') {
        model.cancelSelected();
        persist();
      } else this.pointer.zoom(command.direction);
      this.emit();
    }
    private drawActor(actor: ActorState) {
      const def = model.actorDefinition(actor.id),
        view = this.actorSprites.get(actor.id)!,
        x = (actor.x + 0.5) * tile,
        y = (actor.y + 0.5) * tile;
      const moving = !!actor.current?.path.length;
      if (Math.abs(actor.x - view.lastX) > 0.001)
        view.sprite.setFlipX(actor.x < view.lastX);
      view.lastX = actor.x;
      const frame =
        def.kind === 'vehicle'
          ? moving && !this.reduced
            ? Math.floor(model.state.seconds * 6) % 2
            : 0
          : moving
            ? this.reduced
              ? 1
              : 1 + (Math.floor(model.state.seconds * 7) % 2)
            : actor.current?.phase === 'work'
              ? this.reduced || Math.floor(model.state.seconds * 3) % 2 === 0
                ? 3
                : 0
              : 0;
      view.sprite.setPosition(x, y).setDepth(y).setFrame(frame);
      view.shadow.setPosition(x, y - 1).setDepth(y - 0.1);
      const total = Object.values(actor.cargo).reduce((sum, n) => sum + n, 0),
        count =
          def.kind === 'vehicle' ? Math.ceil(total / 4) : Number(total > 0);
      view.cargo.forEach((image, i) => {
        image.setVisible(i < count);
        const sign = view.sprite.flipX ? -1 : 1;
        image
          .setPosition(
            x + (def.kind === 'vehicle' ? (-17 + (i % 2) * 6) * sign : 5),
            y - (def.kind === 'vehicle' ? 11 + Math.floor(i / 2) * 5 : 3),
          )
          .setDepth(y + 0.2 + i * 0.001);
      });
      if (model.selected === actor.id) {
        this.graphics
          .lineStyle(1 / this.cameras.main.zoom, 0xf8e3aa, 1)
          .strokeEllipse(
            x,
            y - 1,
            def.kind === 'vehicle' ? 42 : 18,
            def.kind === 'vehicle' ? 15 : 8,
          );
        if (actor.current?.path.length) {
          this.graphics
            .lineStyle(1 / this.cameras.main.zoom, 0xf1d79a, 0.6)
            .beginPath()
            .moveTo(x, y);
          actor.current.path.forEach((p) =>
            this.graphics.lineTo((p.x + 0.5) * tile, (p.y + 0.5) * tile),
          );
          this.graphics.strokePath();
        }
      }
      if (actor.current && !moving) {
        const target = model.definition(actor.current.target),
          duration =
            actor.current.kind === 'gather'
              ? (target.harvestSeconds ?? 1)
              : def.loadSeconds;
        const ratio = Math.min(1, actor.current.progress / duration);
        this.graphics
          .lineStyle(2, actor.blocked ? 0xd58a79 : 0xf2dfaa, 0.9)
          .beginPath()
          .arc(
            x,
            y - view.sprite.height - 4,
            3,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * ratio,
            false,
          )
          .strokePath();
      }
      if (actor.blocked)
        this.graphics
          .lineStyle(2, 0xce7969)
          .strokeCircle(x, y - view.sprite.height - 4, 3);
    }
    private drawNodeState(node: SimulationNode) {
      const state = model.node(node.id),
        view = this.nodeSprites.get(node.id)!,
        total = Object.values(state.stock).reduce((sum, n) => sum + n, 0);
      if (node.stockVisual) {
        const count = Math.ceil(total / node.stockVisual.unitSize),
          initial = Math.ceil(
            Object.values(node.stock).reduce((sum, n) => sum + n, 0) /
              node.stockVisual.unitSize,
          );
        view.stock.forEach((image, i) =>
          image.setVisible(
            node.kind === 'source'
              ? i >= initial - count && i < initial
              : i < count,
          ),
        );
      }
      if (view.fill) {
        const texture = view.fill.frame,
          height = Math.floor(
            texture.height * Math.min(1, total / node.capacity!),
          );
        view.fill
          .setCrop(0, texture.height - height, texture.width, height)
          .setVisible(height > 0);
      }
      if (node.kind === 'processor') {
        const working =
          state.enabled &&
          (state.stock[node.recipe!.input] ?? 0) >= node.recipe!.inputAmount;
        view.sprite.setFrame(
          working && !this.reduced
            ? Math.floor(model.state.seconds * 4) % 2
            : 0,
        );
        const x = (node.x + node.width / 2) * tile,
          y = node.y * tile + 44;
        this.graphics
          .fillStyle(state.enabled ? 0xf2d69c : 0x627c69, 1)
          .fillCircle(x + 35, y, 2);
      }
      const assigned = model.state.actors.some(
        (a) =>
          (a.current?.target === node.id && !a.current.cancelled) ||
          a.queue.some((j) => j.target === node.id),
      );
      if (this.hover === node.id || assigned)
        this.graphics
          .lineStyle(
            1 / this.cameras.main.zoom,
            this.hover === node.id ? 0xf8e6b7 : 0x92bfc0,
            0.8,
          )
          .strokeRect(
            node.x * tile - 1,
            node.y * tile - 2,
            node.width * tile + 2,
            node.height * tile + 3,
          );
    }
    private render() {
      this.graphics.clear();
      model.state.actors.forEach((actor) => this.drawActor(actor));
      level.nodes.forEach((node) => this.drawNodeState(node));
    }
    private emit() {
      const camera = this.cameras.main;
      options.state({
        mode: 'simulation',
        completed: model.state.completed,
        paused: false,
        elapsed: Math.floor(model.state.seconds),
        collected: model.harvested,
        total: model.total,
        produced: model.produced,
        goal: level.goal.amount,
        selectedId: model.selected,
        levelName: level.title,
        actors: model.state.actors.map((a) => ({
          ...JSON.parse(JSON.stringify(a)),
          kind: model.actorDefinition(a.id).kind,
          texture: model.actorDefinition(a.id).texture,
          status: model.status(a),
        })),
        nodes: model.state.nodes.map((n) => ({ ...n, stock: { ...n.stock } })),
        camera: {
          scrollX: camera.scrollX,
          scrollY: camera.scrollY,
          zoom: camera.zoom,
          width: camera.width,
          height: camera.height,
        },
      });
    }
    update(_time: number, delta: number) {
      try {
        const wasComplete = model.state.completed,
          revision = model.revision;
        model.step(Math.min(delta, 250) / 1000);
        if (model.revision !== revision && !wasComplete)
          options.audio.play(model.state.completed ? 'complete' : 'collect');
        if (model.state.completed && !wasComplete) persist();
        else if (
          model.state.seconds - lastSaved >= 5 ||
          (model.dirty && model.state.seconds - lastSaved >= 1)
        )
          persist();
        this.render();
        this.emitted += delta;
        if (this.emitted >= 100) {
          this.emitted = 0;
          this.emit();
        }
      } catch (error) {
        this.scene.pause();
        options.error(
          error instanceof Error ? error.message : 'Błąd symulacji',
        );
      }
    }
  }
  return {
    definition,
    scenes: [
      ...createFlowScenes(definition, options.ready, options.error),
      Gameplay,
    ],
    start(resume) {
      started = true;
      model.reset();
      if (resume) save.read();
      lastSaved = model.state.seconds;
      if (!resume) persist();
    },
    persist,
    command(command) {
      active?.command(command);
    },
  };
}
