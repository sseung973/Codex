import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine, Scene, MeshBuilder, Vector3, Ray } from "@babylonjs/core";
import { Level } from "../src/world/Level";
import { Navigation } from "../src/ai/Navigation";
import { ArenaDevices } from "../src/world/ArenaDevices";
import { objectivePoints } from "../src/world/ObjectiveMarker";
import { pickWorld, worldMeshes } from "../src/world/WorldQuery";
import { PerformanceBudget } from "../src/core/PerformanceBudget";
import { Enemy, enemyConfig } from "../src/ai/Enemy";
import { Player } from "../src/player/Player";
import { Weapon } from "../src/weapons/Weapon";
import { Effects } from "../src/effects/Effects";
import { defaults, loadSettings } from "../src/core/Settings";
import { sniper, smg } from "../src/weapons/Arsenal";

class GeometryLevel extends Level {
  override sign(): void {}
}

for (const map of ["foundry", "cargo", "nexus"] as const)
  test(`${map}: batching reduces render objects while preserving colliders, navigation, devices and disposal`, () => {
    const engine = new NullEngine(),
      scene = new Scene(engine),
      level = new GeometryLevel(scene, map),
      nav = new Navigation(level);
    const mission = objectivePoints(nav, level),
      devices = new ArenaDevices(level, nav, mission);
    const before = scene.meshes.filter(
      (m) => m.isEnabled() && m.isVisible,
    ).length;
    const from = new Vector3(0, 1.65, -17),
      to = new Vector3(0, 1.65, 23);
    const oldHit = scene.pickWithRay(
      new Ray(from, to.subtract(from).normalize(), 40),
      (m) => m.isEnabled() && m.metadata?.world === true,
    );
    const blocked = new Set(nav.blocked);
    level.optimize();
    const after = scene.meshes.filter(
      (m) => m.isEnabled() && m.isVisible,
    ).length;
    assert.ok(after < before * 0.5, `${before} => ${after}`);
    nav.rebuild();
    assert.deepEqual(nav.blocked, blocked);
    const newHit = pickWorld(
      scene,
      new Ray(from, to.subtract(from).normalize(), 40),
    );
    assert.equal(newHit?.pickedMesh, oldHit?.pickedMesh);
    assert.ok(newHit?.pickedPoint?.equalsWithEpsilon(oldHit!.pickedPoint!));
    const actor = new Player(
      scene,
      { dx: 0, dy: 0, down: () => false, consume: () => false } as any,
      { ...defaults },
    );
    actor.resetAt(level.spawn);
    actor.body.surroundingMeshes = level.solids;
    scene.render();
    for (let i = 0; i < 8; i++) {
      actor.update(1 / 60, false);
      scene.render();
    }
    assert.ok(actor.grounded);
    assert.ok(actor.feet.y > -0.1);
    for (const p of mission) assert.ok(nav.route(level.spawn, p).length > 0);
    for (const barrier of devices.barriers) {
      assert.equal(barrier.mesh.metadata?.dynamic, true);
      const position = barrier.control.position.add(new Vector3(0, 1, 0));
      assert.equal(devices.interact(position, []), true);
      assert.equal(barrier.mesh.isVisible, true);
      assert.equal(barrier.mesh.isEnabled(), true);
      devices.update(7);
      assert.equal(barrier.mesh.isEnabled(), false);
    }
    const count = scene.meshes.length;
    level.optimize();
    assert.equal(scene.meshes.length, count, "batching must be idempotent");
    actor.body.dispose();
    actor.camera.dispose();
    level.dispose();
    assert.equal(scene.meshes.length, 0);
    scene.dispose();
    engine.dispose();
  });

test("cached world rays notice a new wall immediately, ignore disabled doors and retain exact rotated ramp intersections", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  const ray = new Ray(new Vector3(0, 1, 0), Vector3.Forward(), 10);
  assert.equal(pickWorld(scene, ray), null);
  for (let i = 0; i < 500; i++) {
    const m = MeshBuilder.CreateBox("effect", { size: 0.1 }, scene);
    m.isPickable = false;
  }
  const wall = MeshBuilder.CreateBox(
    "door",
    { width: 4, height: 3, depth: 0.1 },
    scene,
  );
  wall.position.set(0, 1, 3);
  wall.metadata = { world: true };
  assert.equal(
    pickWorld(scene, ray)?.pickedMesh,
    wall,
    "mesh-added notifications may be deferred until after this query",
  );
  assert.equal(worldMeshes(scene).length, 1);
  wall.setEnabled(false);
  assert.equal(pickWorld(scene, ray), null);
  wall.setEnabled(true);
  assert.equal(pickWorld(scene, ray)?.pickedMesh, wall);
  wall.rotation.x = 0.25;
  wall.computeWorldMatrix(true);
  const exact = scene.pickWithRay(ray, (m) => m === wall);
  assert.ok(
    pickWorld(scene, ray)?.pickedPoint?.equalsWithEpsilon(exact!.pickedPoint!),
  );
  wall.dispose();
  assert.equal(pickWorld(scene, ray), null);
  scene.dispose();
  engine.dispose();
});

