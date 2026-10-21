export type Quality = "low" | "medium" | "high";

/** Uses real frame intervals; simulation's clamped delta must never hide a slow frame. */
export class PerformanceBudget {
  quality: Quality = "medium";
  private elapsed = 0;
  private frames = 0;
  private total = 0;
  private healthy = 0;
  private requested: Quality = "medium";
  private automatic = true;
  configure(quality: Quality, automatic: boolean): void {
    this.requested = quality;
    this.automatic = automatic;
    this.quality = quality;
    this.resetWindow();
    this.healthy = 0;
  }
  resetWindow(): void {
    this.elapsed = this.frames = this.total = 0;
  }
  sample(milliseconds: number): boolean {
    if (!this.automatic || milliseconds <= 0 || milliseconds > 2000)
      return false;
    milliseconds = Math.min(milliseconds, 250);
    this.elapsed += milliseconds;
    this.total += milliseconds;
    this.frames++;
    if (this.elapsed < 2000 || this.frames < 8) return false;
    const average = this.total / this.frames;
    this.resetWindow();
    if (average > 23) {
      this.healthy = 0;
      if (this.quality !== "low") {
        this.quality = this.quality === "high" ? "medium" : "low";
        return true;
      }
    } else if (average < 18) {
      if (++this.healthy < 5) return false;
      this.healthy = 0;
      if (this.quality !== this.requested) {
        this.quality = this.quality === "low" ? "medium" : this.requested;
        return true;
      }
    } else this.healthy = 0;
    return false;
  }
  scaling(_width: number, _height: number, devicePixelRatio = 1): number {
    // Never stretch a 540p/720p buffer over a full-size viewport. Automatic
    // adaptation changes effects only; retain sharp pixels even under load.
    const ratio = Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
    return 1 / Math.min(1.5, Math.max(1, ratio));
  }
}
