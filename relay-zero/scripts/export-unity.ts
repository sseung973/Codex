/** Exact geometry + balance export. Runs with Babylon NullEngine; no GPU required. */
import {
  NullEngine,
  Scene,
  Mesh,
  TransformNode,
  Vector3,
  Matrix,
  VertexBuffer,
} from "@babylonjs/core";
import { writeFileSync, mkdirSync } from "node:fs";
import { Level } from "../src/world/Level";
import { Navigation } from "../src/ai/Navigation";
import { objectivePoints } from "../src/world/ObjectiveMarker";
import { Enemy, enemyConfig } from "../src/ai/Enemy";
import { Commander } from "../src/ai/Commander";
import { Avatar } from "../src/multiplayer/Avatar";
import { WeaponModels } from "../src/weapons/WeaponModels";
import { rifle, pistol, baton } from "../src/weapons/WeaponData";
import { heavyPistol, smg, heavyRifle, sniper } from "../src/weapons/Arsenal";
import { maps, MapId } from "../src/world/MapData";
import { difficulties } from "../src/core/Difficulty";
const out =
  process.argv[2] || "../relay-zero-unity/Assets/RelayZero/Resources/Data";
mkdirSync(out, { recursive: true });
const signs = new WeakMap<Level, any[]>();
class ExportLevel extends Level {
  override sign(
    text: string,
    pos: Vector3,
    w: number,
    h: number,
    color: string,
    ground = false,
    yaw = 0,
  ) {
    const list = signs.get(this) ?? [];
    list.push({ text, p: pos.asArray(), w, h, color, ground, yaw });
    signs.set(this, list);
  }
}
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const arr = (a: ArrayLike<number>) => Array.from(a, round);
function geometry(meshes: Mesh[], root?: TransformNode) {
  const mats: any[] = [];
  const materialIds = new Map<any, number>();
  const inverse = root
    ? Matrix.Invert(root.computeWorldMatrix(true))
    : Matrix.Identity();
  const parts = meshes
    .filter((m) => m.getTotalVertices() > 0)
    .map((m) => {
      const mat: any = m.material;
      if (!materialIds.has(mat)) {
        materialIds.set(mat, mats.length);
        mats.push({
          name: mat?.name ?? "default",
          color: (mat?.albedoColor ?? mat?.diffuseColor)?.asArray() ?? [
            0.6, 0.65, 0.7,
          ],
          emission: mat?.emissiveColor?.asArray() ?? [0, 0, 0],
          metallic: mat?.metallic ?? 0,
          roughness: mat?.roughness ?? 0.8,
          unlit: !!(mat?.unlit || mat?.disableLighting),
          alpha: mat?.alpha ?? 1,
        });
      }
      const matrix = m.computeWorldMatrix(true).multiply(inverse);
      const normal = Matrix.Transpose(Matrix.Invert(matrix));
      const p = m.getVerticesData(VertexBuffer.PositionKind)!;
      const n = m.getVerticesData(VertexBuffer.NormalKind);
      const vertices: number[] = [];
      const normals: number[] = [];
      for (let i = 0; i < p.length; i += 3) {
        vertices.push(
          ...Vector3.TransformCoordinates(
            Vector3.FromArray(p, i),
            matrix,
          ).asArray(),
        );
        if (n)
          normals.push(
            ...Vector3.TransformNormal(Vector3.FromArray(n, i), normal)
              .normalize()
              .asArray(),
          );
      }
      const triangles = Array.from(m.getIndices() ?? []);
      // Unity triangles must agree with their exported outward normals.
      for (let i = 0; i < triangles.length; i += 3) {
        const a = Vector3.FromArray(vertices, triangles[i] * 3),
          b = Vector3.FromArray(vertices, triangles[i + 1] * 3),
          c = Vector3.FromArray(vertices, triangles[i + 2] * 3);
        const norm = Vector3.FromArray(normals, triangles[i] * 3);
        if (Vector3.Dot(Vector3.Cross(b.subtract(a), c.subtract(a)), norm) < 0)
          [triangles[i + 1], triangles[i + 2]] = [
            triangles[i + 2],
            triangles[i + 1],
          ];
      }
      return {
        name: m.name,
        material: materialIds.get(mat),
        vertices: arr(vertices),
        normals: arr(normals),
        triangles,
        solid: m.checkCollisions,
        visible: m.isVisible,
        enabled: m.isEnabled(),
        head: !!m.metadata?.head,
        shield: !!m.metadata?.shield,
        weakpoint: !!m.metadata?.weakpoint,
      };
    });
  return { materials: mats, parts };
}
const save = (name: string, data: any) =>
  writeFileSync(`${out}/${name}.json`, JSON.stringify(data));
