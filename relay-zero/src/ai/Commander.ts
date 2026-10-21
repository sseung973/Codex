import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import { Enemy, enemyConfig } from "./Enemy";
import type { Difficulty } from "../core/Difficulty";
import type { DamageInfo } from "../combat/Damage";
import type { Level } from "../world/Level";
import type { Navigation } from "./Navigation";
import type { Player } from "../player/Player";

/** One final-wave commander. The indicated position locks at windup, so dodging matters. */
export class Commander extends Enemy {
  readonly warning: Mesh;
  readonly weakpoint: Mesh;
  windupRemaining = 0;
  weakWindow = 0;
  readonly warningDuration = 1.15;
  readonly warningRadius = 2.45;
  onPulse: (point: Vector3) => void = () => {};
  private target = Vector3.Zero();
  private warningMaterial: StandardMaterial;
  constructor(scene: Scene, level: Level, nav: Navigation,
    difficulty: Difficulty, pos: Vector3, id: string) {
    const config = enemyConfig(5, true, difficulty, "assault");
    config.health = Math.round(300 * difficulty.health);
    config.moveSpeed *= .78;
    config.damage = 12 * difficulty.damage;
    config.range = 22;
    config.burstCount = 1;
    config.burstPause = 3.3;
    config.reactionTime = Math.max(.45, config.reactionTime);
    super(scene, level, nav, config, pos, id, true, "assault");
    this.mat.diffuseColor = Color3.FromHexString("#435c70");
    const armor = new StandardMaterial("commander plates", scene);
    armor.diffuseColor = Color3.FromHexString("#28343f");
    armor.specularColor.set(.13, .16, .18);
    const core = new StandardMaterial("commander exposed core", scene);
    core.emissiveColor = Color3.FromHexString("#edac58");
    core.disableLighting = true;
    const plate = (name: string, p: Vector3, size: Vector3, material = armor,
      weakpoint = false): Mesh => {
      const mesh = MeshBuilder.CreateBox(name,
        { width: size.x, height: size.y, depth: size.z }, scene);
      mesh.parent = this.root;
      mesh.position.copyFrom(p);
      mesh.material = material;
      mesh.metadata = { entity: this, head: weakpoint, weakpoint };
      this.parts.push(mesh);
      return mesh;
    };
    for (const side of [-1, 1]) {
      plate("command shoulder fin", new Vector3(side * .57, 1.49, 0),
        new Vector3(.33, .43, .47));
      plate("command helmet wing", new Vector3(side * .32, 1.92, -.06),
        new Vector3(.2, .13, .45));
    }
    plate("command core socket", new Vector3(0, 1.27, .347),
      new Vector3(.48, .42, .09));
    this.weakpoint = plate("command weakpoint", new Vector3(0, 1.27, .408),
      new Vector3(.3, .27, .07), core, true);
    this.weakpoint.setEnabled(false);
    this.warningMaterial = new StandardMaterial("commander warning", scene);
    this.warningMaterial.emissiveColor = Color3.FromHexString("#e56561");
    this.warningMaterial.disableLighting = true;
    this.warning = MeshBuilder.CreateTorus("commander warning ring",
      { diameter: this.warningRadius * 2, thickness: .075, tessellation: 40 }, scene);
    this.warning.material = this.warningMaterial;
    this.warning.position.y = .07;
    this.warning.isPickable = false;
    this.warning.checkCollisions = false;
    this.warning.setEnabled(false);
  }
  beginPulse(point: Vector3): void {
    if (this.health <= 0 || this.windupRemaining > 0) return;
    this.target.copyFrom(point);
    this.windupRemaining = this.warningDuration;
    this.warning.position.copyFrom(this.target).y += .07;
    this.warning.scaling.setAll(.72);
    this.warning.setEnabled(true);
  }
  override receiveDamage(info: DamageInfo): boolean {
    const exposed = info.weakpoint === true && this.weakWindow > 0;
    const defeated = super.receiveDamage({ ...info,
      damage: info.damage * (exposed ? 1.55 : .68) });
    if (defeated) {
      this.windupRemaining = this.weakWindow = 0;
      this.warning.setEnabled(false);
      this.weakpoint.setEnabled(false);
    }
    return defeated;
  }
  override update(dt: number, player: Player, others: Enemy[]): void {
    super.update(dt, player, others);
    if (this.health <= 0) {
      this.windupRemaining = this.weakWindow = 0;
      this.warning.setEnabled(false);
      this.weakpoint.setEnabled(false);
      return;
    }
    if (this.windupRemaining > 0) {
      this.windupRemaining = Math.max(0, this.windupRemaining - dt);
      const t = 1 - this.windupRemaining / this.warningDuration;
      this.warning.scaling.setAll(.72 + t * .28);
      if (this.windupRemaining === 0) {
        this.warning.setEnabled(false);
        this.weakWindow = 2.1;
        this.weakpoint.setEnabled(true);
        this.onPulse(this.target.clone());
      }
    } else if (this.weakWindow > 0) {
      this.weakWindow = Math.max(0, this.weakWindow - dt);
      if (this.weakWindow === 0) this.weakpoint.setEnabled(false);
    }
  }
  override dispose(): void {
    this.warning.dispose();
    this.warningMaterial.dispose();
    super.dispose();
  }
}
