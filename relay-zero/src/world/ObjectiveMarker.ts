import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  TransformNode,
} from "@babylonjs/core";
import { Navigation } from "../ai/Navigation";
import { Level } from "./Level";
// Select reachable, unoccupied ground cells instead of embedding objectives in map props.
export function objectivePoints(nav: Navigation, level: Level): Vector3[] {
  const preferred =
    level.mapId === "cargo"
      ? [new Vector3(-12, 0, 2), new Vector3(12, 0, 12)]
      : level.mapId === "nexus"
        ? [new Vector3(12, 0, -4), new Vector3(-12, 0, 10)]
        : [new Vector3(-10, 0, 0), new Vector3(10, 0, 12)];
  const selected: Vector3[] = [];
  const reachable = nav.reachable(level.spawn);
  for (const target of preferred) {
    const candidates: Vector3[] = [];
    for (let z = 1; z < nav.size - 1; z++)
      for (let x = 1; x < nav.size - 1; x++) {
        if (nav.blocked.has(z * nav.size + x)) continue;
        const p = nav.world(x, z);
        if (selected.some((other) => Vector3.DistanceSquared(other, p) < 64))
          continue;
        if (reachable.has(z * nav.size + x)) candidates.push(p);
      }
    candidates.sort(
      (a, b) =>
        Vector3.DistanceSquared(a, target) - Vector3.DistanceSquared(b, target),
    );
    selected.push(candidates[0] ?? level.spawn.clone());
  }
  return selected;
}
export class ObjectiveMarker {
  root: TransformNode;
  ring;
  mat: StandardMaterial;
  constructor(scene: Scene) {
    this.root = new TransformNode("objective marker", scene);
    this.mat = new StandardMaterial("objective glow", scene);
    this.mat.disableLighting = true;
    this.mat.emissiveColor = Color3.FromHexString("#87efd1");
    this.ring = MeshBuilder.CreateTorus(
      "objective boundary",
      { diameter: 6, thickness: 0.045, tessellation: 48 },
      scene,
    );
    this.ring.parent = this.root;
    this.ring.position.y = 0.09;
    const beacon = MeshBuilder.CreateCylinder(
      "objective beacon",
      { height: 2.5, diameter: 0.1, tessellation: 6 },
      scene,
    );
    beacon.parent = this.root;
    beacon.position.y = 1.3;
    const terminal = MeshBuilder.CreateBox(
      "objective terminal",
      { width: 0.45, height: 0.75, depth: 0.35 },
      scene,
    );
    terminal.parent = this.root;
    terminal.position.y = 0.4;
    for (const m of [this.ring, beacon, terminal]) {
      m.material = this.mat;
      m.isPickable = false;
    }
    this.root.setEnabled(false);
  }
  show(point: Vector3 | undefined, radius: number, contested: boolean): void {
    this.root.setEnabled(!!point);
    if (!point) return;
    this.root.position.copyFrom(point);
    this.ring.scaling.set(radius / 3, 1, radius / 3);
    this.mat.emissiveColor.copyFromFloats(
      contested ? 1 : 0.25,
      contested ? 0.4 : 0.9,
      contested ? 0.15 : 0.7,
    );
  }
}
