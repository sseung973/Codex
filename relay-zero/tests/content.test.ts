import test from "node:test";
import assert from "node:assert/strict";
import {
  NullEngine,
  Scene,
  Vector3,
  MeshBuilder,
  VertexBuffer,
  TransformNode,
} from "@babylonjs/core";
import { Level } from "../src/world/Level";
import { maps, MapId } from "../src/world/MapData";
import { Navigation } from "../src/ai/Navigation";
import { Enemy, enemyConfig, roleForSpawn } from "../src/ai/Enemy";
import { WeaponModels } from "../src/weapons/WeaponModels";
import { Weapon } from "../src/weapons/Weapon";
import { Player } from "../src/player/Player";
import { PlayerInput } from "../src/player/PlayerInput";
import { Target } from "../src/ai/Target";
import { Audio } from "../src/audio/Audio";
import { Effects } from "../src/effects/Effects";
import { defaults } from "../src/core/Settings";
import { meleeHit } from "../src/weapons/Melee";
class GeometryLevel extends Level {
  override sign(): void {}
}

for (const id of Object.keys(maps) as MapId[])
  test(`${id}: finite geometry, spawn routes and clean level disposal`, () => {
    const engine = new NullEngine(),
      scene = new Scene(engine);
    const level = new GeometryLevel(scene, id);
    for (const mesh of scene.meshes) {
      mesh.computeWorldMatrix(true);
      for (const kind of [VertexBuffer.PositionKind, VertexBuffer.NormalKind]) {
        const values = mesh.getVerticesData(kind);
        assert.ok(values?.every(Number.isFinite), `${mesh.name} ${kind}`);
      }
    }
    const batches = scene.meshes.filter((m) => m.metadata?.visualOnly);
    assert.ok(batches.length >= 6 && batches.length <= 12,
      `decorative batches exceeded draw-call budget: ${batches.length}`);
    for (const mesh of batches) {
      assert.equal(mesh.isPickable, false);
      assert.equal(mesh.checkCollisions, false);
      assert.ok(!level.solids.includes(mesh));
    }
    assert.equal(
      level.material("cached metal", "#28343f"),
      level.material("cached metal", "#28343f"),
    );
    const nav = new Navigation(level);
    for (const p of [level.spawn, ...level.enemySpawns]) {
      const [x, z] = nav.cellOf(p);
      assert.equal(
        nav.blocked.has(z * nav.size + x),
        false,
        `spawn blocked ${p}`,
      );
      if (p !== level.spawn) assert.ok(nav.route(p, level.spawn).length > 0);
    }
    // Only the level owns these scene resources in this fixture.
    level.dispose();
    assert.equal(scene.meshes.length, 0);
    assert.equal(scene.lights.length, 0);
    assert.equal(scene.transformNodes.length, 0);
    assert.equal(scene.materials.length, 0);
    scene.dispose();
    engine.dispose();
  });
