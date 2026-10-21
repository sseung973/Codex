export const WAVE_COUNTS = [3, 5, 7, 9, 11];
/** Total enemy count stays fixed; only its arrival order changes. */
export function waveBatches(total: number, wave: number): number[] {
  if (wave <= 1 || total < 4) return [total];
  const first = Math.ceil(total * (wave === 2 ? 0.6 : 0.46));
  if (wave === 2) return [first, total - first];
  const second = Math.ceil((total - first) / 2);
  return [first, second, total - first - second].filter(n => n > 0);
}
export class Waves {
  index = 0;
  remaining = 0;
  intermission = 0;
  complete = false;
  objectiveDone = true;
  onWave: (index: number, count: number) => void = () => {};
  onReinforcement: (index: number, count: number, offset: number) => void = () => {};
  onClear: () => void = () => {};
  onVictory: () => void = () => {};
  counts: readonly number[] = WAVE_COUNTS;
  rest = 9;
  batches: number[] = [];
  spawned = 0;
  private nextBatch = 0;
  private reinforcementClock = 0;
  get pending(): number {
    return Math.max(0, (this.counts[this.index - 1] ?? 0) - this.spawned);
  }
  private killed = 0;
  get firstBatch(): number { return this.batches[0] ?? 0; }
  reset(counts: readonly number[] = WAVE_COUNTS, rest = 9): void {
    this.counts = [...counts];
    this.rest = rest;
    this.index = 0;
    this.remaining = 0;
    this.complete = false;
    this.objectiveDone = true;
    this.intermission = 3;
    this.batches = [];
    this.spawned = 0;
    this.killed = 0;
    this.nextBatch = 0;
    this.reinforcementClock = 0;
  }
  update(dt: number): void {
    if (this.complete) return;
    if (this.intermission > 0) {
      this.intermission -= dt;
      if (this.intermission <= 0) {
        this.index++;
        this.remaining = this.counts[this.index - 1];
        this.batches = waveBatches(this.remaining, this.index);
        this.spawned = this.firstBatch;
        this.killed = 0;
        this.nextBatch = 1;
        this.reinforcementClock = 7;
        this.onWave(this.index, this.remaining);
      }
      return;
    }
    if (this.nextBatch >= this.batches.length) return;
    this.reinforcementClock -= dt;
    const active = this.spawned - this.killed;
    const maximumActive = Math.max(4, Math.ceil(this.counts[this.index - 1] * .65));
    if (active + this.batches[this.nextBatch] > maximumActive) return;
    if (active > Math.max(1, Math.ceil(this.spawned * .4)) && this.reinforcementClock > 0) return;
    const count = this.batches[this.nextBatch++], offset = this.spawned;
    this.spawned += count;
    this.reinforcementClock = 7;
    this.onReinforcement(this.index, count, offset);
  }
  kill(): void {
    if (this.complete || this.remaining <= 0) return;
    this.remaining--;
    this.killed++;
    this.checkClear();
  }
  requireObjective(): void {
    this.objectiveDone = false;
  }
  finishObjective(): void {
    this.objectiveDone = true;
    this.checkClear();
  }
  private checkClear(): void {
    if (
      this.complete ||
      this.index === 0 ||
      this.remaining !== 0 ||
      !this.objectiveDone ||
      this.intermission > 0
    )
      return;
    if (this.index >= this.counts.length) {
      this.complete = true;
      this.onVictory();
    } else {
      this.intermission = this.rest;
      this.onClear();
    }
  }
}
