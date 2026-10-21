export type Quality = "low" | "medium" | "high";

/** Uses real frame intervals; simulation's clamped delta must never hide a slow frame. */
export class PerformanceBudget {
  quality: Quality = "medium";
  multiplier = 1;
  private elapsed = 0;
  private frames = 0;
  private total = 0;
  private healthy = 0;
  private requested: Quality = "medium";
  private automatic = true;
  configure(quality: Quality, automatic: boolean): void {
    this.requested = quality;
    this.automatic = automatic;
    this.quality = automatic && quality === "high" ? "medium" : quality;
    this.multiplier = 1;
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
        this.quality = "low";
        return true;
      }
      if (this.multiplier < 1.6) {
        this.multiplier = Math.min(1.6, this.multiplier + 0.15);
        return true;
      }
    } else if (average < 18) {
      if (++this.healthy < 5) return false;
      this.healthy = 0;
      if (this.multiplier > 1) {
        this.multiplier = Math.max(1, this.multiplier - 0.1);
        return true;
      }
      if (this.quality === "low" && this.requested !== "low") {
        this.quality = "medium";
        return true;
      }
    } else this.healthy = 0;
    return false;
  }
  scaling(width: number, height: number): number {
    const base =
      this.quality === "low" ? 1.6 : this.quality === "medium" ? 1.2 : 1;
    const pixels =
      this.quality === "low"
        ? 960 * 540
        : this.quality === "medium"
          ? 1280 * 720
          : 1920 * 1080;
    return (
      Math.max(base, Math.sqrt(Math.max(1, width * height) / pixels)) *
      this.multiplier
    );
  }
}
