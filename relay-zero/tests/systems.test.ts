import test from "node:test";
import assert from "node:assert/strict";
import { Magazine, rifle } from "../src/weapons/WeaponData";
import { Health } from "../src/combat/Damage";
import { NullEngine, Scene, Vector3, MeshBuilder, Ray } from "@babylonjs/core";
test("partial reload transfers only missing rounds", () => {
  const m = new Magazine(rifle);
  m.ammo = 8;
  m.reserve = 50;
  assert.equal(m.reload(), true);
  m.update(2);
  assert.equal(m.ammo, 30);
  assert.equal(m.reserve, 28);
});
test("reload guards and low reserves conserve ammunition", () => {
  const m = new Magazine(rifle);
  assert.equal(m.reload(), false);
  m.ammo = 2;
  m.reserve = 3;
  assert.equal(m.reload(), true);
  assert.equal(m.reload(), false);
  m.update(2);
  assert.equal(m.ammo, 5);
  assert.equal(m.reserve, 0);
  assert.equal(m.reload(), false);
});
test("lethal damage fires death once and cannot make health negative", () => {
  const h = new Health("target", 100),
    d = {
      damage: 120,
      source: "p",
      target: "target",
      hitPoint: Vector3.Zero(),
      hitNormal: Vector3.Up(),
      isHeadshot: false,
      damageType: "hitscan" as const,
    };
  assert.equal(h.receiveDamage(d), true);
  assert.equal(h.health, 0);
  assert.equal(h.receiveDamage(d), false);
});
test("hitscan selects separate head box and respects foreground occluder", () => {
  const engine = new NullEngine();
  const s = new Scene(engine);
  const head = MeshBuilder.CreateBox("head", { size: 0.4 }, s);
  head.position.set(0, 1.8, 8);
  head.computeWorldMatrix(true);
  const ray = new Ray(new Vector3(0, 1.8, 0), Vector3.Forward(), 100);
  assert.equal(s.pickWithRay(ray)?.pickedMesh, head);
  const wall = MeshBuilder.CreateBox(
    "wall",
    { width: 3, height: 3, depth: 1 },
    s,
  );
  wall.position.set(0, 1.5, 4);
  wall.computeWorldMatrix(true);
  assert.equal(s.pickWithRay(ray)?.pickedMesh, wall);
  s.dispose();
  engine.dispose();
});
import { Waves, WAVE_COUNTS } from "../src/core/Waves";
import { Player } from "../src/player/Player";
import { PlayerInput } from "../src/player/PlayerInput";
import { defaults } from "../src/core/Settings";
test("all five waves progress once, final victory and restart reset", () => {
  const waves = new Waves();
  const spawned: number[] = [];
  let victories = 0;
  waves.onWave = (_, n) => spawned.push(n);
  waves.onVictory = () => victories++;
  waves.reset();
  waves.update(3.1);
  for (let w = 0; w < WAVE_COUNTS.length; w++) {
    for (let i = 0; i < WAVE_COUNTS[w]; i++) waves.kill();
    waves.update(10);
  }
  assert.deepEqual(spawned, WAVE_COUNTS);
  assert.equal(victories, 1);
  waves.kill();
  assert.equal(victories, 1);
  waves.reset();
  assert.equal(waves.complete, false);
  assert.equal(waves.index, 0);
});
function inputFixture() {
  const keys = new Set<string>(),
    pressed = new Set<string>();
  return {
    keys,
    pressed,
    dx: 0,
    dy: 0,
    ads: false,
    down: (k: string) => keys.has(k),
    consume: (k: string) => {
      const has = pressed.has(k);
      pressed.delete(k);
      return has;
    },
  };
}
test("player grounds, moves, stops, jumps, lands, crouches, and slides against walls", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  scene.collisionsEnabled = true;
  const floor = MeshBuilder.CreateBox(
    "floor",
    { width: 50, height: 1, depth: 50 },
    scene,
  );
  floor.position.y = -0.5;
  floor.checkCollisions = true;
  floor.metadata = { world: true };
  const wall = MeshBuilder.CreateBox(
    "wall",
    { width: 20, height: 5, depth: 1 },
    scene,
  );
  wall.position.set(0, 2.5, 3);
  wall.checkCollisions = true;
  wall.metadata = { world: true };
  const input = inputFixture();
  const player = new Player(scene, input as unknown as PlayerInput, {
    ...defaults,
  });
  player.resetAt(Vector3.Zero());
  const step = (frames: number) => {
    for (let i = 0; i < frames; i++) {
      player.update(1 / 60, false);
      scene.render();
    }
  };
  step(10);
  assert.equal(player.grounded, true);
  input.keys.add("KeyW");
  step(20);
  assert.ok(player.feet.z > 0.5);
  input.keys.clear();
  step(30);
  assert.ok(Math.abs(player.velocity.z) < 0.01);
  input.pressed.add("Space");
  step(10);
  assert.ok(player.feet.y > 0.3);
  step(100);
  assert.ok(Math.abs(player.feet.y) < 0.15);
  input.keys.add("KeyC");
  step(20);
  assert.equal(player.crouched, true);
  assert.ok(player.eye < 1.2);
  input.keys.clear();
  input.keys.add("KeyW");
  step(180);
  assert.ok(player.feet.z < 2.3, "cannot cross wall");
  input.keys.add("KeyD");
  const before = player.feet.x;
  step(50);
  assert.ok(player.feet.x > before + 1, "slides along wall");
  scene.dispose();
  engine.dispose();
});
import { Level } from "../src/world/Level";
import { Navigation } from "../src/ai/Navigation";
import { Enemy, enemyConfig } from "../src/ai/Enemy";
import { Weapon } from "../src/weapons/Weapon";
import { Effects } from "../src/effects/Effects";
import { Audio } from "../src/audio/Audio";
import { Target } from "../src/ai/Target";
class GeometryLevel extends Level {
  override sign(): void {
    /* Dynamic text needs a browser canvas; collision geometry is unchanged. */
  }
}
test("actual arena provides routes from every spawn without placing enemies inside cover", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const level = new GeometryLevel(scene);
  for (const m of scene.meshes) m.computeWorldMatrix(true);
  const nav = new Navigation(level);
  for (const spawn of level.enemySpawns) {
    const [x, z] = nav.cellOf(spawn);
    assert.equal(
      nav.blocked.has(z * nav.size + x),
      false,
      `blocked spawn ${spawn}`,
    );
    assert.ok(nav.route(spawn, level.spawn).length > 0, `no route ${spawn}`);
  }
  scene.dispose();
  engine.dispose();
});
test("weapon camera hitscan damages head, emits feedback, consumes rounds, and a wall prevents damage", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const input = inputFixture();
  const player = new Player(scene, input as unknown as PlayerInput, {
    ...defaults,
  });
  player.resetAt(Vector3.Zero());
  const effects = new Effects(scene);
  const weapon = new Weapon(
    scene,
    player,
    { play: () => {} } as unknown as Audio,
    effects,
  );
  const target = new Target(scene, new Vector3(0, 0, 8));
  weapon.spread = 0;
  let feedback = 0;
  weapon.onHit = (head) => {
    assert.equal(head, true);
    feedback++;
  };
  scene.render();
  weapon.fire();
  assert.ok(target.health < 50);
  assert.equal(feedback, 1);
  assert.equal(weapon.mag.ammo, 29);
  const wall = MeshBuilder.CreateBox(
    "occluder",
    { width: 5, height: 4, depth: 1 },
    scene,
  );
  wall.position.set(0, 2, 4);
  wall.metadata = { world: true };
  scene.render();
  const hp = target.health;
  weapon.fire();
  assert.equal(target.health, hp);
  assert.equal(feedback, 1);
  scene.dispose();
  engine.dispose();
});
test("enemy vision is blocked by walls and damage/death is stable", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const level = new GeometryLevel(scene);
  for (const m of scene.meshes) m.computeWorldMatrix(true);
  const nav = new Navigation(level);
  const player = new Player(scene, inputFixture() as unknown as PlayerInput, {
    ...defaults,
  });
  player.resetAt(new Vector3(0, 0, -17));
  const e = new Enemy(
    scene,
    level,
    nav,
    enemyConfig(1),
    new Vector3(0, 0, 17),
    "test",
  );
  e.root.rotation.y = Math.PI;
  e.think = 0;
  e.update(0.13, player, [e]);
  assert.notEqual(e.state, "Attack");
  e.hear(player.feet, 40);
  assert.equal(e.state, "Investigate");
  const damage = {
    damage: 999,
    source: "p",
    target: "test",
    hitPoint: e.eye,
    hitNormal: Vector3.Up(),
    isHeadshot: true,
    damageType: "hitscan" as const,
  };
  assert.equal(e.receiveDamage(damage), true);
  assert.equal(e.state, "Dead");
  assert.equal(e.receiveDamage(damage), false);
  assert.equal(e.state, "Dead");
  e.dispose();
  scene.dispose();
  engine.dispose();
});

