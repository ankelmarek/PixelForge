import { afterEach, describe, expect, it, vi } from 'vitest';
import { Audio } from '../../src/engine/systems/audio';
class Parameter {
  value = 1;
  setValueAtTime(v: number) {
    this.value = v;
  }
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class Gain {
  gain = new Parameter();
  connect() {}
  disconnect() {}
}
class Voice {
  frequency = new Parameter();
  type = 'triangle';
  onended?: () => void;
  connect() {}
  disconnect() {}
  start() {}
  stop(time?: number) {
    if (time === undefined) this.onended?.();
  }
}
class Context {
  static current: Context;
  state = 'running';
  currentTime = 0;
  sampleRate = 48000;
  buffers = 0;
  destination = {};
  gains: Gain[] = [];
  constructor() {
    Context.current = this;
  }
  createGain() {
    const gain = new Gain();
    this.gains.push(gain);
    return gain;
  }
  createOscillator() {
    return new Voice();
  }
  createBuffer(_channels: number, length: number) {
    this.buffers++;
    const data = new Float32Array(length);
    return { length, getChannelData: () => data };
  }
  createBufferSource() {
    return new Voice();
  }
  async resume() {
    this.state = 'running';
  }
  async suspend() {
    this.state = 'suspended';
  }
  async close() {
    this.state = 'closed';
  }
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('audio — limity i cykl życia', () => {
  it('szum ma wspólny limit głosów, najwyżej dwa bufory i respektuje mute/pauzę', () => {
    vi.stubGlobal('AudioContext', Context);
    const audio = new Audio();
    const cue = { color: 'brown' as const, duration: 0.5, volume: 0.01 };
    audio.noise(cue);
    expect(audio.activeVoices).toBe(0);
    audio.unlock();
    audio.noise(cue);
    audio.noise({ ...cue, color: 'white' });
    for (let i = 0; i < 20; i++) audio.noise(cue);
    expect(audio.activeVoices).toBe(2);
    expect(Context.current.buffers).toBe(2);
    expect(audio.decodedBytes).toBe(768000);
    audio.music();
    audio.muted = true;
    audio.noise(cue);
    expect(audio.activeVoices).toBe(0);
    audio.muted = false;
    audio.pause(true);
    audio.noise(cue);
    expect(audio.activeVoices).toBe(0);
    audio.pause(false);
    audio.noise(cue);
    expect(audio.activeVoices).toBe(1);
    expect(Context.current.buffers).toBe(2);
    expect(audio.noise({ ...cue, duration: Infinity })).toBe(false);
    audio.destroy();
    expect(audio.decodedBytes).toBe(0);
    expect(audio.activeVoices).toBe(0);
  });
  it('ogranicza głosy do 8 efektów + 2 otoczenia + 2 muzyki, wycisza i usuwa timer', () => {
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', Context);
    const audio = new Audio();
    audio.unlock();
    const cue = { frequency: 200, duration: 1, volume: 0.03 };
    for (let i = 0; i < 20; i++) audio.cue(cue);
    expect(audio.activeVoices).toBe(8);
    for (let i = 0; i < 10; i++) audio.cue(cue, 'ambience');
    expect(audio.activeVoices).toBe(10);
    audio.cue(cue, 'music');
    audio.cue(cue, 'music');
    expect(audio.activeVoices).toBe(12);
    audio.setMix('ambience', 0);
    expect(Context.current.gains[2].gain.value).toBe(0);
    audio.muted = true;
    expect(Context.current.gains[0].gain.value).toBe(0);
    audio.pause(true);
    expect(Context.current.state).toBe('suspended');
    audio.pause(false);
    expect(Context.current.state).toBe('running');
    audio.music({ notes: [60], beatSeconds: 0.3, volume: 0.01 });
    expect(vi.getTimerCount()).toBe(1);
    audio.destroy();
    expect(vi.getTimerCount()).toBe(0);
    expect(audio.activeVoices).toBe(0);
    expect(Context.current.state).toBe('closed');
  });
  it('nie uruchamia nieprawidłowego cue ani dźwięku przed gestem użytkownika', () => {
    const audio = new Audio();
    expect(audio.cue({ frequency: NaN, duration: 1, volume: 0.01 })).toBe(
      false,
    );
    audio.play('collect');
    expect(audio.activeVoices).toBe(0);
    expect(audio.setMix('effects', NaN)).toBe(false);
    expect(audio.cue({ frequency: 200, duration: 99, volume: 0.01 })).toBe(
      false,
    );
  });
});
