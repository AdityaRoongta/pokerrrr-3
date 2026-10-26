import { REACTIONS } from './reactions.mjs';
// Small procedural effects: no downloaded samples or external requests.
export type PokerSound = 'shuffle' | 'deal' | 'board' | 'win' | 'check' | 'call' | 'raise' | 'allin' | 'fold' | 'chappal';
export class PokerAudio {
  private context: AudioContext | null = null;
  private nodes = new Set<AudioScheduledSourceNode>();
  enabled = true;
  private generation = 0;
  unlock() {
    if (!this.enabled) return;
    try {
      const C = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return;
      this.context ??= new C();
      if (this.context?.state === 'suspended') void this.context.resume().catch(() => { });
    } catch {/* Audio is optional on browsers without Web Audio. */ }
  }
  setEnabled(value: boolean) {
    this.enabled = value;
    if (!value) this.cancel();
  }
  cancel() {
    this.generation++;
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch { }
    }
    this.nodes.clear();
  }
  private source(node: AudioScheduledSourceNode) {
    this.nodes.add(node);
    node.onended = () => this.nodes.delete(node);
  }
  play(kind: PokerSound, delayMs = 0) {
    const ctx = this.context;
    if (!this.enabled || !ctx || document.hidden) return;
    if (ctx.state === 'suspended') {
      const generation = this.generation,
        target = performance.now() + delayMs;
      void ctx.resume().then(() => {
        if (this.generation === generation) this.play(kind, Math.max(0, target - performance.now()));
      }).catch(() => { });
      return;
    }
    if (ctx.state !== 'running') return;
    const at = ctx.currentTime + Math.max(0, delayMs) / 1000;
    const noise = (time: number, duration: number, frequency: number, volume: number) => {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate),
        data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter(),
        gain = ctx.createGain();
      src.buffer = buffer;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(frequency, time);
      filter.Q.value = .7;
      gain.gain.setValueAtTime(.001, time);
      gain.gain.linearRampToValueAtTime(volume, time + .006);
      gain.gain.exponentialRampToValueAtTime(.001, time + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      this.source(src);
      src.start(time);
      src.stop(time + duration);
    };
    const tone = (time: number, frequency: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, time);
      osc.frequency.exponentialRampToValueAtTime(frequency * .78, time + duration);
      gain.gain.setValueAtTime(.001, time);
      gain.gain.linearRampToValueAtTime(volume, time + .004);
      gain.gain.exponentialRampToValueAtTime(.001, time + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      this.source(osc);
      osc.start(time);
      osc.stop(time + duration);
    };
    if (kind === 'chappal') {
      const impact = ctx.currentTime + Math.max(0, delayMs + REACTIONS.chappal.impactAt) / 1000;
      if (delayMs >= 0) noise(at, .10, 1400, .045);
      // A dry broadband crack, a very short low thud and a tiny second skin
      // contact. No musical pitch or long tail: all three land with the flick.
      noise(impact, .048, 2600, .48);
      noise(impact + .006, .075, 650, .22);
      tone(impact, 115, .055, .19);
      noise(impact + .014, .028, 3600, .13);
    } else if (kind === 'shuffle') {
      for (let i = 0; i < 9; i++) noise(at + i * .042, .055, 1100 + i * 120, .1);
    } else if (kind === 'deal') {
      noise(at, .075, 1900, .07);
      tone(at + .055, 380, .035, .025);
    } else if (kind === 'board') {
      noise(at, .11, 2400, .1);
      tone(at + .06, 620, .065, .035);
    } else if (kind === 'fold') {
      noise(at, .13, 750, .075);
    } else if (kind === 'check') {
      tone(at, 400, .045, .035);
      tone(at + .085, 400, .04, .025);
    } else if (kind === 'call') {
      tone(at, 750, .085, .045);
      noise(at + .02, .055, 2700, .025);
    } else if (kind === 'raise') {
      [660, 880, 1100].forEach((f, i) => tone(at + i * .055, f, .09, .035));
    } else if (kind === 'allin') {
      [440, 660, 880, 1320].forEach((f, i) => {
        tone(at + i * .07, f, .14, .045);
        noise(at + i * .07, .05, 2500, .025);
      });
    } else {
      for (let i = 0; i < 6; i++) {
        tone(at + i * .07, 1100 + i % 3 * 280, .11, .035);
        noise(at + i * .07, .045, 3300, .025);
      }
    }
  }
}