test("ground release stops within one frame, direction switches immediately, airborne momentum remains", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  scene.collisionsEnabled = true;
  const floor = MeshBuilder.CreateBox(
    "floor",
    { width: 100, height: 1, depth: 100 },
    scene,
  );
  floor.position.y = -0.5;
  floor.checkCollisions = true;
  floor.metadata = { world: true };
  const input = inputFixture();
  const player = new Player(scene, input as unknown as PlayerInput, {
    ...defaults,
  });
  player.resetAt(Vector3.Zero());
  const frame = () => {
    player.update(1 / 60, false);
    scene.render();
  };
  for (const sprint of [false, true]) {
    input.keys.add("KeyW");
    if (sprint) input.keys.add("ShiftLeft");
    for (let i = 0; i < 15; i++) frame();
    const stoppedAt = player.feet.clone();
    input.keys.clear();
    frame();
    assert.equal(player.velocity.x, 0);
    assert.equal(player.velocity.z, 0);
    assert.ok(
      Math.abs(player.feet.z - stoppedAt.z) < 0.00001,
      "no drift after release",
    );
  }
  input.keys.add("KeyW");
  frame();
  input.keys.delete("KeyW");
  input.keys.add("KeyS");
  frame();
  assert.ok(player.velocity.z < 0, "reverse on first frame");
  input.keys.clear();
  input.keys.add("KeyW");
  input.pressed.add("Space");
  frame();
  const momentum = player.velocity.z;
  input.keys.clear();
  frame();
  assert.equal(player.grounded, false);
  assert.equal(player.velocity.z, momentum);
  scene.dispose();
  engine.dispose();
});

