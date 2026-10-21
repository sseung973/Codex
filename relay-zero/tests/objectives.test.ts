import test from "node:test";
import assert from "node:assert/strict";
import { Vector3, NullEngine, Scene } from "@babylonjs/core";
import { Objectives, objectiveForWave } from "../src/core/Objectives";
import { Waves, waveBatches } from "../src/core/Waves";
import { Level } from "../src/world/Level";
import { Navigation } from "../src/ai/Navigation";
import { objectivePoints, ObjectiveMarker } from "../src/world/ObjectiveMarker";
import { MapId } from "../src/world/MapData";
test("capture requires zone and line of sight; contest pauses; complete fires once", () => {
  const o = new Objectives(),
    p = Vector3.Zero();
  o.reset("capture", [p]);
  o.update(5, p, [], false, true);
  assert.equal(o.progress, 5);
  o.update(4, p, [p], false, true);
  assert.equal(o.progress, 5);
  o.update(4, new Vector3(10, 0, 0), [], false, true);
  assert.equal(o.progress, 5);
  o.update(4, p, [], false, false);
  assert.equal(o.progress, 5);
  assert.equal(o.update(7, p, [], false, true), true);
  assert.equal(o.update(1, p, [], false, true), false);
});
test("device operation requires uninterrupted E and two separate locations", () => {
  const o = new Objectives(),
    p = Vector3.Zero(),
    q = new Vector3(10, 0, 0);
  o.reset("activate", [p, q]);
  o.update(2, p, [], true, true);
  o.update(0.1, p, [], false, true);
  assert.equal(o.progress, 0);
  assert.equal(o.update(3, p, [], true, true), false);
  assert.equal(o.stage, 1);
  o.update(3, p, [], true, true);
  assert.equal(o.done, false);
  assert.equal(o.update(3, q, [], true, true), true);
});
test("defense loses progress outside zone or under contest, resets cleanly", () => {
  const o = new Objectives(),
    p = Vector3.Zero();
  o.reset("defend", [p]);
  o.update(10, p, [], false, true);
  o.update(2, p, [p], false, true);
  assert.equal(o.progress, 6);
  o.update(2, new Vector3(10, 0, 0), [], false, true);
  assert.equal(o.progress, 2);
  assert.equal(o.update(18, p, [], false, true), true);
  o.reset();
  assert.equal(o.progress, 0);
  assert.equal(o.done, true);
});
test("all five waves require both objectives and enemies and automatically advance after four breaks", () => {
  const waves = new Waves(),
    o = new Objectives();
  let clears = 0,
    victories = 0;
  waves.onWave = (index) => {
    o.reset(objectiveForWave(index), [Vector3.Zero(), new Vector3(10, 0, 0)]);
    if (!o.done) waves.requireObjective();
  };
  waves.onClear = () => {
    clears++;
  };
  waves.onVictory = () => victories++;
  waves.reset([1, 1, 1, 1, 1]);
  for (let wave = 1; wave <= 5; wave++) {
    waves.update(20);
    assert.equal(waves.index, wave);
    waves.kill();
    if (wave >= 2 && wave <= 4) {
      assert.equal(waves.intermission <= 0, true);
      waves.finishObjective();
    }
  }
  assert.equal(clears, 4);
  assert.equal(victories, 1);
  waves.finishObjective();
  waves.kill();
  assert.equal(victories, 1);
});
test("reinforcements keep the wave open, arrive in bounded groups, and reset on restart", () => {
  assert.deepEqual(waveBatches(12, 5), [6, 3, 3]);
  const waves = new Waves();
  const batches: number[] = [];
  let victories = 0;
  waves.onReinforcement = (_, count, offset) => {
    assert.equal(offset, waves.spawned - count);
    batches.push(count);
  };
  waves.onVictory = () => victories++;
  waves.reset([1, 1, 1, 1, 12], 0.5);
  for (let wave = 1; wave < 5; wave++) {
    waves.update(3);
    waves.kill();
    waves.update(.6);
  }
  assert.equal(waves.index, 5);
  assert.equal(waves.spawned, 6);
  assert.equal(waves.pending, 6);
  for (let i = 0; i < 6; i++) waves.kill();
  assert.equal(victories, 0);
  waves.update(.1);
  assert.equal(waves.spawned, 9);
  for (let i = 0; i < 3; i++) waves.kill();
  waves.update(.1);
  assert.equal(waves.spawned, 12);
  for (let i = 0; i < 3; i++) waves.kill();
  assert.equal(victories, 1);
  assert.deepEqual(batches, [3, 3]);
  waves.reset();
  assert.equal(waves.pending, 0);
  assert.equal(waves.spawned, 0);
});
test("late waves wait for room before sending the next group", () => {
  const waves = new Waves();
  waves.reset([1, 1, 1, 1, 18], .5);
  for (let i = 0; i < 4; i++) {
    waves.update(3);
    waves.kill();
    waves.update(.6);
  }
  assert.equal(waves.spawned, 9);
  waves.update(12);
  assert.equal(waves.spawned, 9, "large reinforcement would crowd the arena");
  waves.kill(); waves.kill();
  waves.update(.1);
  assert.equal(waves.spawned, 14);
  assert.equal(waves.spawned - 2, 12);
});
class GeometryLevel extends Level {
  override sign(): void {}
}
for (const id of ["foundry", "cargo", "nexus"] as MapId[])
  test(`${id} objective locations are reachable and separated; marker does not block bullets`, () => {
    const engine = new NullEngine(),
      scene = new Scene(engine),
      level = new GeometryLevel(scene, id),
      nav = new Navigation(level),
      points = objectivePoints(nav, level);
    assert.equal(points.length, 2);
    assert.ok(Vector3.Distance(points[0], points[1]) >= 8);
    for (const p of points) {
      const [x, z] = nav.cellOf(p);
      assert.equal(nav.blocked.has(z * nav.size + x), false);
      assert.ok(nav.route(level.spawn, p).length > 0);
    }
    const marker = new ObjectiveMarker(scene);
    marker.show(points[0], 3, false);
    assert.equal(marker.root.isEnabled(), true);
    assert.ok(marker.root.getChildMeshes().every((m) => !m.isPickable));
    marker.show(undefined, 3, false);
    assert.equal(marker.root.isEnabled(), false);
    scene.dispose();
    engine.dispose();
  });
