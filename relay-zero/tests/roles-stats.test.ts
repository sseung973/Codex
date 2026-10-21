import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine, Scene, Vector3, Ray, MeshBuilder } from "@babylonjs/core";
import { Enemy, enemyConfig, roleForSpawn } from "../src/ai/Enemy";
import { Level } from "../src/world/Level";
import { Navigation } from "../src/ai/Navigation";
import { RunStats, Records } from "../src/core/RunStats";
import { DamageInfo } from "../src/combat/Damage";
import type { Player } from "../src/player/Player";
import { Commander } from "../src/ai/Commander";
import { difficulties } from "../src/core/Difficulty";
class GeometryLevel extends Level {
  override sign(): void {}
}
const damage = (shield = false, amount = 30): DamageInfo => ({
  damage: amount,
  shield,
  source: "player",
  target: "bot",
  hitPoint: Vector3.Zero(),
  hitNormal: Vector3.Up(),
  isHeadshot: false,
  damageType: "hitscan",
});
function fixture() {
  const engine = new NullEngine(),
    scene = new Scene(engine),
    level = new GeometryLevel(scene),
    nav = new Navigation(level);
  const bot = (
    role: "assault" | "defender" | "support",
    pos = new Vector3(0, 0, -17),
  ) =>
    new Enemy(
      scene,
      level,
      nav,
      enemyConfig(1, false, undefined, role),
      pos,
      role,
      false,
      role,
    );
  return {
    engine,
    scene,
    level,
    bot,
    dispose: () => {
      scene.dispose();
      engine.dispose();
    },
  };
}
test("wave composition includes three distinct roles with faster close-range assault", () => {
  assert.deepEqual([0, 1, 2].map(roleForSpawn), [
    "assault",
    "defender",
    "support",
  ]);
  const assault = enemyConfig(1, false, undefined, "assault"),
    defender = enemyConfig(1, false, undefined, "defender");
  assert.ok(assault.moveSpeed > defender.moveSpeed);
  assert.ok(assault.range < defender.range);
});
test("shield intercepts front rays, leaves side exposed and breaks without a false kill", () => {
  const f = fixture(),
    e = f.bot("defender");
  e.root.rotation.y = 0;
  for (const m of f.scene.meshes) m.computeWorldMatrix(true);
  const cast = (origin: Vector3, direction: Vector3) =>
    f.scene.pickWithRay(
      new Ray(origin, direction, 10),
      (m) => m.isEnabled() && m.metadata?.entity === e,
    );
  assert.equal(
    cast(new Vector3(0, 1.1, -12), new Vector3(0, 0, -1))?.pickedMesh?.metadata
      .shield,
    true,
  );
  assert.notEqual(
    cast(new Vector3(4, 1.1, -17), new Vector3(-1, 0, 0))?.pickedMesh?.metadata
      .shield,
    true,
  );
  const hp = e.health;
  assert.equal(e.receiveDamage(damage(true, 120)), false);
  assert.equal(e.health, hp);
  assert.equal(e.shield?.isEnabled(), false);
  assert.notEqual(
    cast(new Vector3(0, 1.1, -12), new Vector3(0, 0, -1))?.pickedMesh?.metadata
      .shield,
    true,
  );
  e.receiveDamage(damage(false, 10));
  assert.equal(e.health, hp - 10);
  f.dispose();
});
test("support repair caps health, ignores self/dead targets and cannot cross walls", () => {
  const f = fixture(),
    support = f.bot("support", new Vector3(-2, 0, -17)),
    ally = f.bot("assault", new Vector3(2, 0, -17));
  let repairs = 0;
  support.onRepair = () => repairs++;
  ally.health = ally.maxHealth - 5;
  support.health -= 10;
  support.repair([support, ally]);
  assert.equal(ally.health, ally.maxHealth);
  assert.equal(support.health, support.maxHealth - 10);
  assert.equal(repairs, 1);
  ally.health = 0;
  support.repair([support, ally]);
  assert.equal(ally.health, 0);
  ally.health = 20;
  const wall = MeshBuilder.CreateBox(
    "wall",
    { width: 1, height: 4, depth: 3 },
    f.scene,
  );
  wall.position.set(0, 2, -17);
  wall.metadata = { world: true };
  for (const m of f.scene.meshes) m.computeWorldMatrix(true);
  support.repair([support, ally]);
  assert.equal(ally.health, 20);
  wall.dispose();
  ally.root.position.x = 12;
  support.repair([support, ally]);
  assert.equal(ally.health, 20);
  support.health = 0;
  ally.root.position.x = 2;
  support.repair([support, ally]);
  assert.equal(ally.health, 20);
  f.dispose();
});
test("guards move toward the active objective and attack only after a readable cue", () => {
  const f = fixture();
  const defender = f.bot("defender", new Vector3(0, 0, -12));
  const player = {
    camera: { position: new Vector3(0, 1.65, -17) },
    feet: new Vector3(0, 0, -17),
  } as Player;
  defender.setObjectiveTarget(new Vector3(0, 0, 5), "defend");
  assert.equal(defender.state, "Investigate");
  defender.think = 0;
  defender.update(.13, player, [defender]);
  assert.equal(defender.state, "Chase", "guard keeps moving while far from the zone");
  defender.setObjectiveTarget(undefined, "defend");
  defender.root.position.set(0, 0, -12);
  defender.body.position.set(0, .9, -12);
  defender.root.rotation.y = Math.PI;
  defender.state = "Attack";
  defender.think = defender.reaction = defender.fireClock = 0;
  let cues = 0, shots = 0;
  defender.onTelegraph = () => cues++;
  defender.onAttack = () => shots++;
  defender.update(.12, player, [defender]);
  assert.equal(cues, 1);
  assert.equal(shots, 0);
  for (let i = 0; i < 6; i++) defender.update(.12, player, [defender]);
  assert.equal(shots, 1);
  defender.dispose();
  f.dispose();
});
test("commander locks the warning location, opens a timed weakpoint, then closes it", () => {
  const f = fixture();
  const boss = new Commander(f.scene, f.level, new Navigation(f.level),
    difficulties.normal, new Vector3(0, 0, -12), "boss-test");
  const player = {
    camera: { position: new Vector3(0, 1.65, -17) },
    feet: new Vector3(0, 0, -17),
  } as Player;
  const marked = player.feet.clone();
  boss.beginPulse(marked);
  assert.equal(boss.warning.isEnabled(), true);
  assert.equal(boss.weakpoint.isEnabled(), false);
  const aimAtCore = () => {
    for (const mesh of boss.parts) mesh.computeWorldMatrix(true);
    return f.scene.pickWithRay(
      new Ray(new Vector3(0, 1.27, -17), Vector3.Forward(), 10),
      mesh => mesh.isEnabled() && mesh.metadata?.entity === boss,
    )?.pickedMesh?.metadata?.weakpoint === true;
  };
  assert.equal(aimAtCore(), false);
  player.feet.z = -21;
  player.camera.position.z = -21;
  let pulse: Vector3 | undefined;
  boss.onPulse = point => { pulse = point; };
  for (let i = 0; i < 12; i++) boss.update(.1, player, [boss]);
  assert.ok(pulse && Vector3.DistanceSquared(pulse, marked) < .01);
  assert.equal(boss.warning.isEnabled(), false);
  assert.equal(boss.weakpoint.isEnabled(), true);
  assert.equal(aimAtCore(), true, "exposed core must be reachable by camera hitscan");
  const before = boss.health;
  boss.receiveDamage({ ...damage(false, 20), weakpoint: true });
  assert.ok(before - boss.health > 25, "exposed core should reward accuracy");
  for (let i = 0; i < 23; i++) boss.update(.1, player, [boss]);
  assert.equal(boss.weakpoint.isEnabled(), false);
  assert.equal(aimAtCore(), false);
  boss.beginPulse(marked);
  boss.receiveDamage(damage(false, 9999));
  assert.equal(boss.warning.isEnabled(), false, "no lingering warning after defeat");
  boss.dispose();
  f.dispose();
});
test("statistics handle zero shots and report headshot share of damaging firearm hits", () => {
  const stats = new RunStats();
  assert.equal(stats.accuracy, 0);
  assert.equal(stats.headRatio, 0);
  stats.shots = 10;
  stats.hits = 4;
  stats.heads = 1;
  stats.blocked = 3;
  assert.equal(stats.accuracy, 40);
  assert.equal(stats.headRatio, 25);
});
test("records isolate map/difficulty and only completed victories update fastest clear", () => {
  const data = new Map<string, string>();
  const records = new Records(() => ({
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  }));
  records.save("foundry", "easy", 100, 200, true);
  records.save("foundry", "easy", 200, 50, false);
  assert.deepEqual(records.get("foundry", "easy"), {
    score: 200,
    clearTime: 200,
  });
  records.save("foundry", "easy", 80, 180, true);
  assert.deepEqual(records.get("foundry", "easy"), {
    score: 200,
    clearTime: 180,
  });
  assert.deepEqual(records.get("cargo", "easy"), { score: 0, clearTime: null });
  assert.deepEqual(records.get("foundry", "hard"), {
    score: 0,
    clearTime: null,
  });
  data.set(records.key("cargo", "easy"), "{broken");
  assert.equal(records.get("cargo", "easy").score, 0);
  data.set(records.key("cargo", "easy"), '{"score":"bad","clearTime":-1}');
  assert.equal(records.get("cargo", "easy").clearTime, null);
  const denied = new Records(() => {
    throw new Error("disabled");
  });
  assert.equal(denied.save("cargo", "easy", 20, 100, true).saved, false);
});
