import { pickWorld } from "../world/WorldQuery";
import {
  Color3,
  Mesh,
  MeshBuilder,
  Ray,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import type { Enemy } from "../ai/Enemy";
import type { Level } from "../world/Level";

export class Equipment {
  static readonly price = 100;
  static readonly capacity = 3;
  ammo = 2;
  cooldown = 0;
  private projectiles: { mesh: Mesh; velocity: Vector3; fuse: number }[] = [];
  private pulses: { mesh: Mesh; remaining: number; radius: number }[] = [];
  private nextPulse = 0;
  private empMaterial: StandardMaterial;
  private blastMaterial: StandardMaterial;
  onEMP: (count: number) => void = () => {};
  constructor(
    private scene: Scene,
    public level: Level,
  ) {
    this.empMaterial = new StandardMaterial("EMP ion field", scene);
    this.empMaterial.emissiveColor = Color3.FromHexString("#8fc3df");
    this.empMaterial.disableLighting = true;
    this.empMaterial.wireframe = true;
    this.blastMaterial = new StandardMaterial("combat blast", scene);
    this.blastMaterial.emissiveColor = Color3.FromHexString("#edac58");
    this.blastMaterial.disableLighting = true;
    this.blastMaterial.wireframe = true;
    for (let i = 0; i < 8; i++) {
      const mesh = MeshBuilder.CreateSphere(
        "tactical pulse",
        { diameter: 2, segments: 12 },
        scene,
      );
      mesh.isPickable = false;
      mesh.setEnabled(false);
      this.pulses.push({ mesh, remaining: 0, radius: 1 });
    }
  }
  throw(origin: Vector3, direction: Vector3): boolean {
    if (this.ammo <= 0 || this.cooldown > 0 || this.projectiles.length >= 3)
      return false;
    this.ammo--;
    this.cooldown = 0.6;
    const mesh = MeshBuilder.CreateSphere(
      "EMP grenade",
      { diameter: 0.18, segments: 8 },
      this.scene,
    );
    mesh.material = this.empMaterial;
    mesh.isPickable = false;
    mesh.position.copyFrom(origin);
    this.projectiles.push({
      mesh,
      velocity: direction
        .normalizeToNew()
        .scale(15)
        .add(new Vector3(0, 3, 0)),
      fuse: 1.1,
    });
    return true;
  }
  buy(wallet: { coins: number }): boolean {
    if (this.ammo >= Equipment.capacity || wallet.coins < Equipment.price)
      return false;
    wallet.coins -= Equipment.price;
    this.ammo++;
    return true;
  }
  pulse(point: Vector3, radius: number, emp = false): void {
    const p = this.pulses[this.nextPulse++ % this.pulses.length];
    p.mesh.position.copyFrom(point);
    p.mesh.material = emp ? this.empMaterial : this.blastMaterial;
    p.radius = radius;
    p.remaining = 0.45;
    p.mesh.scaling.setAll(0.1);
    p.mesh.visibility = 1;
    p.mesh.setEnabled(true);
  }
  detonate(point: Vector3, enemies: readonly Enemy[]): number {
    let count = 0;
    for (const enemy of enemies) {
      if (
        enemy.health > 0 &&
        Vector3.DistanceSquared(point, enemy.eye) <= 36 &&
        this.level.lineClear(point, enemy.eye)
      ) {
        enemy.stun(3);
        count++;
      }
    }
    this.pulse(point, 6, true);
    this.onEMP(count);
    return count;
  }
  update(dt: number, enemies: readonly Enemy[]): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.fuse -= dt;
      // Sweep every segment: a grenade never crosses walls at high velocity.
      for (let step = 0; step < 4; step++) {
        p.velocity.y -= (10 * dt) / 4;
        const delta = p.velocity.scale(dt / 4),
          length = delta.length();
        const hit =
          length > 0
            ? pickWorld(
                this.scene,
                new Ray(p.mesh.position, delta.scale(1 / length), length + 0.1),
              )
            : null;
        if (hit?.hit && hit.pickedPoint) {
          const normal = hit.getNormal(true) ?? Vector3.Up();
          p.mesh.position.copyFrom(hit.pickedPoint.add(normal.scale(0.12)));
          const dot = Vector3.Dot(p.velocity, normal);
          if (dot < 0) p.velocity.subtractInPlace(normal.scale(1.35 * dot));
          p.velocity.scaleInPlace(0.65);
        } else p.mesh.position.addInPlace(delta);
      }
      if (p.fuse <= 0) {
        this.detonate(p.mesh.position.clone(), enemies);
        p.mesh.dispose();
        this.projectiles.splice(i, 1);
      }
    }
    for (const p of this.pulses)
      if (p.remaining > 0) {
        p.remaining = Math.max(0, p.remaining - dt);
        p.mesh.scaling.setAll(p.radius * (1 - p.remaining / 0.45));
        p.mesh.visibility = p.remaining / 0.45;
        p.mesh.setEnabled(p.remaining > 0);
      }
  }
  reset(): void {
    this.ammo = 2;
    this.cooldown = 0;
    for (const p of this.projectiles) p.mesh.dispose();
    this.projectiles = [];
    for (const p of this.pulses) {
      p.remaining = 0;
      p.mesh.setEnabled(false);
    }
  }
}
