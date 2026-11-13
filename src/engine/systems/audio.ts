// Krótkie, własne dźwięki syntezowane lokalnie; brak sieci i zewnętrznych sampli.
export class Audio {
  private context?: AudioContext;
  muted = false;
  unlock() {
    this.context ??= new AudioContext();
    void this.context.resume().catch(() => {});
  }
  play(kind: 'jump' | 'activate' | 'complete' | 'collect' | 'hit') {
    if (!this.context || this.muted || this.context.state !== 'running') return;
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    const time = context.currentTime;
    oscillator.frequency.setValueAtTime(
      kind === 'hit'
        ? 130
        : kind === 'jump'
          ? 240
          : kind === 'collect'
            ? 880
            : 520,
      time,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      kind === 'hit' ? 65 : kind === 'complete' ? 1040 : 720,
      time + 0.12,
    );
    gain.gain.setValueAtTime(0.045, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(time + 0.21);
  }
  destroy() {
    void this.context?.close();
  }
}