for (const id of Object.keys(maps) as MapId[]) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const level = new ExportLevel(scene, id);
  const nav = new Navigation(level);
  const mission = objectivePoints(nav, level);
  const world = geometry(
    level.root.getChildMeshes().filter((m) => m instanceof Mesh) as Mesh[],
  );
  save(id, {
    id,
    ...maps[id],
    ...world,
    spawn: level.spawn.asArray(),
    spawns: level.enemySpawns.map((p) => ({ p: p.asArray() })),
    mission: mission.map((p) => ({ p: p.asArray() })),
    blocked: [...nav.blocked],
    signs: signs.get(level),
    lights: level.lights.map((l: any) => ({
      type: l.getTypeID(),
      p: l.position?.asArray(),
      direction: l.direction?.asArray(),
      color: l.diffuse.asArray(),
      intensity: l.intensity,
      range: l.range,
    })),
  });
  scene.dispose();
  engine.dispose();
}
{
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const level = new ExportLevel(scene);
  const nav = new Navigation(level);
  for (const role of [
    "assault",
    "defender",
    "support",
    "sniper",
    "bomber",
  ] as const) {
    const e = new Enemy(
      scene,
      level,
      nav,
      enemyConfig(1, false, difficulties.normal, role),
      Vector3.Zero(),
      role,
      false,
      role,
    );
    e.root.rotation.setAll(0);
    save(`robot-${role}`, geometry(e.root.getChildMeshes() as Mesh[], e.root));
    e.dispose();
  }
  const commander = new Commander(
    scene,
    level,
    nav,
    difficulties.normal,
    Vector3.Zero(),
    "commander",
  );
  commander.root.rotation.setAll(0);
  save(
    "robot-commander",
    geometry(commander.root.getChildMeshes() as Mesh[], commander.root),
  );
  commander.dispose();
  for (const friendly of [true, false]) {
    const a = new Avatar(scene, "operative", friendly);
    save(
      friendly ? "operative-friendly" : "operative-rival",
      geometry(a.parts, a.root),
    );
    a.dispose();
  }
  const parent = new TransformNode("export-weapons", scene);
  const models = new WeaponModels(scene, parent);
  for (const w of [
    rifle,
    pistol,
    baton,
    heavyPistol,
    smg,
    heavyRifle,
    sniper,
  ]) {
    const slot =
      w.weaponType === "melee" ? 2 : w.weaponType === "pistol" ? 1 : 0;
    models.configure(slot, w);
    models.select(slot);
    save(
      `weapon-${w.id}`,
      geometry(
        models.views[slot].root
          .getChildMeshes()
          .filter((m) => m.isEnabled()) as Mesh[],
        parent,
      ),
    );
  }
  scene.dispose();
  engine.dispose();
}
save("balance", {
  source: "RELAY ZERO web 3.2.0 / b980d3996fd13efdf135e99494cb5f9c262bb189",
  weapons: [rifle, pistol, baton, heavyPistol, smg, heavyRifle, sniper].map(
    (w) => ({
      ...w,
      price: ({ s24: 300, ar7: 600, r20: 850, l5: 1000 } as any)[w.id] ?? 0,
    }),
  ),
  difficulties: Object.values(difficulties),
});
console.log(
  "Exported 3 complete arenas, 6 robots, 2 operatives, 7 weapons and original balance.",
);
