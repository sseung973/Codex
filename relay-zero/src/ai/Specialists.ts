import {
  Color3,
  LinesMesh,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  VertexBuffer,
} from "@babylonjs/core";
import { Enemy } from "./Enemy";
import type { Player } from "../player/Player";

/** The aim point is fixed when the laser appears; lateral movement dodges the shot. */
export class Sniper extends Enemy {
  aimPoint = Vector3.Zero();
  private laser?: LinesMesh;
  private laserPositions = new Float32Array(6);
  lockAim(point: Vector3): void {
    this.aimPoint.copyFrom(point);
  }
  override update(dt: number, player: Player, others: Enemy[]): void {
    super.update(dt, player, others);
    const aiming =
      this.health > 0 && this.stunRemaining <= 0 && this.attackCue > 0;
    if (aiming) {
      if (!this.laser) {
        this.laser = MeshBuilder.CreateLines(
          "sniper targeting laser",
          { points: [this.eye, this.aimPoint], updatable: true },
          this.scene,
        );
        this.laser.color = Color3.FromHexString("#e56561");
        this.laser.isPickable = false;
      } else {
        const eye = this.eye,
          point = this.aimPoint,
          positions = this.laserPositions;
        positions[0] = eye.x;
        positions[1] = eye.y;
        positions[2] = eye.z;
        positions[3] = point.x;
        positions[4] = point.y;
        positions[5] = point.z;
        this.laser.updateVerticesData(
          VertexBuffer.PositionKind,
          positions,
          true,
          false,
        );
      }
    }
    this.laser?.setEnabled(aiming);
  }
  override dispose(): void {
    this.laser?.dispose();
    super.dispose();
  }
}

export class Bomber extends Enemy {
  static readonly radius = 4.2;
  private ring?: Mesh;
  private ringMaterial?: StandardMaterial;
  override update(dt: number, player: Player, others: Enemy[]): void {
    super.update(dt, player, others);
    const armed =
      this.health > 0 && this.stunRemaining <= 0 && this.attackCue > 0;
    if (armed && !this.ring) {
      this.ringMaterial = new StandardMaterial("bomber warning", this.scene);
      this.ringMaterial.emissiveColor = Color3.FromHexString("#e56561");
      this.ringMaterial.disableLighting = true;
      this.ring = MeshBuilder.CreateTorus(
        "bomber blast radius",
        { diameter: Bomber.radius * 2, thickness: 0.07, tessellation: 32 },
        this.scene,
      );
      this.ring.material = this.ringMaterial;
      this.ring.isPickable = false;
    }
    if (this.ring) {
      this.ring.position.copyFrom(this.position).y += 0.06;
      this.ring.setEnabled(armed);
    }
  }
  override dispose(): void {
    this.ring?.dispose();
    this.ringMaterial?.dispose();
    super.dispose();
  }
}
