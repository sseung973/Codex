import { NullEngine, Scene, Vector3 } from "@babylonjs/core";
import { Level } from "../src/world/Level";
import { Navigation } from "../src/ai/Navigation";
import { Enemy, enemyConfig, roleForSpawn } from "../src/ai/Enemy";
import { Player } from "../src/player/Player";
import { Weapon } from "../src/weapons/Weapon";
import { Effects } from "../src/effects/Effects";
import { defaults } from "../src/core/Settings";
import { ArenaDevices } from "../src/world/ArenaDevices";
import { objectivePoints } from "../src/world/ObjectiveMarker";
class GeometryLevel extends Level {
  override sign(): void {}
}
let seed = 1234;
Math.random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const engine = new NullEngine({
  renderWidth: 1280,
  renderHeight: 720,
  textureSize: 512,
  deterministicLockstep: false,
  lockstepMaxSteps: 4,
});
const scene = new Scene(engine),
  level = new GeometryLevel(scene),
  nav = new Navigation(level);
new ArenaDevices(level, nav, objectivePoints(nav, level));
const input: any = {
  dx: 0,
  dy: 0,
  wheel: 0,
  ads: false,
  fire: false,
  firePressed: false,
  down: () => false,
  consume: () => false,
};
const player = new Player(scene, input, { ...defaults });
player.resetAt(level.spawn);
const weapon = new Weapon(
  scene,
  player,
  { play: () => {} } as any,
  new Effects(scene),
);
weapon.startLoadout("p12");
if (process.argv.includes("--baked")) {
  (level as any).optimize?.();
  player.body.surroundingMeshes = level.solids;
}
let predicates = 0,
  rayCalls = 0;
const original = scene.pickWithRay.bind(scene);
scene.pickWithRay = ((ray: any, predicate: any, ...args: any[]) => {
  rayCalls++;
  return original(
    ray,
    (m: any) => {
      predicates++;
      return predicate ? predicate(m) : true;
    },
    ...args,
  );
}) as any;
for (const count of [0, 4, 12]) {
  const bots = Array.from(
    { length: count },
    (_, i) =>
      new Enemy(
        scene,
        level,
        nav,
        enemyConfig(5, false, undefined, roleForSpawn(i)),
        level.enemySpawns[i % level.enemySpawns.length].clone(),
        `b${count}-${i}`,
        false,
        roleForSpawn(i),
      ),
  );
  const times: number[] = [],
    logic: number[] = [],
    render: number[] = [];
  let peakMeshes = 0;
  predicates = rayCalls = 0;
  for (let frame = 0; frame < 240; frame++) {
    const start = performance.now();
    player.update(1 / 60, false);
    weapon.update(1 / 60);
    for (const e of bots) e.update(1 / 60, player, bots);
    const mid = performance.now();
    scene.render();
    const end = performance.now();
    if (frame >= 60) {
      times.push(end - start);
      logic.push(mid - start);
      render.push(end - mid);
    }
    peakMeshes = Math.max(peakMeshes, scene.getActiveMeshes().length);
  }
  const stats = (a: number[]) => {
    a.sort((a, b) => a - b);
    return {
      median: +a[Math.floor(a.length * 0.5)].toFixed(2),
      p95: +a[Math.floor(a.length * 0.95)].toFixed(2),
    };
  };
  console.log(
    JSON.stringify({
      bots: count,
      sceneMeshes: scene.meshes.length,
      peakActiveMeshes: peakMeshes,
      frameCPU: stats(times),
      logicCPU: stats(logic),
      renderCPU: stats(render),
      sceneRayCalls: rayCalls,
      sceneMeshChecks: predicates,
    }),
  );
  for (const e of bots) e.dispose();
}
scene.dispose();
engine.dispose();
