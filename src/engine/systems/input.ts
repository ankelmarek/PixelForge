export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'interact';
export class Input {
  private sources = new Map<Action, Set<string>>();
  private edges = new Set<Action>();
  set(action: Action, pressed: boolean, source = 'touch') {
    const active = this.sources.get(action) ?? new Set<string>();
    if (pressed) {
      if (!active.size) this.edges.add(action);
      active.add(source);
    } else active.delete(source);
    this.sources.set(action, active);
  }
  down(action: Action) {
    return !!this.sources.get(action)?.size;
  }
  consume(action: Action) {
    const pressed = this.edges.has(action);
    this.edges.delete(action);
    return pressed;
  }
  clear() {
    this.sources.clear();
    this.edges.clear();
  }
}
export const keyActions: Record<string, Action | undefined> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'jump',
  ShiftLeft: 'interact',
  ShiftRight: 'interact',
};
