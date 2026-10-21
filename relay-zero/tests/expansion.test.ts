import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine, Scene, Vector3, MeshBuilder } from "@babylonjs/core";
import { Level } from "../src/world/Level";
import { Navigation } from "../src/ai/Navigation";
import { Enemy, enemyConfig, combatRole } from "../src/ai/Enemy";
import { Commander } from "../src/ai/Commander";
import { Sniper, Bomber } from "../src/ai/Specialists";
import { Player } from "../src/player/Player";
import type { PlayerInput } from "../src/player/PlayerInput";
import { defaults } from "../src/core/Settings";
import { difficulties } from "../src/core/Difficulty";
import { Equipment } from "../src/weapons/Equipment";
import { Wallet, smg, sniper } from "../src/weapons/Arsenal";
import { Weapon } from "../src/weapons/Weapon";
import { Effects } from "../src/effects/Effects";
import type { Audio } from "../src/audio/Audio";
import { ArenaDevices, PowerCell } from "../src/world/ArenaDevices";
import { objectivePoints } from "../src/world/ObjectiveMarker";
import type { MapId } from "../src/world/MapData";
import { Waves } from "../src/core/Waves";
import { EndlessRecords, Records, RunStats } from "../src/core/RunStats";
import { Game } from "../src/core/Game";

class GeometryLevel extends Level {
  override sign(): void {}
}
function fixture(map: MapId = "foundry") {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  const level = new GeometryLevel(scene, map),
    nav = new Navigation(level);
  const pressed = new Set<string>(),
    held = new Set<string>();
  const input = {
    dx: 0,
    dy: 0,
    wheel: 0,
    fire: false,
    firePressed: false,
    ads: false,
    down: (key: string) => held.has(key),
    consume: (key: string) => {
      const hit = pressed.has(key);
      pressed.delete(key);
      return hit;
    },
  } as unknown as PlayerInput;
  const player = new Player(scene, input, { ...defaults });
  player.resetAt(new Vector3(0, 0, -17));
  const audio = { play: () => {} } as unknown as Audio;
  const effects = new Effects(scene),
    weapon = new Weapon(scene, player, audio, effects);
  const bot = (
    role: "assault" | "support" | "bomber" | "sniper",
    pos = new Vector3(0, 0, -12),
  ) => {
    const Bot = role === "sniper" ? Sniper : role === "bomber" ? Bomber : Enemy;
    return new Bot(
      scene,
      level,
      nav,
      enemyConfig(3, false, difficulties.normal, role),
      pos,
      `test-${role}-${scene.meshes.length}`,
      false,
      role,
    );
  };
  return {
    engine,
    scene,
    level,
    nav,
    player,
    weapon,
    effects,
    audio,
    input,
    pressed,
    held,
    bot,
    dispose() {
      scene.dispose();
      engine.dispose();
    },
  };
}

test("dash moves in the requested direction, collides with thin walls, respects cooldown and resets", () => {
  const f = fixture();
  f.scene.render();
  const start = f.player.feet.clone();
  f.held.add("KeyD");
  f.pressed.add("AltLeft");
  for (let i = 0; i < 12; i++) {
    f.player.update(1 / 60, false);
    f.scene.render();
  }
  assert.ok(f.player.feet.x - start.x > 3);
  assert.ok(f.player.dash.cooldown > 3);
  assert.equal(f.player.dash.start(Vector3.Left()), false);
  f.player.resetAt(start);
  f.held.clear();
  const wall = f.level.box(
    "thin wall",
    new Vector3(0, 1.5, -15.8),
    new Vector3(6, 3, 0.1),
    f.level.material("test wall", "#777777"),
  );
  wall.computeWorldMatrix(true);
  f.pressed.add("AltLeft");
  for (let i = 0; i < 12; i++) {
    f.player.update(1 / 60, false);
    f.scene.render();
  }
  assert.ok(f.player.feet.z < -16, `dash crossed a wall: ${f.player.feet.z}`);
  f.player.resetAt(start);
  assert.equal(f.player.dash.cooldown, 0);
  f.dispose();
});

