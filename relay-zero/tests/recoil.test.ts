import test from "node:test";
import assert from "node:assert/strict";
import { recoilImpulse } from "../src/weapons/Recoil";
import { rifle } from "../src/weapons/WeaponData";
test("recoil builds with burst length, is repeatable and decreases with aim/crouch", () => {
  const shot = (n: number, ads = false, crouch = false) =>
    recoilImpulse(rifle, n, ads, crouch, false, false);
  assert.ok(shot(12).pitch > shot(1).pitch);
  assert.deepEqual(shot(12), shot(12));
  assert.ok(shot(12, true).pitch < shot(12).pitch);
  assert.ok(shot(12, false, true).pitch < shot(12).pitch);
  assert.ok(
    recoilImpulse(rifle, 12, false, false, true, true).pitch > shot(12).pitch,
  );
  assert.equal(shot(200).pitch, shot(13).pitch);
});

import { NullEngine, Scene, Vector3, MeshBuilder } from "@babylonjs/core";
import { Player } from "../src/player/Player";
import { PlayerInput } from "../src/player/PlayerInput";
import { defaults } from "../src/core/Settings";
import { RobotShutdown } from "../src/ai/RobotShutdown";
import { TransformNode } from "@babylonjs/core";
test("camera recoil waits before recovery and mouse can compensate without being overwritten", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  const input = { dx: 0, dy: 10 } as PlayerInput;
  const player = new Player(scene, input, { ...defaults });
  player.recoilPitch = 0.1;
  player.recoilDelay = 0.18;
  player.look(false);
  const aim = player.pitch;
  assert.ok(aim > 0);
  player.updateCamera(0.1, false);
  assert.equal(player.recoilPitch, 0.1);
  assert.equal(player.pitch, aim);
  player.updateCamera(0.2, false);
  assert.ok(player.recoilPitch < 0.1);
  assert.equal(player.pitch, aim);
  player.resetAt(Vector3.Zero());
  assert.equal(player.recoilPitch, 0);
  assert.equal(player.recoilDelay, 0);
  scene.dispose();
  engine.dispose();
});
test("robot shutdown changes pose without scaling, stays above ground and then disables", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine),
    root = new TransformNode("robot", scene);
  const torso = MeshBuilder.CreateBox(
    "torso",
    { width: 0.6, height: 0.7, depth: 0.4 },
    scene,
  );
  torso.parent = root;
  torso.position.y = 1.1;
  const leg = MeshBuilder.CreateBox(
    "leg",
    { width: 0.2, height: 0.65, depth: 0.23 },
    scene,
  );
  leg.parent = root;
  leg.position.y = 0.39;
  const shutdown = new RobotShutdown(root, [torso, leg]);
  shutdown.start(Vector3.Right());
  for (let i = 0; i < 24; i++) {
    shutdown.update(0.05);
    for (const p of [torso, leg]) {
      p.computeWorldMatrix(true);
      assert.ok(p.getBoundingInfo().boundingBox.minimumWorld.y >= -1e-6);
    }
  }
  assert.ok(torso.position.y < 1.1);
  assert.ok(leg.rotationQuaternion);
  assert.ok(
    shutdown.links.every(
      (link) =>
        Math.abs(
          Vector3.Distance(
            shutdown.particles[link.a].position,
            shutdown.particles[link.b].position,
          ) - link.length,
        ) < 0.15,
    ),
  );
  assert.equal(root.scaling.y, 1);
  assert.equal(root.isEnabled(), true);
  shutdown.start(Vector3.Left());
  assert.ok(shutdown.elapsed > 1);
  shutdown.update(5);
  assert.equal(root.isEnabled(), false);
  scene.dispose();
  engine.dispose();
});
