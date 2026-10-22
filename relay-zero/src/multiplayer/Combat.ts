export type Vec = [number, number, number];
export function finiteVector(v: unknown): v is Vec {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every(
      (n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 150,
    )
  );
}
/** Slab ray intersection. Returns distance to entry; null for misses/behind the ray. */
export function rayBox(
  o: Vec,
  d: Vec,
  min: Vec,
  max: Vec,
  range: number,
): number | null {
  let lo = 0,
    hi = range;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < min[i] || o[i] > max[i]) return null;
    } else {
      let a = (min[i] - o[i]) / d[i],
        b = (max[i] - o[i]) / d[i];
      if (a > b) [a, b] = [b, a];
      lo = Math.max(lo, a);
      hi = Math.min(hi, b);
      if (hi < lo) return null;
    }
  }
  return lo;
}
export class ShotGate {
  private seq = -1;
  private time = -Infinity;
  accept(seq: number, now: number, rate: number): boolean {
    if (
      !Number.isSafeInteger(seq) ||
      seq <= this.seq ||
      now - this.time < 1 / rate - 0.025
    )
      return false;
    this.seq = seq;
    this.time = now;
    return true;
  }
}