test("EMP requires ammunition, purchases obey capacity, and pause leaves the fuse unchanged", () => {
  const f = fixture(),
    equipment = new Equipment(f.scene, f.level),
    wallet = new Wallet();
  wallet.coins = 250;
  assert.equal(equipment.buy(wallet), true);
  assert.equal(wallet.coins, 150);
  assert.equal(equipment.buy(wallet), false);
  assert.equal(
    equipment.throw(f.player.camera.position, Vector3.Forward()),
    true,
  );
  assert.equal(equipment.ammo, 2);
  assert.equal(
    equipment.throw(f.player.camera.position, Vector3.Forward()),
    false,
  );
  const projectile = f.scene.getMeshByName("EMP grenade")!;
  const before = projectile.position.clone();
  assert.deepEqual(projectile.position, before);
  equipment.update(0.6, []);
  assert.ok(Vector3.DistanceSquared(projectile.position, before) > 1);
  equipment.reset();
  assert.equal(f.scene.getMeshByName("EMP grenade"), null);
  assert.equal(equipment.ammo, 2);
  f.dispose();
});

test("EMP stops perception, movement and repairs, cannot cross walls, and interrupts the commander", () => {
  const f = fixture(),
    support = f.bot("support", new Vector3(-2, 0, -17)),
    ally = f.bot("assault", new Vector3(-1, 0, -17)),
    hidden = f.bot("assault", new Vector3(2, 0, -17));
  const wall = f.level.box(
    "EMP occluder",
    new Vector3(0, 2, -17),
    new Vector3(0.3, 4, 8),
    f.level.material("test wall", "#777777"),
  );
  for (const mesh of f.scene.meshes) mesh.computeWorldMatrix(true);
  const equipment = new Equipment(f.scene, f.level);
  assert.equal(
    equipment.detonate(new Vector3(-3, 1.4, -17), [support, ally, hidden]),
    2,
  );
  ally.health -= 30;
  support.repairClock = 0;
  const health = ally.health,
    position = support.position.clone();
  support.update(1, f.player, [support, ally]);
  assert.equal(ally.health, health);
  assert.ok(support.position.equalsWithEpsilon(position));
  assert.equal(hidden.stunRemaining, 0);
  wall.dispose();
  const boss = new Commander(
    f.scene,
    f.level,
    f.nav,
    difficulties.normal,
    new Vector3(1, 0, -15),
    "boss",
  );
  boss.beginPulse(f.player.feet);
  boss.stun(3);
  assert.equal(boss.windupRemaining, 0);
  assert.equal(boss.warning.isEnabled(), false);
  assert.equal(boss.stunRemaining, 1.5);
  f.dispose();
});

test("grenade sweep bounces off walls and detonates without leaving projectile meshes", () => {
  const f = fixture(),
    equipment = new Equipment(f.scene, f.level);
  const wall = f.level.box(
    "grenade wall",
    new Vector3(0, 2, -14),
    new Vector3(8, 4, 0.2),
    f.level.material("test wall", "#777777"),
  );
  wall.computeWorldMatrix(true);
  equipment.throw(new Vector3(0, 1, -17), Vector3.Forward());
  for (let i = 0; i < 15; i++) equipment.update(0.05, []);
  assert.ok(f.scene.getMeshByName("EMP grenade")!.position.z < -14);
  for (let i = 0; i < 15; i++) equipment.update(0.05, []);
  assert.equal(f.scene.getMeshByName("EMP grenade"), null);
  equipment.reset();
  assert.ok(
    f.scene.meshes
      .filter((m) => m.name === "tactical pulse")
      .every((m) => !m.isEnabled()),
  );
  f.dispose();
});

test("specialists join later waves; sniper aim locks and visible warnings clear on stun/death", () => {
  assert.equal(combatRole(3, 1), "assault");
  assert.equal(combatRole(3, 2), "bomber");
  assert.equal(combatRole(4, 3), "sniper");
  const f = fixture(),
    s = f.bot("sniper") as Sniper,
    b = f.bot("bomber", new Vector3(0, 0, -15)) as Bomber;
  s.state = b.state = "Attack";
  s.root.rotation.y = b.root.rotation.y = Math.PI;
  s.think = b.think = 0;
  s.reaction = b.reaction = 0;
  s.onTelegraph = () => s.lockAim(f.player.camera.position);
  s.update(0.01, f.player, [s, b]);
  b.update(0.01, f.player, [s, b]);
  assert.equal(s.attackCue, 1.2);
  assert.equal(b.attackCue, 1);
  const locked = s.aimPoint.clone();
  f.player.camera.position.x += 2;
  assert.deepEqual(s.aimPoint, locked);
  assert.equal(
    f.scene.getMeshByName("sniper targeting laser")?.isEnabled(),
    true,
  );
  s.stun(3);
  b.stun(3);
  s.update(0.01, f.player, [s, b]);
  b.update(0.01, f.player, [s, b]);
  assert.equal(
    f.scene.getMeshByName("sniper targeting laser")?.isEnabled(),
    false,
  );
  assert.equal(
    f.scene.getMeshByName("bomber blast radius")?.isEnabled(),
    false,
  );
  s.dispose();
  b.dispose();
  assert.equal(f.scene.getMeshByName("sniper targeting laser"), null);
  f.dispose();
});

