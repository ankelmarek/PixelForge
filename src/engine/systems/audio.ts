export interface MusicDefinition {
  notes: number[];
  beatSeconds: number;
  volume: number;
}
// Own synthesized tones. Music notes and tempo belong to each game definition.
export class Audio {
  private context?: AudioContext;
  private master?: GainNode;
  private silent = false;
  private timer?: ReturnType<typeof setInterval>;
  private voices = new Set<OscillatorNode>();
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
    }
    void this.context.resume().catch(() => {});
  }
  private tone(
    frequency: number,
    duration: number,
    volume: number,
    end: number,
    type: OscillatorType = 'triangle',
  ) {
    if (!this.context || !this.master || this.context.state !== 'running')
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
    gain.connect(this.master);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
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
        this.tone(hz, config.beatSeconds * 0.85, config.volume, hz, 'sine');
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
    void this.context?.close();
  }
}