test("late-wave robots share static materials and cast only main-body shadows", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const level = new GeometryLevel(scene, "foundry");
  const nav = new Navigation(level);
  const baseline = scene.materials.length;
  const robots = Array.from({ length: 18 }, (_, i) => new Enemy(
    scene, level, nav, enemyConfig(5, false, undefined, roleForSpawn(i)),
    new Vector3((i % 6) * 2 - 5, 0, 5 + Math.floor(i / 6) * 2),
    `perf-${i}`, false, roleForSpawn(i),
  ));
  assert.equal(new Set(robots.map(r => r.parts.find(p => p.name === "leg")?.material)).size, 1);
  assert.ok(scene.materials.length - baseline <= 45,
    `too many per-robot materials: ${scene.materials.length - baseline}`);
  const shadowList = level.shadows.getShadowMap()?.renderList ?? [];
  for (const robot of robots)
    assert.ok(robot.parts.filter(p => shadowList.includes(p)).length <= 3);
  for (const robot of robots) robot.dispose();
  assert.equal(scene.materials.filter(m => m.name.startsWith("robot shared")).length, 2);
  assert.ok(scene.materials.length <= baseline + 3, "robot-specific materials are released");
  level.dispose();
  scene.dispose();
  engine.dispose();
});
test("all three weapon models remain separate, finite and not pickable across switches", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine),
    parent = new TransformNode("root", scene),
    models = new WeaponModels(scene, parent);
  for (let slot = 0; slot < 3; slot++) {
    models.select(slot);
    models.views.forEach((view, i) =>
      assert.equal(view.root.isEnabled(), i === slot),
    );
    for (const m of parent.getChildMeshes()) {
      assert.equal(m.isPickable, false);
      assert.equal(m.renderingGroupId, 1);
      assert.ok(
        m.getVerticesData(VertexBuffer.PositionKind)?.every(Number.isFinite),
      );
    }
  }
  assert.notEqual(models.views[0].muzzle, models.views[1].muzzle);
  assert.notEqual(models.views[1].muzzle, models.views[2].muzzle);
  scene.dispose();
  engine.dispose();
});
test("melee hits nearby target, cannot hit through a wall, beyond range or behind player", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  const target = new Target(scene, new Vector3(0, 0, 1.8));
  for (const m of scene.meshes) m.computeWorldMatrix(true);
  const origin = new Vector3(0, 1.65, 0),
    forward = Vector3.Forward();
  assert.equal(
    meleeHit(scene, origin, forward, 2.3)?.pickedMesh?.metadata.entity,
    target,
  );
  assert.equal(meleeHit(scene, origin, forward, 0.8), null);
  assert.equal(meleeHit(scene, origin, forward.negate(), 2.3), null);
  const wall = MeshBuilder.CreateBox(
    "wall",
    { width: 4, height: 3, depth: 0.3 },
    scene,
  );
  wall.position.set(0, 1.5, 0.8);
  wall.metadata = { world: true };
  wall.computeWorldMatrix(true);
  assert.equal(meleeHit(scene, origin, forward, 2.3), null);
  scene.dispose();
  engine.dispose();
});
test("melee resolves once after windup, uses no ammunition, cannot reload and switching cancels a swing", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine),
    pressed = new Set<string>();
  const input = {
    dx: 0,
    dy: 0,
    wheel: 0,
    fire: false,
    firePressed: false,
    ads: false,
    down: () => false,
    consume: (k: string) => {
      const v = pressed.has(k);
      pressed.delete(k);
      return v;
    },
  } as unknown as PlayerInput;
  const player = new Player(scene, input, { ...defaults });
  player.resetAt(Vector3.Zero());
  const effects = new Effects(scene),
    weapon = new Weapon(
      scene,
      player,
      { play: () => {} } as unknown as Audio,
      effects,
    );
  const target = new Target(scene, new Vector3(0, 0, 1.8));
  scene.render();
  weapon.switchTo(2);
  assert.equal(weapon.melee, true);
  assert.equal(weapon.mag.reload(), false);
  weapon.fire();
  assert.equal(target.health, 100);
  for (let i = 0; i < 12; i++) weapon.update(1 / 60);
  assert.equal(target.health, 0);
  for (let i = 0; i < 30; i++) weapon.update(1 / 60);
  assert.equal(target.health, 0);
  assert.equal(weapon.mag.ammo, 0);
  weapon.fire();
  weapon.switchTo(0);
  for (let i = 0; i < 30; i++) weapon.update(1 / 60);
  assert.equal(target.health, 0);
  assert.equal(weapon.mag.ammo, 30);
  weapon.switchTo(2);
  input.wheel = 1;
  weapon.update(0.016);
  assert.equal(weapon.slot, 0);
  input.wheel = -1;
  weapon.update(0.016);
  assert.equal(weapon.slot, 2);
  scene.dispose();
  engine.dispose();
});

test("pooled feedback never grows scene meshes across impacts, arrivals and clearing", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine),
    fx = new Effects(scene);
  const count = scene.meshes.length;
  for (let i = 0; i < 150; i++) {
    fx.impact(Vector3.Zero(), i % 2 === 0);
    fx.spawn(Vector3.Zero());
    fx.tracer(Vector3.Zero(), Vector3.One());
    fx.update(0.016);
  }
  assert.equal(scene.meshes.length, count);
  fx.clear();
  assert.ok(scene.meshes.every((m) => !m.isEnabled()));
  scene.dispose();
  engine.dispose();
});