test("merged weapons retain the camera-local muzzle, variant visibility, ammo and a stable flash light registration", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine),
    player = new Player(
      scene,
      {
        dx: 0,
        dy: 0,
        wheel: 0,
        down: () => false,
        consume: () => false,
        fire: false,
      } as any,
      { ...defaults },
    );
  const weapon = new Weapon(
    scene,
    player,
    { play: () => {} } as any,
    new Effects(scene),
  );
  weapon.startLoadout("p12");
  scene.render();
  const active = weapon.models.views[1].root
    .getChildMeshes()
    .filter((m) => m.isEnabled());
  assert.ok(active.length <= 8);
  const position = weapon.muzzle.position.clone();
  assert.ok(position.equalsWithEpsilon(new Vector3(0, 0.045, 0.545)));
  weapon.muzzleLight.setEnabled(true);
  for (let i = 0; i < 20; i++) {
    weapon.fire();
    weapon.update(0.1);
  }
  assert.equal(
    weapon.muzzleLight.isEnabled(),
    true,
    "shots must not invalidate light shader defines",
  );
  weapon.equipPrimary(sniper);
  assert.equal(
    weapon.models.views[0].root
      .getChildMeshes()
      .find((m) => m.metadata?.onlyWeapon === "l5")
      ?.isEnabled(),
    true,
  );
  weapon.equipPrimary(smg);
  assert.equal(
    weapon.models.views[0].root
      .getChildMeshes()
      .find((m) => m.metadata?.onlyWeapon === "l5")
      ?.isEnabled(),
    false,
  );
  assert.equal(
    weapon.models.views[0].root
      .getChildMeshes()
      .find((m) => m.metadata?.onlyWeapon === "s24")
      ?.isEnabled(),
    true,
  );
  assert.equal(weapon.muzzle.isDisposed(), false);
  scene.dispose();
  engine.dispose();
});

test("merged robots preserve exact head/body hit tests and finite shutdown geometry without extra shadow casters", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine),
    level = new GeometryLevel(scene),
    nav = new Navigation(level);
  const e = new Enemy(
    scene,
    level,
    nav,
    enemyConfig(1),
    new Vector3(0, 0, -14),
    "batch-test",
  );
  assert.ok(e.parts.length < 24);
  for (const mesh of e.parts) mesh.computeWorldMatrix(true);
  const head = scene.pickWithRay(
    new Ray(new Vector3(0, 1.8, -17), Vector3.Forward(), 5),
    (m) => m.isEnabled() && m.metadata?.entity === e,
  );
  assert.equal(head?.pickedMesh?.metadata?.head, true);
  const body = scene.pickWithRay(
    new Ray(new Vector3(0, 1.1, -17), Vector3.Forward(), 5),
    (m) => m.isEnabled() && m.metadata?.entity === e,
  );
  assert.equal(body?.pickedMesh?.metadata?.head, false);
  e.receiveDamage({
    damage: 999,
    source: "player",
    target: e.id,
    hitPoint: e.eye,
    hitNormal: Vector3.Up(),
    isHeadshot: false,
    damageType: "hitscan",
  });
  for (let i = 0; i < 100; i++) e.shutdown.update(1 / 60);
  for (const part of e.parts) {
    part.computeWorldMatrix(true);
    assert.ok(Number.isFinite(part.position.y));
    assert.ok(part.getBoundingInfo().boundingBox.minimumWorld.y >= -0.001);
  }
  const cast = level.shadows.getShadowMap()?.renderList ?? [];
  assert.ok(e.parts.filter((m) => cast.includes(m)).length <= 3);
  e.dispose();
  level.dispose();
  scene.dispose();
  engine.dispose();
});

test("automatic graphics preserves sharp resolution under load and adapts only effects", () => {
  const budget = new PerformanceBudget();
  budget.configure("high", true);
  assert.equal(budget.quality, "high");
  const native = budget.scaling(3840, 2160);
  assert.equal(
    native,
    1,
    "4K viewports must not be stretched from a 540p/720p buffer",
  );
  assert.equal(budget.scaling(1920, 1080, 2), 1 / 1.5);
  for (let i = 0; i < 100; i++) budget.sample(40);
  assert.equal(budget.quality, "low");
  assert.equal(
    budget.scaling(3840, 2160),
    native,
    "automatic adaptation must never blur the framebuffer",
  );
  for (let i = 0; i < 1000; i++) budget.sample(100);
  assert.equal(budget.scaling(3840, 2160), native);
  for (let i = 0; i < 1500; i++) budget.sample(16);
  assert.equal(
    budget.quality,
    "high",
    "healthy frames recover the selected effects level",
  );
  budget.configure("high", false);
  for (let i = 0; i < 200; i++) assert.equal(budget.sample(100), false);
  assert.equal(budget.quality, "high");
  budget.configure("low", true);
  for (let i = 0; i < 1000; i++) budget.sample(16);
  assert.equal(budget.quality, "low");
  assert.equal(budget.scaling(1920, 1080), 1);
  budget.configure("medium", true);
  assert.equal(budget.sample(5000), false);
  for (let i = 0; i < 8; i++) budget.sample(500);
  assert.equal(budget.quality, "low");
  assert.equal(budget.scaling(1920, 1080, NaN), 1);
});

test("legacy graphics preferences keep sensitivity but enable automatic performance control", () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => JSON.stringify({ quality: "high", sensitivity: 1.7 }),
      },
    });
    const settings = loadSettings();
    assert.equal(settings.quality, "high");
    assert.equal(settings.autoGraphics, true);
    assert.equal(settings.sensitivity, 1.7);
    assert.equal(defaults.quality, "medium");
  } finally {
    if (before) Object.defineProperty(globalThis, "localStorage", before);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
