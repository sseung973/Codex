/** One bounded pulse per hit; recent hits accumulate the actual HP loss. */
export class DamageFeedback {
  remaining = 0;
  amount = 0;
  angle = 0;
  private strength = 0;
  trigger(angle: number, damage: number): boolean {
    if (!Number.isFinite(damage) || damage <= 0) return false;
    this.amount = this.remaining > 0.5 ? this.amount + damage : damage;
    this.angle = Number.isFinite(angle)
      ? Math.atan2(Math.sin(angle), Math.cos(angle))
      : 0;
    this.strength = Math.min(0.8, 0.5 + damage / 100);
    this.remaining = 0.85;
    return true;
  }
  update(dt: number): void {
    if (Number.isFinite(dt))
      this.remaining = Math.max(0, this.remaining - Math.max(0, dt));
    if (this.remaining === 0) this.amount = 0;
  }
  get opacity(): number {
    return this.strength * Math.min(1, this.remaining / 0.6);
  }
  get labelOpacity(): number {
    return Math.min(1, this.remaining / 0.25);
  }
}
