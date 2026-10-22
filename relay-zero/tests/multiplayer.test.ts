import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine, Scene, Vector3 } from "@babylonjs/core";
import { PoseBudget } from "../src/multiplayer/NetworkBudget";
import { OnlineArena } from "../src/multiplayer/OnlineArena";
import { rayBox, ShotGate, finiteVector } from "../src/multiplayer/Combat";
import { Level } from "../src/world/Level";
import { Navigation } from "../src/ai/Navigation";
import { Player } from "../src/player/Player";
import { Weapon } from "../src/weapons/Weapon";
import { Effects } from "../src/effects/Effects";
import { defaults } from "../src/core/Settings";
class GeometryLevel extends Level {
  override sign(): void {}
}
function fixture(
  mode: "duel" | "coop" = "duel",
  role: "host" | "guest" = "host",
) {
  const engine = new NullEngine(),
    scene = new Scene(engine),
    level = new GeometryLevel(scene),
    navigation = new Navigation(level);
  const input: any = {
    locked: false,
    dx: 0,
    dy: 0,
    wheel: 0,
    fire: false,
    ads: false,
    firePressed: false,
    down: () => false,
    consume: () => false,
    clear: () => {},
    endFrame: () => {},
  };
  const player = new Player(scene, input, { ...defaults });
  const effects = new Effects(scene);
  const audio: any = { play: () => {} };
  const weapon = new Weapon(scene, player, audio, effects);
  const output: any[] = [];
  const hits: any[] = [];
  const damage: any[] = [];
  const elements = new Map();
  const hud: any = {
    selectedMap: "foundry",
    root: { classList: { add: () => {}, remove: () => {} } },
    el: (id: string) => {
      if (!elements.has(id))
        elements.set(id, {
          style: {},
          classList: { toggle: () => {} },
          hidden: false,
        });
      return elements.get(id);
    },
    set: () => {},
    show: () => {},
    toast: () => {},
    hit: (...a: any[]) => hits.push(a),
    damage: (...a: any[]) => damage.push(a),
    tick: () => {},
  };
  const game: any = {
    scene,
    level,
    navigation,
    player,
    weapon,
    effects,
    input,
    audio,
    hud,
    exitToMenu: () => {},
    selectMap: () => {},
    updateHUD: () => {},
  };
  const arena: any = Object.create(OnlineArena.prototype);
  Object.assign(arena, {
    game,
    client: { role, send: (m: any) => output.push(m) },
    lobby: { hidden: false },
    enemies: new Map(),
    replicaTargets: new Map(),
  });
  arena.start(mode, "foundry");
  arena.begun = true;
  arena.protect = [0, 0];
  arena.remote.p = [-2, 0, -9];
  arena.avatar.place(new Vector3(-2, 0, -9), Math.PI, true);
  return {
    arena,
    game,
    output,
    hits,
    damage,
    dispose: () => {
      arena.avatar.dispose();
      for (const e of arena.enemies.values()) e.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
test("ray hit validation handles parallel rays, misses, range and non-finite poses", () => {
  assert.equal(rayBox([0, 1, 0], [0, 0, 1], [-1, 0, 5], [1, 2, 7], 10), 5);
  assert.equal(rayBox([2, 1, 0], [0, 0, 1], [-1, 0, 5], [1, 2, 7], 10), null);
  assert.equal(rayBox([0, 1, 0], [0, 0, 1], [-1, 0, 5], [1, 2, 7], 4), null);
  assert.equal(finiteVector([0, Infinity, 0]), false);
  const gate = new ShotGate();
  assert.equal(gate.accept(1, 1, 10), true);
  assert.equal(gate.accept(1, 2, 10), false);
  assert.equal(gate.accept(2, 1.02, 10), false);
  assert.equal(gate.accept(2, 1.11, 10), true);
});
test("duel hits reduce shared health, duplicate shots are ignored, deaths respawn and five kills finish", () => {
  const f = fixture();
  try {
    const a = f.arena;
    const shot = (seq: number) => ({
      o: f.game.player.camera.position.asArray(),
      d: [0, 0, 1],
      weapon: "ar7",
      seq,
    });
    a.shoot(0, shot(1));
    assert.ok(a.hp[1] < 100);
    const hp = a.hp[1];
    a.shoot(0, shot(1));
    assert.equal(a.hp[1], hp);
    a.clock = 0.12;
    a.shoot(0, shot(2));
    assert.equal(a.hp[1], 0);
    assert.equal(a.scores[0], 1);
    a.hostUpdate(3);
    assert.equal(a.hp[1], 100);
    assert.equal(a.epochs[1], 1);
    assert.equal(a.protect[1], 2);
    a.scores[0] = 4;
    a.protect[1] = 0;
    a.damage(1, 100, Vector3.Zero());
    assert.equal(a.ended, true);
    assert.equal(f.output.at(-1).event, "end");
    assert.equal(f.output.at(-2).type, "state");
  } finally {
    f.dispose();
  }
});
test("authority rejects wall penetration, distant origins and unowned weapons", () => {
  const f = fixture();
  try {
    const a = f.arena;
    f.game.player.resetAt(new Vector3(-12, 0, -10));
    a.remote.p = [-12, 0, 18];
    const o = f.game.player.camera.position.asArray();
    a.shoot(0, { o, d: [0, 0, 1], weapon: "ar7", seq: 1 });
    assert.equal(a.hp[1], 100);
    a.clock = 1;
    a.shoot(0, { o: [0, 1, 17], d: [0, 0, 1], weapon: "ar7", seq: 2 });
    assert.equal(a.hp[1], 100);
    a.shoot(0, { o, d: [0, 0, 1], weapon: "l5", seq: 3 });
    assert.equal(a.hp[1], 100);
  } finally {
    f.dispose();
  }
});
test("co-op allows a living guest to revive the host, and a team wipe ends the mission", () => {
  const f = fixture("coop");
  try {
    const a = f.arena;
    a.hp = [0, 100];
    a.wait = 0;
    a.remote.p = [-2, 0, -16];
    a.remote.revive = true;
    a.hostUpdate(2);
    assert.equal(a.hp[0], 50);
    assert.equal(a.revive, 0);
    a.protect = [0, 0];
    a.damage(0, 100, Vector3.Zero());
    a.damage(1, 100, Vector3.Zero());
    assert.equal(a.ended, true);
    assert.equal(f.output.at(-1).won, false);
  } finally {
    f.dispose();
  }
});
test("co-op finishes after five cleared waves and replenishes both players", () => {
  const f = fixture("coop");
  try {
    const a = f.arena;
    a.hp = [10, 0];
    a.nextWave();
    assert.deepEqual(a.hp, [35, 100]);
    assert.equal(a.wave, 1);
    assert.equal(a.pending, 6);
    a.wave = 5;
    a.nextWave();
    assert.equal(a.ended, true);
    assert.equal(f.output.at(-1).won, true);
  } finally {
    f.dispose();
  }
});

test("guest applies authoritative AI snapshots, shared scores and respawn epochs", () => {
  const host = fixture("coop"),
    guest = fixture("coop", "guest");
  try {
    host.arena.nextWave();
    host.arena.spawnBot();
    guest.arena.applyState(host.arena.state());
    assert.equal(guest.arena.enemies.size, 1);
    const bot = [...host.arena.enemies.values()][0] as any;
    bot.receiveDamage({
      damage: 99999,
      source: "player",
      target: bot.id,
      hitPoint: bot.eye,
      hitNormal: Vector3.Up(),
      isHeadshot: false,
      damageType: "hitscan",
    });
    host.arena.hp = [75, 32];
    host.arena.scores = [2, 3];
    guest.arena.applyState(host.arena.state());
    assert.equal([...guest.arena.enemies.values()][0].health, 0);
    assert.deepEqual(guest.arena.scores, [2, 3]);
    host.arena.respawnPlayer(1);
    guest.game.player.resetAt(new Vector3(12, 0, -15));
    guest.arena.applyState(host.arena.state());
    assert.ok(guest.game.player.feet.equals(new Vector3(2, 0, 18)));
    assert.equal(guest.game.player.health, 100);
  } finally {
    host.dispose();
    guest.dispose();
  }
});

test("idle network poses keep a heartbeat while movement and revive changes send immediately", () => {
  const budget = new PoseBudget(),
    pose = {
      p: [0, 0, 0] as [number, number, number],
      y: 0,
      pitch: 0,
      crouch: false,
      revive: false,
    };
  assert.equal(budget.accept(pose, 0), true);
  for (let frame = 1; frame < 15; frame++)
    assert.equal(budget.accept(pose, frame / 15), false);
  assert.equal(budget.accept(pose, 1), true);
  pose.p[0] = 0.001;
  assert.equal(budget.accept(pose, 1.05), true);
  pose.revive = true;
  assert.equal(budget.accept(pose, 1.1), true);
  pose.revive = false;
  assert.equal(budget.accept(pose, 1.15), true);
});
test("cached co-op targets invalidate immediately when a player goes down and dead robots skip sight tests", () => {
  const f = fixture("coop");
  try {
    f.arena.nextWave();
    f.arena.spawnBot();
    const bot = [...f.arena.enemies.values()][0] as any;
    let checks = 0;
    const clear = f.game.level.lineClear.bind(f.game.level);
    f.game.level.lineClear = (...args: any[]) => {
      checks++;
      return clear(...args);
    };
    f.arena.clock = 1;
    const first = f.arena.target(bot);
    assert.equal(checks, 2);
    f.arena.clock = 1.05;
    assert.equal(f.arena.target(bot), first);
    assert.equal(checks, 2);
    f.arena.hp[first] = 0;
    assert.equal(f.arena.target(bot), 1 - first);
    f.arena.hp = [100, 100];
    f.arena.clock = 1.3;
    f.arena.target(bot);
    assert.equal(checks, 4);
    bot.receiveDamage({
      damage: 99999,
      source: "player",
      target: bot.id,
      hitPoint: bot.eye,
      hitNormal: Vector3.Up(),
      isHeadshot: false,
      damageType: "hitscan",
    });
    checks = 0;
    f.arena.pending = 0;
    f.arena.hostUpdate(1 / 60);
    assert.equal(checks, 0);
  } finally {
    f.dispose();
  }
});
