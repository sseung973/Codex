import { Scene, TransformNode } from "@babylonjs/core";
import { damp } from "../core/Settings";
export interface MotionFrame {
  ads: number;
  sprint: boolean;
  grounded: boolean;
  moving: boolean;
  dx: number;
  dy: number;
  strafe: number;
  reload: number;
  wall: number;
  swing: number;
  sniper: boolean;
}
/** Visual transforms only. Does not write camera angles, accuracy or weapon state. */
export class WeaponMotion {
  readonly pose: TransformNode;
  readonly sway: TransformNode;
  readonly bob: TransformNode;
  readonly recoil: TransformNode;
  private kick = 0;
  private side = 0;
  private hold = 0;
  private sprint = 0;
  private phase = 0;
  private bobWeight = 0;
  private landing = 0;
  private grounded = true;
  constructor(scene: Scene, parent: TransformNode) {
    this.pose = new TransformNode("weapon pose", scene);
    this.pose.parent = parent;
    this.sway = new TransformNode("weapon sway", scene);
    this.sway.parent = this.pose;
    this.bob = new TransformNode("weapon bob", scene);
    this.bob.parent = this.sway;
    this.recoil = new TransformNode("weapon visual recoil", scene);
    this.recoil.parent = this.bob;
  }
  shot(strength: number, shot: number, ads: number): void {
    this.kick = Math.min(
      0.095,
      this.kick + Math.max(0.025, strength) * (1 - 0.3 * ads),
    );
    this.side = Math.sin(shot * 2.4) * 0.008 * (1 - 0.6 * ads);
    this.hold = 0.022;
    this.applyKick();
  }
  private applyKick(): void {
    this.recoil.position.set(this.side * 0.15, this.kick * 0.08, -this.kick);
    this.recoil.rotation.set(-this.kick * 0.85, this.side, this.side * 0.6);
  }
  update(dt: number, f: MotionFrame): void {
    const recovery = Math.max(0, dt - this.hold);
    this.hold = Math.max(0, this.hold - dt);
    this.kick = damp(this.kick, 0, 22, recovery);
    this.side = damp(this.side, 0, 22, recovery);
    this.applyKick();
    this.sprint = damp(this.sprint, f.sprint ? 1 : 0, 13, dt);
    if (f.grounded && !this.grounded) this.landing = 0.016;
    this.grounded = f.grounded;
    this.landing = damp(this.landing, 0, 15, dt);
    this.phase += dt * (f.sprint ? 15 : 10);
    this.bobWeight = damp(
      this.bobWeight,
      f.moving && f.grounded ? 1 : 0,
      16,
      dt,
    );
    const weight = this.bobWeight * (1 - 0.96 * f.ads),
      amplitude = 0.0035 + 0.002 * this.sprint;
    this.bob.position.set(
      Math.sin(this.phase) * amplitude * weight,
      Math.sin(this.phase * 2) * amplitude * 0.65 * weight - this.landing,
      0,
    );
    this.bob.rotation.z = Math.sin(this.phase) * 0.005 * weight;
    const suppression = 1 - 0.94 * f.ads;
    this.sway.position.x = damp(
      this.sway.position.x,
      Math.max(-0.018, Math.min(0.018, -f.dx * 0.00065)) * suppression,
      18,
      dt,
    );
    this.sway.position.y = damp(
      this.sway.position.y,
      Math.max(-0.012, Math.min(0.012, f.dy * 0.0005)) * suppression,
      18,
      dt,
    );
    this.sway.rotation.z = damp(
      this.sway.rotation.z,
      -f.strafe * 0.022 * suppression,
      12,
      dt,
    );
    this.sway.rotation.y = this.sway.position.x * 0.6;
    this.sway.rotation.x = -this.sway.position.y * 0.7;
    this.pose.position.set(
      0.29 * (1 - f.ads) - f.swing * 0.25,
      -0.29 +
        (f.sniper ? -0.13 : 0.03) * f.ads -
        f.wall * 0.28 -
        f.reload * 0.25 -
        this.sprint * 0.085,
      0.36 - f.wall * 0.12,
    );
    this.pose.rotation.set(
      -f.reload * 0.42 + f.swing * 0.75 - this.sprint * 0.08,
      -f.swing * 0.6 + this.sprint * 0.06,
      -f.reload * 0.28 + f.swing * 0.9 + this.sprint * 0.12,
    );
  }
  reset(): void {
    this.kick =
      this.side =
      this.hold =
      this.sprint =
      this.phase =
      this.bobWeight =
      this.landing =
        0;
    this.grounded = true;
    for (const node of [this.pose, this.sway, this.bob, this.recoil]) {
      node.position.setAll(0);
      node.rotation.setAll(0);
    }
    this.pose.position.set(0.29, -0.29, 0.36);
  }
}
