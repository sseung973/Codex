import type { Settings } from "../core/Settings";
export type Sound =
  | "swing"
  | "fire"
  | "reload"
  | "dry"
  | "hit"
  | "headshot"
  | "step"
  | "jump"
  | "land"
  | "enemy"
  | "alert"
  | "ui";
// Persistent oscillator voices and a looping noise buffer avoid per-shot audio-node churn.
export class Audio {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  voices: { osc: OscillatorNode; gain: GainNode }[] = [];
  noiseGain: GainNode | null = null;
  index = 0;
  constructor(public settings: Settings) {}
  async unlock(): Promise<void> {
    try {
      if (!this.context) {
        const c = (this.context = new AudioContext());
        this.master = c.createGain();
        this.master.connect(c.destination);
        for (let i = 0; i < 12; i++) {
          const osc = c.createOscillator(),
            gain = c.createGain();
          gain.gain.value = 0;
          osc.connect(gain);
          gain.connect(this.master);
          osc.start();
          this.voices.push({ osc, gain });
        }
        const b = c.createBuffer(1, c.sampleRate, c.sampleRate),
          data = b.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const n = c.createBufferSource();
        n.buffer = b;
        n.loop = true;
        const filter = c.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1600;
        this.noiseGain = c.createGain();
        this.noiseGain.gain.value = 0;
        n.connect(filter);
        filter.connect(this.noiseGain);
        this.noiseGain.connect(this.master);
        n.start();
      }
      await this.context.resume();
      this.apply();
    } catch {
      /* Gameplay remains available without audio. */
    }
  }
  apply(): void {
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        this.settings.masterVolume * this.settings.sfxVolume,
        this.context.currentTime,
        0.03,
      );
  }
  play(kind: Sound, volume = 1): void {
    const c = this.context;
    if (!c || c.state !== "running") return;
    const spec: Record<Sound, [number, number, number, OscillatorType]> = {
      swing: [240, 0.16, 0.07, "triangle"],
      fire: [110, 0.085, 0.2, "sawtooth"],
      reload: [360, 0.075, 0.09, "square"],
      dry: [1200, 0.025, 0.05, "square"],
      hit: [850, 0.055, 0.09, "sine"],
      headshot: [1550, 0.13, 0.11, "sine"],
      step: [65, 0.065, 0.09, "triangle"],
      jump: [160, 0.1, 0.04, "sine"],
      land: [48, 0.12, 0.13, "triangle"],
      enemy: [165, 0.065, 0.08, "sawtooth"],
      alert: [620, 0.18, 0.05, "sine"],
      ui: [660, 0.08, 0.06, "sine"],
    };
    const [freq, duration, amp, type] = spec[kind],
      v = this.voices[this.index++ % this.voices.length],
      t = c.currentTime;
    v.osc.type = type;
    v.osc.frequency.cancelScheduledValues(t);
    v.osc.frequency.setValueAtTime(freq, t);
    v.osc.frequency.exponentialRampToValueAtTime(freq * 0.45, t + duration);
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(amp * volume, t);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    if (kind === "fire" && this.noiseGain) {
      const g = this.noiseGain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(0.16 * volume, t);
      g.exponentialRampToValueAtTime(0.0001, t + 0.075);
    }
  }
}
