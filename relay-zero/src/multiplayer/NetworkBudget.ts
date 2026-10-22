import type { Vec } from "./Combat";
export interface Pose {
  p: Vec;
  y: number;
  pitch: number;
  crouch: boolean;
  revive: boolean;
}
/** Moving players retain the existing 15 Hz schedule; idle peers keep a one-second heartbeat. */
export class PoseBudget {
  private previous?: Pose;
  private sentAt = -Infinity;
  accept(pose: Pose, now: number): boolean {
    const p = this.previous;
    if (
      p &&
      now - this.sentAt < 1 &&
      p.y === pose.y &&
      p.pitch === pose.pitch &&
      p.crouch === pose.crouch &&
      p.revive === pose.revive &&
      p.p.every((value, i) => value === pose.p[i])
    )
      return false;
    this.previous = { ...pose, p: [...pose.p] };
    this.sentAt = now;
    return true;
  }
}
