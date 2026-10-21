import { Vector3 } from "@babylonjs/core";

export class Dash {
  static readonly cooldown = 3.5;
  static readonly duration = 0.16;
  static readonly speed = 21;
  remaining = 0;
  cooldown = 0;
  direction = Vector3.Forward();
  start(direction: Vector3): boolean {
    if (this.cooldown > 0 || this.remaining > 0) return false;
    this.direction.copyFrom(direction);
    this.direction.y = 0;
    if (this.direction.lengthSquared() < 0.001) return false;
    this.direction.normalize();
    this.remaining = Dash.duration;
    this.cooldown = Dash.cooldown;
    return true;
  }
  update(dt: number): number {
    const active = Math.min(dt, this.remaining);
    this.remaining = Math.max(0, this.remaining - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    return active;
  }
  reset(): void {
    this.remaining = this.cooldown = 0;
  }
}
