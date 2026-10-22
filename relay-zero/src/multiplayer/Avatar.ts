import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  TransformNode,
  Mesh,
} from "@babylonjs/core";
import { Health } from "../combat/Damage";
export class Avatar extends Health {
  root: TransformNode;
  target = Vector3.Zero();
  yaw = 0;
  private stride = 0;
  private displayTarget = Vector3.Zero();
  parts: Mesh[] = [];
  materials: StandardMaterial[] = [];
  constructor(scene: Scene, id: string, friendly: boolean) {
    super(id, 100);
    this.root = new TransformNode("friend operative", scene);
    const armor = new StandardMaterial("operative armor", scene);
    armor.diffuseColor = Color3.FromHexString(friendly ? "#559cb0" : "#c67955");
    armor.specularColor.set(0.12, 0.15, 0.16);
    const black = new StandardMaterial("operative joints", scene);
    black.diffuseColor = Color3.FromHexString("#202c36");
    const visor = new StandardMaterial("operative visor", scene);
    visor.diffuseColor = Color3.FromHexString(friendly ? "#9bf6eb" : "#ffd190");
    visor.emissiveColor = visor.diffuseColor.scale(0.45);
    this.materials = [armor, black, visor];
    const box = (
      name: string,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      mat: StandardMaterial,
      head = false,
    ) => {
      const m = MeshBuilder.CreateBox(
        name,
        { width: w, height: h, depth: d },
        scene,
      );
      m.parent = this.root;
      m.position.set(x, y, z);
      m.material = mat;
      m.metadata = { entity: this, head };
      this.parts.push(m);
    };
    box("operative torso", 0, 1.08, 0, 0.62, 0.62, 0.35, armor);
    box("operative vest", 0, 1.12, -0.19, 0.46, 0.41, 0.08, black);
    box("operative helmet", 0, 1.64, 0, 0.38, 0.4, 0.36, armor, true);
    box("operative face", 0, 1.66, 0.19, 0.31, 0.13, 0.04, visor, true);
    for (const side of [-1, 1]) {
      box("operative arm", side * 0.39, 1.03, 0.06, 0.18, 0.62, 0.2, black);
      box("operative shoulder", side * 0.38, 1.27, 0, 0.23, 0.22, 0.26, armor);
      box("operative leg", side * 0.17, 0.46, 0, 0.22, 0.79, 0.24, black);
      box("operative knee", side * 0.17, 0.48, 0.13, 0.23, 0.19, 0.09, armor);
    }
    box("operative rifle", 0.27, 1.13, 0.44, 0.12, 0.13, 0.72, black);
  }
  place(p: Vector3, yaw: number, snap = false): void {
    this.target.copyFrom(p);
    this.yaw = yaw;
    if (snap || Vector3.DistanceSquared(this.root.position, p) > 64)
      this.root.position.copyFrom(p);
  }
  update(dt: number, crouch = false, pitch = 0): void {
    const moving =
      Vector3.DistanceSquared(this.root.position, this.target) > 0.004;
    this.displayTarget.copyFrom(this.target);
    if (this.health <= 0) this.displayTarget.y += 0.55;
    Vector3.LerpToRef(
      this.root.position,
      this.displayTarget,
      1 - Math.exp(-18 * dt),
      this.root.position,
    );
    const delta = Math.atan2(
      Math.sin(this.yaw - this.root.rotation.y),
      Math.cos(this.yaw - this.root.rotation.y),
    );
    this.root.rotation.y += delta * (1 - Math.exp(-18 * dt));
    this.root.scaling.y = crouch && this.health > 0 ? 0.72 : 1;
    this.root.rotation.z +=
      ((this.health <= 0 ? Math.PI / 2 : 0) - this.root.rotation.z) *
      (1 - Math.exp(-12 * dt));
    this.stride += dt * 10;
    for (const p of this.parts) {
      p.isPickable = this.health > 0;
      if (p.name === "operative leg" || p.name === "operative knee")
        p.rotation.x =
          moving && this.health > 0
            ? Math.sin(this.stride + (p.position.x > 0 ? 0 : Math.PI)) * 0.24
            : 0;
      if (p.name === "operative helmet" || p.name === "operative face")
        p.rotation.x = Math.max(-0.6, Math.min(0.6, pitch));
      if (p.name === "operative rifle")
        p.rotation.x = Math.max(-1, Math.min(1, pitch));
    }
  }
  dispose(): void {
    this.root.dispose();
    for (const m of this.materials) m.dispose();
  }
}