test("attachments enforce ownership, two slots and one charge, preserve ammo and reset on a new game", () => {
  const f = fixture(),
    wallet = new Wallet();
  wallet.coins = 3000;
  assert.equal(wallet.buyAttachment("s24", "magazine"), false);
  wallet.buy("s24");
  f.weapon.startLoadout("p12");
  f.weapon.equipPrimary(smg);
  f.weapon.mag.ammo = 7;
  f.weapon.mag.reserve = 50;
  assert.equal(wallet.buyAttachment("s24", "magazine"), true);
  const balance = wallet.coins;
  assert.equal(wallet.buyAttachment("s24", "magazine"), false);
  assert.equal(wallet.coins, balance);
  f.weapon.applyAttachments(wallet.upgrades);
  assert.equal(f.weapon.mag.ammo, 7);
  assert.equal(f.weapon.mag.data.magazineSize, 36);
  f.weapon.mag.reload();
  f.weapon.mag.update(2);
  assert.equal(f.weapon.mag.ammo, 36);
  assert.equal(f.weapon.mag.reserve, 21);
  assert.equal(wallet.buyAttachment("s24", "stabilizer"), true);
  assert.equal(wallet.buyAttachment("s24", "loader"), false);
  f.weapon.applyAttachments(wallet.upgrades);
  assert.ok(f.weapon.mag.data.verticalRecoil < smg.verticalRecoil);
  f.weapon.equipPrimary(sniper);
  f.weapon.equipPrimary(smg);
  assert.equal(f.weapon.mag.ammo, 36);
  assert.equal(f.weapon.mag.data.magazineSize, 36);
  f.weapon.startLoadout("p12");
  wallet.reset();
  f.weapon.equipPrimary(smg);
  assert.equal(f.weapon.mag.data.magazineSize, 24);
  assert.equal(wallet.upgrades.size, 0);
  f.dispose();
});

for (const map of ["foundry", "cargo", "nexus"] as const)
  test(`${map}: all devices spawn, routes stay reachable, barriers refuse occupied space and reopen`, () => {
    const f = fixture(map),
      mission = objectivePoints(f.nav, f.level),
      devices = new ArenaDevices(f.level, f.nav, mission);
    assert.equal(devices.cells.length, 3);
    assert.equal(devices.barriers.length, 2);
    for (const point of [...f.level.enemySpawns, ...mission])
      assert.ok(
        f.nav.route(f.level.spawn, point).length > 0,
        `route lost at ${point}`,
      );
    for (const barrier of devices.barriers) {
      const camera = barrier.control.position.add(new Vector3(0, 0.8, 0));
      assert.equal(devices.interact(camera, [barrier.mesh.position]), false);
      assert.equal(devices.interact(camera, []), true);
      assert.equal(barrier.mesh.isEnabled(), true);
      assert.equal(devices.interact(camera, []), false);
      const [x, z] = f.nav.cellOf(barrier.mesh.position);
      assert.equal(f.nav.blocked.has(z * f.nav.size + x), true);
      devices.update(6.1);
      assert.equal(barrier.mesh.isEnabled(), false);
      assert.equal(f.nav.blocked.has(z * f.nav.size + x), false);
      assert.equal(devices.interact(camera, []), false);
      devices.update(8.1);
      assert.equal(devices.interact(camera, []), true);
    }
    let explosions = 0;
    const cell = devices.cells[0];
    cell.onExplode = () => explosions++;
    const damage = {
      damage: 100,
      source: "player",
      target: cell.id,
      hitPoint: cell.mesh.position,
      hitNormal: Vector3.Up(),
      isHeadshot: false,
      damageType: "hitscan" as const,
    };
    cell.receiveDamage(damage);
    cell.receiveDamage(damage);
    assert.equal(explosions, 1);
    assert.equal(cell.mesh.isEnabled(), false);
    devices.reset();
    assert.equal(cell.health, 45);
    assert.equal(cell.mesh.isEnabled(), true);
    assert.ok(devices.barriers.every((b) => !b.mesh.isEnabled()));
    f.dispose();
  });

