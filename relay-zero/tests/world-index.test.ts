import test from "node:test";
import assert from "node:assert/strict";
import {
  NullEngine,
  Scene,
  Vector3,
  Ray,
  MeshBuilder,
  type PickingInfo,
} from "@babylonjs/core";
import { Level } from "../src/world/Level";
import { pickWorld, worldMeshes } from "../src/world/WorldQuery";
import { ArenaDevices } from "../src/world/ArenaDevices";
import { Navigation } from "../src/ai/Navigation";
import { objectivePoints } from "../src/world/ObjectiveMarker";
class GeometryLevel extends Level {
  override sign(): void {}
}
function brute(scene: Scene, ray: Ray): PickingInfo | null {
  let closest: PickingInfo | null = null;
  for (const mesh of worldMeshes(scene)) {
    if (!mesh.isEnabled()) continue;
    mesh.computeWorldMatrix();
    const box = mesh.getBoundingInfo().boundingBox;
    if (!ray.intersectsBoxMinMax(box.minimumWorld, box.maximumWorld)) continue;
    const hit = ray.intersectsMesh(mesh, false);
    if (
      hit.hit &&
      hit.distance <= ray.length &&
      (!closest || hit.distance < closest.distance)
    )
      closest = hit;
  }
  return closest;
}
for (const map of ["foundry", "cargo", "nexus"] as const)
  test(`${map}: spatial rays match exact brute-force results, including grid boundaries and ramps`, () => {
    const engine = new NullEngine(),
      scene = new Scene(engine),
      level = new GeometryLevel(scene, map),
      nav = new Navigation(level),
      devices = new ArenaDevices(level, nav, objectivePoints(nav, level));
    level.optimize();
    let seed = 567;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const rays = Array.from(
      { length: 600 },
      (_, i) =>
        new Ray(
          new Vector3(
            random() * 80 - 40,
            random() * 10 - 0.5,
            random() * 80 - 40,
          ),
          i % 3 === 0
            ? Vector3.Down()
            : new Vector3(
                random() - 0.5,
                random() - 0.5,
                random() - 0.5,
              ).normalize(),
          i % 4 === 0 ? 1 : 70,
        ),
    );
    for (const x of [-24, -20, -16, -4, 0, 4, 16, 20, 24])
      for (const z of [-20, 0, 20])
        for (const d of [
          Vector3.Up(),
          Vector3.Down(),
          new Vector3(1, 0, 1).normalize(),
          new Vector3(-1, 0, -1).normalize(),
        ])
          rays.push(new Ray(new Vector3(x, 1.65, z), d, 60));
    const compare = () => {
      for (const ray of rays) {
        const expected = brute(scene, ray),
          actual = pickWorld(scene, ray);
        assert.equal(
          !!actual?.hit,
          !!expected?.hit,
          `${ray.origin} -> ${ray.direction}`,
        );
        if (expected?.hit)
          assert.ok(
            Math.abs(actual!.distance - expected.distance) < 1e-5,
            `${actual?.distance} vs ${expected.distance}`,
          );
      }
    };
    try {
      compare();
      for (const cell of devices.cells) cell.mesh.setEnabled(false);
      for (const b of devices.barriers) b.mesh.setEnabled(true);
      compare();
      const moving = MeshBuilder.CreateBox(
        "moving collider",
        { size: 2 },
        scene,
      );
      moving.metadata = { world: true };
      moving.position.set(0, 1, -16);
      compare();
      moving.position.x = 9;
      compare();
      moving.dispose();
      compare();
    } finally {
      scene.dispose();
      engine.dispose();
    }
  });
