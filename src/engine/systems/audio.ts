export interface MusicDefinition {
  notes: number[];
  beatSeconds: number;
  volume: number;
}
export type AudioBus = 'music' | 'ambience' | 'effects';
export interface ToneCue {
  frequency: number;
  duration: number;
  volume: number;
  end?: number;
  type?: OscillatorType;
}
export interface NoiseCue {
  color: 'white' | 'brown';
  duration: number;
  volume: number;
}
// Own synthesized tones. Music notes and tempo belong to each game definition.
export class Audio {
  private context?: AudioContext;
  private master?: GainNode;
  private silent = false;
  private timer?: ReturnType<typeof setInterval>;
  private voices = new Set<AudioScheduledSourceNode>();
  private voiceBuses = new Map<AudioScheduledSourceNode, AudioBus>();
  private noiseBuffers = new Map<NoiseCue['color'], AudioBuffer>();
  private buses?: Record<AudioBus, GainNode>;
  private mix = { music: 1, ambience: 0.35, effects: 1 };
  get activeVoices() {
    return this.voices.size;
  }
  get decodedBytes() {
    return [...this.noiseBuffers.values()].reduce(
      (n, b) => n + b.length * 4,
      0,
    );
  }
  /** Two reusable mono buffers; noise shares every voice/mix/lifecycle limit. */
  noise(cue: NoiseCue, bus: AudioBus = 'ambience') {
    if (
      !(bus in this.mix) ||
      !['white', 'brown'].includes(cue.color) ||
      !Number.isFinite(cue.duration) ||
      cue.duration < 0.03 ||
      cue.duration > 2 ||
      !Number.isFinite(cue.volume) ||
      cue.volume < 0 ||
      cue.volume > 0.1
    )
      return false;
    const context = this.context;
    if (
      !context ||
      context.state !== 'running' ||
      this.silent ||
      this.mix[bus] === 0 ||
      cue.volume === 0 ||
      this.voices.size >= 12 ||
      [...this.voiceBuses.values()].filter((b) => b === bus).length >=
        (bus === 'effects' ? 8 : 2)
    )
      return true;
    let buffer = this.noiseBuffers.get(cue.color);
    if (!buffer) {
      buffer = context.createBuffer(
        1,
        Math.ceil(context.sampleRate * 2),
        context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      let seed = 0x71a9b3,
        previous = 0;
      for (let i = 0; i < data.length; i++) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        const white = ((seed >>> 0) / 0xffffffff) * 2 - 1;
        previous = (previous + 0.02 * white) / 1.02;
        data[i] = cue.color === 'white' ? white : previous * 3.5;
      }
      this.noiseBuffers.set(cue.color, buffer);
    }
    const voice = context.createBufferSource(),
      gain = context.createGain(),
      time = context.currentTime;
    voice.buffer = buffer;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(cue.volume, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + cue.duration);
    voice.connect(gain);
    gain.connect(this.buses![bus]);
    this.voices.add(voice);
    this.voiceBuses.set(voice, bus);
    voice.onended = () => {
      this.voices.delete(voice);
      this.voiceBuses.delete(voice);
      voice.disconnect();
      gain.disconnect();
    };
    voice.start();
    voice.stop(time + cue.duration);
    return true;
  }
  setMix(bus: AudioBus, volume: number) {
    if (!(bus in this.mix) || !Number.isFinite(volume)) return false;
    this.mix[bus] = Math.max(0, Math.min(1, volume));
    this.buses?.[bus].gain.setValueAtTime(
      this.mix[bus],
      this.context!.currentTime,
    );
    return true;
  }
  /** Bounded declarative synthesis; games own their cues and periodic ambience. */
  cue(cue: ToneCue, bus: AudioBus = 'effects') {
    if (
      !(bus in this.mix) ||
      ![
        cue.frequency,
        cue.end ?? cue.frequency,
        cue.duration,
        cue.volume,
      ].every(Number.isFinite) ||
      cue.frequency < 20 ||
      cue.frequency > 20000 ||
      (cue.end ?? cue.frequency) < 20 ||
      (cue.end ?? cue.frequency) > 20000 ||
      cue.duration < 0.03 ||
      cue.duration > 2 ||
      cue.volume < 0 ||
      cue.volume > 0.1 ||
      (cue.type !== undefined &&
        !['sine', 'triangle', 'sawtooth', 'square'].includes(cue.type))
    )
      return false;
    this.tone(
      cue.frequency,
      cue.duration,
      cue.volume,
      cue.end ?? cue.frequency,
      cue.type,
      bus,
    );
    return true;
  }
  get muted() {
    return this.silent;
  }
  set muted(value: boolean) {
    this.silent = value;
    this.master?.gain.setValueAtTime(value ? 0 : 1, this.context!.currentTime);
  }
  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.master.gain.value = this.silent ? 0 : 1;
      this.buses = Object.fromEntries(
        (['music', 'ambience', 'effects'] as const).map((bus) => {
          const gain = this.context!.createGain();
          gain.gain.value = this.mix[bus];
          gain.connect(this.master!);
          return [bus, gain];
        }),
      ) as Record<AudioBus, GainNode>;
    }
    void this.context.resume().catch(() => {});
  }
  private tone(
    frequency: number,
    duration: number,
    volume: number,
    end: number,
    type: OscillatorType = 'triangle',
    bus: AudioBus = 'effects',
  ) {
    if (
      !this.context ||
      !this.master ||
      this.context.state !== 'running' ||
      this.silent ||
      volume <= 0 ||
      this.voices.size >= 12 ||
      this.mix[bus] === 0 ||
      [...this.voiceBuses.values()].filter((b) => b === bus).length >=
        (bus === 'effects' ? 8 : 2)
    )
      return;
    const oscillator = this.context.createOscillator(),
      gain = this.context.createGain(),
      time = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(
      end,
      time + duration * 0.75,
    );
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(gain);
    gain.connect(this.buses![bus]);
    this.voices.add(oscillator);
    this.voiceBuses.set(oscillator, bus);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      this.voiceBuses.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start();
    oscillator.stop(time + duration + 0.02);
  }
  play(kind: 'jump' | 'activate' | 'complete' | 'collect' | 'hit') {
    const frequency =
      kind === 'hit'
        ? 130
        : kind === 'jump'
          ? 240
          : kind === 'collect'
            ? 880
            : 520;
    this.tone(
      frequency,
      0.2,
      0.045,
      kind === 'hit' ? 65 : kind === 'complete' ? 1040 : 720,
    );
  }
  music(config?: MusicDefinition) {
    if (this.timer) clearInterval(this.timer);
    this.voices.forEach((voice) => {
      try {
        voice.stop();
      } catch {
        /* Already stopped. */
      }
    });
    if (!config) return;
    let index = 0;
    this.timer = setInterval(() => {
      if (this.context?.state !== 'running') return;
      const note = config.notes[index++ % config.notes.length];
      if (note > 0) {
        const hz = 440 * 2 ** ((note - 69) / 12);
        this.tone(
          hz,
          config.beatSeconds * 0.85,
          config.volume,
          hz,
          'sine',
          'music',
        );
      }
    }, config.beatSeconds * 1000);
  }
  pause(paused: boolean) {
    if (!this.context) return;
    void (paused ? this.context.suspend() : this.context.resume()).catch(
      () => {},
    );
  }
  destroy() {
    if (this.timer) clearInterval(this.timer);
    this.voices.forEach((v) => {
      try {
        v.stop();
        v.disconnect();
      } catch {
        /* Already stopped. */
      }
    });
    this.voices.clear();
    this.voiceBuses.clear();
    this.noiseBuffers.clear();
    void this.context?.close();
  }
}
