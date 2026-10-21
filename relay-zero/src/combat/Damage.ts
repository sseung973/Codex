import { Vector3 } from "@babylonjs/core/Maths/math.vector";
export interface DamageInfo {
  damage: number;
  shield?: boolean;
  weakpoint?: boolean;
  source: string;
  target: string;
  hitPoint: Vector3;
  hitNormal: Vector3;
  isHeadshot: boolean;
  damageType: "hitscan" | "melee" | "explosion";
}
export interface IDamageable {
  id: string;
  health: number;
  maxHealth: number;
  receiveDamage(info: DamageInfo): boolean;
}
export class Health implements IDamageable {
  health: number;
  constructor(
    public id: string,
    public maxHealth: number,
  ) {
    this.health = maxHealth;
  }
  receiveDamage(info: DamageInfo): boolean {
    if (this.health <= 0) return false;
    this.health = Math.max(0, this.health - Math.max(0, info.damage));
    return this.health === 0;
  }
  reset(): void {
    this.health = this.maxHealth;
  }
}
