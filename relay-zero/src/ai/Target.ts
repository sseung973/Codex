import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
} from "@babylonjs/core";
import { Health, DamageInfo } from "../combat/Damage";
import { Enemy, enemyConfig } from "./Enemy";
import type { Level } from "../world/Level";
import type { Navigation } from "./Navigation";
import type { Difficulty } from "../core/Difficulty";
import { softenActor } from "../visual/SoftMesh";
export class Target extends Health {
  meshes: Mesh[] = [];
  respawn = 0;
  private robot?: Enemy;
  constructor(
    scene: Scene,
    pos: Vector3,
    level?: Level,
    navigation?: Navigation,
    difficulty?: Difficulty,
  ) {
    super("training-target", 100);
    if (level && navigation) {
      const config = enemyConfig(1, false, difficulty, "assault");
      this.health = this.maxHealth = config.health;
      this.robot = new Enemy(
        scene,
        level,
        navigation,
        config,
        pos,
        "training-target",
      );
      this.meshes = this.robot.parts;
      for (const mesh of this.meshes)
        mesh.metadata = { ...mesh.metadata, entity: this };
      return;
    }
    const mat = new StandardMaterial("target orange", scene);
    mat.diffuseColor = Color3.FromHexString("#eaa66b");
    for (const [name, y, w, h] of [
      ["body", 1, 0.6, 1],
      ["head", 1.78, 0.36, 0.36],
    ] as const) {
      const m = MeshBuilder.CreateBox(
        "target " + name,
        { width: w, height: h, depth: 0.3 },
        scene,
      );
      m.position.copyFrom(pos).y += y;
      m.material = mat;
      m.metadata = { entity: this, head: name === "head" };
      this.meshes.push(m);
      softenActor(m, 0.045);
    }
  }
  receiveDamage(info: DamageInfo): boolean {
    const dead = super.receiveDamage(info);
    if (dead) {
      for (const m of this.meshes) m.setEnabled(false);
      this.respawn = 2.5;
    }
    return dead;
  }
  update(dt: number): void {
    if (this.respawn > 0) {
      this.respawn -= dt;
      if (this.respawn <= 0) {
        this.reset();
        for (const m of this.meshes) m.setEnabled(true);
      }
    }
  }
  dispose(): void {
    if (this.robot) {
      this.robot.dispose();
      return;
    }
    this.meshes[0]?.material?.dispose();
    for (const m of this.meshes) m.dispose();
  }
}
