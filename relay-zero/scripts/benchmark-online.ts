import { NullEngine, Scene, Vector3, Ray } from "@babylonjs/core";
import { Level } from "../src/world/Level";
import { Navigation } from "../src/ai/Navigation";
import { Player } from "../src/player/Player";
import { Weapon } from "../src/weapons/Weapon";
import { Effects } from "../src/effects/Effects";
import { defaults } from "../src/core/Settings";
import { OnlineArena } from "../src/multiplayer/OnlineArena";
import { pickWorld } from "../src/world/WorldQuery";
class GeometryLevel extends Level {
  override sign(): void {}
}
let seed = 1234;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
Math.random = random;
const stats = (a: number[]) => {
  a.sort((x, y) => x - y);
  return {
    median: +a[Math.floor(a.length * 0.5)].toFixed(3),
    p95: +a[Math.floor(a.length * 0.95)].toFixed(3),
  };
};
const engine = new NullEngine(),
  scene = new Scene(engine),
  level = new GeometryLevel(scene),
  navigation = new Navigation(level);
level.optimize();
const input: any = {
  locked: false,
  dx: 0,
  dy: 0,
  wheel: 0,
  fire: false,
  ads: false,
  down: () => false,
  consume: () => false,
  clear: () => {},
  endFrame: () => {},
};
const player = new Player(scene, input, { ...defaults }),
  effects = new Effects(scene),
  audio: any = { play: () => {} },
  weapon = new Weapon(scene, player, audio, effects);
const hud: any = {
  selectedMap: "foundry",
  root: { classList: { add: () => {}, remove: () => {} } },
  el: () => ({ style: {}, classList: { toggle: () => {} } }),
  set: () => {},
  show: () => {},
  toast: () => {},
  hit: () => {},
  damage: () => {},
  tick: () => {},
};
const game: any = {
  engine,
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
let boxChecks = 0;
const original = Ray.prototype.intersectsBoxMinMax;
Ray.prototype.intersectsBoxMinMax = function (
  ...args: Parameters<typeof original>
) {
  boxChecks++;
  return original.apply(this, args);
};
const rays = Array.from(
  { length: 4000 },
  (_, i) =>
    new Ray(
      new Vector3(random() * 40 - 20, random() * 4 + 0.35, random() * 40 - 20),
      i % 2 === 0
        ? Vector3.Down()
        : new Vector3(
            random() - 0.5,
            random() - 0.5,
            random() - 0.5,
          ).normalize(),
      i % 2 === 0 ? 1.8 : 40,
    ),
);
for (const ray of rays) pickWorld(scene, ray);
boxChecks = 0;
const queryTimes: number[] = [];
for (let batch = 0; batch < 10; batch++) {
  const t = performance.now();
  for (const ray of rays) pickWorld(scene, ray);
  queryTimes.push(performance.now() - t);
}
console.log(
  JSON.stringify({
    scenario: "4000 world rays",
    batchMs: stats(queryTimes),
    boxChecksPerBatch: boxChecks / 10,
  }),
);
const arena: any = Object.create(OnlineArena.prototype);
Object.assign(arena, {
  game,
  client: { role: "host", send: () => {} },
  lobby: { hidden: false },
  enemies: new Map(),
  replicaTargets: new Map(),
});
arena.start("coop", "foundry");
arena.begun = true;
arena.remote.p = [2, 0, 18];
arena.nextWave();
for (let i = 0; i < 6; i++) arena.spawnBot();
arena.pending = 0;
arena.damage = () => {};
let los = 0;
const lineClear = level.lineClear.bind(level);
level.lineClear = (...args) => {
  los++;
  return lineClear(...args);
};
const times: number[] = [];
let rawBytes = 0,
  compactBytes = 0,
  snapshots = 0;
boxChecks = los = 0;
for (let i = 0; i < 720; i++) {
  const t = performance.now();
  arena.clock += 1 / 60;
  arena.hostUpdate(1 / 60);
  if (i % 4 === 0) {
    const state = arena.state();
    compactBytes += JSON.stringify(state).length;
    const raw = {
      ...state,
      enemies: [...arena.enemies.values()].map((e: any) => ({
        id: e.id,
        p: e.position.asArray(),
        y: e.root.rotation.y,
        hp: e.health,
        max: e.maxHealth,
        role: e.role,
        elite: e.elite,
        shield: e.shieldHealth,
        animation: e.animation,
      })),
    };
    rawBytes += JSON.stringify(raw).length;
    snapshots++;
  }
  scene.render();
  if (i >= 120) times.push(performance.now() - t);
  if (i === 119) boxChecks = los = 0;
}
console.log(
  JSON.stringify({
    scenario: "6-bot co-op host",
    frameCPUms: stats(times),
    losPerSecond: los / 10,
    boxChecksPerSecond: boxChecks / 10,
    snapshotBytes: {
      raw: Math.round(rawBytes / snapshots),
      compact: Math.round(compactBytes / snapshots),
    },
  }),
);
arena.avatar.dispose();
for (const e of arena.enemies.values()) e.dispose();
scene.dispose();
engine.dispose();
