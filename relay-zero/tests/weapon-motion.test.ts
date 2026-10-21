import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine, Scene, TransformNode } from "@babylonjs/core";
import { WeaponMotion, MotionFrame } from "../src/weapons/WeaponMotion";
const frame: MotionFrame = {
  ads: 0,
  sprint: false,
  grounded: true,
  moving: false,
  dx: 0,
  dy: 0,
  strafe: 0,
  reload: 0,
  wall: 0,
  swing: 0,
  sniper: false,
};
test("visual recoil accumulates within bounds, recovers and resets without allocating scene resources", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine),
    root = new TransformNode("root", scene),
    motion = new WeaponMotion(scene, root);
  const nodes = scene.transformNodes.length;
  for (let i = 0; i < 300; i++) {
    motion.shot(0.05, i, 0);
    motion.update(1 / 120, frame);
    assert.ok(motion.recoil.position.z >= -0.095);
  }
  assert.equal(scene.transformNodes.length, nodes);
  for (let i = 0; i < 120; i++) motion.update(1 / 60, frame);
  assert.ok(Math.abs(motion.recoil.position.z) < 0.00001);
  assert.equal(root.rotation.x, 0);
  motion.shot(0.05, 1, 0);
  motion.reset();
  assert.equal(motion.recoil.position.z, 0);
  scene.dispose();
  engine.dispose();
});
test("extreme mouse deltas remain clamped and ADS suppresses sway; sprint eases and airborne bob settles", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine),
    motion = new WeaponMotion(scene, new TransformNode("root", scene));
  motion.reset();
  for (let i = 0; i < 100; i++)
    motion.update(1 / 60, {
      ...frame,
      dx: 1e6,
      dy: -1e6,
      moving: true,
      sprint: true,
      strafe: 1,
    });
  assert.ok(Math.abs(motion.sway.position.x) <= 0.018);
  assert.ok(Math.abs(motion.sway.position.y) <= 0.012);
  const sprintY = motion.pose.position.y;
  motion.update(1 / 60, frame);
  assert.ok(motion.pose.position.y > sprintY && motion.pose.position.y < -0.29);
  for (let i = 0; i < 120; i++)
    motion.update(1 / 60, {
      ...frame,
      ads: 1,
      dx: 1e6,
      grounded: false,
      moving: true,
    });
  assert.ok(Math.abs(motion.sway.position.x) < 0.0011);
  assert.ok(Math.abs(motion.bob.position.y) < 0.00001);
  scene.dispose();
  engine.dispose();
});