test("endless unlocks only after victory, scales beyond 100 waves with capped active groups, and resets", () => {
  const waves = new Waves();
  waves.reset([1, 1, 1, 1, 1], 0.5);
  let victories = 0;
  waves.onVictory = () => victories++;
  assert.equal(waves.continueEndless(), false);
  for (let i = 0; i < 5; i++) {
    waves.update(4);
    waves.kill();
  }
  assert.equal(victories, 1);
  assert.equal(waves.continueEndless(), true);
  assert.equal(waves.continueEndless(), false);
  for (let wave = 6; wave <= 105; wave++) {
    waves.update(1);
    assert.equal(waves.index, wave);
    assert.ok(waves.total <= 60);
    let active = waves.firstBatch;
    waves.onReinforcement = (_, count) => {
      active += count;
      assert.ok(active <= 12);
    };
    while (waves.remaining > 0) {
      if (active) {
        active--;
        waves.kill();
      } else waves.update(8);
    }
    assert.equal(waves.complete, false);
  }
  assert.equal(victories, 1);
  assert.ok(enemyConfig(40).health > enemyConfig(30).health);
  waves.reset();
  assert.equal(waves.endless, false);
  assert.equal(waves.pending, 0);
});

test("endless records are isolated from campaign, map and difficulty; blocked storage is tolerated", () => {
  const data = new Map<string, string>(),
    storage = () => ({
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
    });
  const endless = new EndlessRecords(storage),
    campaign = new Records(storage);
  campaign.save("foundry", "easy", 500, 100, true);
  endless.save("foundry", "easy", 200, 7);
  endless.save("foundry", "easy", 100, 9);
  assert.deepEqual(endless.get("foundry", "easy"), { score: 200, wave: 9 });
  assert.equal(campaign.get("foundry", "easy").score, 500);
  assert.equal(endless.get("cargo", "easy").score, 0);
  assert.equal(endless.get("foundry", "hard").wave, 0);
  assert.equal(
    new EndlessRecords(() => {
      throw new Error("blocked");
    }).save("foundry", "easy", 20, 6).saved,
    false,
  );
});

test("blast chains credit each robot once; self-destruction has no coin reward and lethal blasts precede victory", () => {
  const f = fixture(),
    bomber = f.bot("bomber", new Vector3(0, 0, -13)),
    ally = f.bot("assault", new Vector3(1, 0, -13));
  const game = Object.create(Game.prototype) as Game & Record<string, any>;
  Object.assign(game, {
    player: f.player,
    level: f.level,
    enemies: [bomber, ally],
    devices: { cells: [] },
    equipment: new Equipment(f.scene, f.level),
    effects: f.effects,
    audio: f.audio,
    hud: { elimination: () => {}, damage: () => {} },
    wallet: new Wallet(),
    difficulty: difficulties.normal,
    practice: false,
    finished: false,
    running: true,
    accounted: new Set(),
    pendingDeaths: 0,
    blasts: [],
    kills: 0,
    score: 0,
    stats: new RunStats(),
    waves: new Waves(),
  });
  game.waves.reset([2], 0.5);
  game.waves.update(4);
  let victory = false;
  game.waves.onVictory = () => {
    if (!game.finished) victory = true;
  };
  game.finish = () => {
    game.finished = true;
    game.running = false;
  };
  f.player.health = 10;
  // The shooter remains within blast radius of the last pair of enemies.
  f.player.resetAt(new Vector3(0, 0, -15));
  f.player.health = 10;
  bomber.health = 0;
  game["eliminate"](bomber, false, true);
  game["eliminate"](bomber, false, true);
  game["resolveBlasts"]();
  assert.equal(ally.health, 0);
  assert.equal(game.kills, 2);
  assert.equal(game.wallet.coins, 200);
  assert.equal(game.waves.remaining, 0);
  assert.equal(game.finished, true);
  assert.equal(victory, false);
  f.dispose();
});