import { difficulties } from "../src/core/Difficulty";
test("each difficulty uses its own waves, rest period and one final victory", () => {
  for (const difficulty of Object.values(difficulties)) {
    const waves = new Waves();
    let victories = 0;
    const counts: number[] = [];
    waves.onWave = (_, count) => counts.push(count);
    waves.onVictory = () => victories++;
    waves.reset(difficulty.waves, difficulty.rest);
    waves.update(3.1);
    for (let w = 0; w < 5; w++) {
      for (let n = 0; n < difficulty.waves[w]; n++) {
        if (n === waves.spawned) waves.update(7.1);
        waves.kill();
      }
      if (w < 4) {
        assert.equal(waves.intermission, difficulty.rest);
        waves.update(difficulty.rest + 0.1);
      }
    }
    assert.deepEqual(counts, difficulty.waves);
    assert.equal(victories, 1);
    waves.reset(difficulty.waves, difficulty.rest);
    assert.equal(waves.index, 0);
    assert.equal(waves.complete, false);
  }
});
test("difficulty increases pressure while keeping accuracy imperfect and reaction readable", () => {
  const tiers = Object.values(difficulties);
  for (let wave = 1; wave <= 5; wave++)
    for (const elite of [false, true]) {
      const configs = tiers.map((d) => enemyConfig(wave, elite, d));
      for (let i = 1; i < configs.length; i++) {
        assert.ok(configs[i].damage > configs[i - 1].damage);
        assert.ok(configs[i].accuracy >= configs[i - 1].accuracy);
        assert.ok(configs[i].reactionTime <= configs[i - 1].reactionTime);
        assert.ok(configs[i].moveSpeed > configs[i - 1].moveSpeed);
        assert.ok(configs[i].burstPause < configs[i - 1].burstPause);
      }
      for (const c of configs) {
        assert.ok(c.accuracy < 1);
        assert.ok(c.reactionTime >= 0.22);
      }
    }
  assert.equal(difficulties.nightmare.recovery, 0);
});
