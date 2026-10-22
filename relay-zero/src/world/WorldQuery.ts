import {
  type AbstractMesh,
  type PickingInfo,
  Ray,
  type Scene,
} from "@babylonjs/core";
const CELL = 4,
  EPS = 1e-6;
interface WorldCache {
  dirty: boolean;
  count: number;
  meshes: AbstractMesh[];
  dynamic: AbstractMesh[];
  grid: Map<number, AbstractMesh[]>;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  stamp: number;
  seen: Map<AbstractMesh, number>;
}
const worlds = new WeakMap<Scene, WorldCache>();
const key = (x: number, z: number) => x * 65536 + z;
/** Call after baking immutable world geometry; moving meshes stay on the exact fallback path. */
export function invalidateWorld(scene: Scene): void {
  const cache = worlds.get(scene);
  if (cache) cache.dirty = true;
}
export function worldMeshes(scene: Scene): AbstractMesh[] {
  let cache = worlds.get(scene);
  if (!cache) {
    cache = {
      dirty: true,
      count: -1,
      meshes: [],
      dynamic: [],
      grid: new Map(),
      minX: Infinity,
      maxX: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
      stamp: 0,
      seen: new Map(),
    };
    worlds.set(scene, cache);
    scene.onNewMeshAddedObservable.add(() => invalidateWorld(scene));
    scene.onMeshRemovedObservable.add(() => invalidateWorld(scene));
  }
  if (cache.dirty || cache.count !== scene.meshes.length) {
    cache.meshes = scene.meshes.filter((m) => m.metadata?.world === true);
    cache.dynamic = [];
    cache.grid.clear();
    cache.seen.clear();
    cache.minX = cache.minZ = Infinity;
    cache.maxX = cache.maxZ = -Infinity;
    for (const mesh of cache.meshes) {
      mesh.computeWorldMatrix();
      const box = mesh.getBoundingInfo().boundingBox,
        min = box.minimumWorld,
        max = box.maximumWorld;
      const x0 = Math.floor((min.x - EPS) / CELL),
        x1 = Math.floor((max.x + EPS) / CELL),
        z0 = Math.floor((min.z - EPS) / CELL),
        z1 = Math.floor((max.z + EPS) / CELL);
      if (
        !mesh.metadata?.staticWorld ||
        !mesh.isWorldMatrixFrozen ||
        (x1 - x0 + 1) * (z1 - z0 + 1) > 4096 ||
        Math.max(Math.abs(x0), Math.abs(x1), Math.abs(z0), Math.abs(z1)) > 32700
      ) {
        cache.dynamic.push(mesh);
        continue;
      }
      cache.minX = Math.min(cache.minX, min.x);
      cache.maxX = Math.max(cache.maxX, max.x);
      cache.minZ = Math.min(cache.minZ, min.z);
      cache.maxZ = Math.max(cache.maxZ, max.z);
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++) {
          const k = key(x, z),
            bucket = cache.grid.get(k);
          if (bucket) bucket.push(mesh);
          else cache.grid.set(k, [mesh]);
        }
    }
    cache.dirty = false;
    cache.count = scene.meshes.length;
  }
  return cache.meshes;
}
function testMesh(
  mesh: AbstractMesh,
  ray: Ray,
  closest: PickingInfo | null,
): PickingInfo | null {
  if (!mesh.isEnabled()) return closest;
  if (!mesh.isWorldMatrixFrozen) mesh.computeWorldMatrix();
  const box = mesh.getBoundingInfo().boundingBox;
  if (!ray.intersectsBoxMinMax(box.minimumWorld, box.maximumWorld))
    return closest;
  const hit = ray.intersectsMesh(mesh, false);
  return hit.hit &&
    hit.distance <= ray.length &&
    (!closest || hit.distance < closest.distance)
    ? hit
    : closest;
}
/** Traverse only crossed XZ cells; retain Babylon's exact triangles for ramps and hit positions. */
export function pickWorld(scene: Scene, ray: Ray): PickingInfo | null {
  worldMeshes(scene);
  const cache = worlds.get(scene)!;
  let closest: PickingInfo | null = null;
  for (const mesh of cache.dynamic) closest = testMesh(mesh, ray, closest);
  if (!cache.grid.size) return closest;
  const o = ray.origin,
    d = ray.direction;
  let enter = 0,
    exit = ray.length;
  for (const axis of ["x", "z"] as const) {
    const min = axis === "x" ? cache.minX : cache.minZ,
      max = axis === "x" ? cache.maxX : cache.maxZ;
    if (Math.abs(d[axis]) < 1e-12) {
      if (o[axis] < min - EPS || o[axis] > max + EPS) return closest;
    } else {
      let a = (min - o[axis]) / d[axis],
        b = (max - o[axis]) / d[axis];
      if (a > b) [a, b] = [b, a];
      enter = Math.max(enter, a);
      exit = Math.min(exit, b);
    }
  }
  if (exit < enter) return closest;
  let x = Math.floor((o.x + d.x * (enter + EPS)) / CELL),
    z = Math.floor((o.z + d.z * (enter + EPS)) / CELL);
  const sx = Math.sign(d.x),
    sz = Math.sign(d.z),
    dx = sx ? CELL / Math.abs(d.x) : Infinity,
    dz = sz ? CELL / Math.abs(d.z) : Infinity;
  let tx = sx ? ((x + (sx > 0 ? 1 : 0)) * CELL - o.x) / d.x : Infinity,
    tz = sz ? ((z + (sz > 0 ? 1 : 0)) * CELL - o.z) / d.z : Infinity;
  const stamp = ++cache.stamp;
  const steps =
    4 +
    Math.ceil((cache.maxX - cache.minX) / CELL) +
    Math.ceil((cache.maxZ - cache.minZ) / CELL);
  for (let i = 0; i < steps; i++) {
    const bucket = cache.grid.get(key(x, z));
    if (bucket)
      for (const mesh of bucket) {
        if (cache.seen.get(mesh) === stamp) continue;
        cache.seen.set(mesh, stamp);
        closest = testMesh(mesh, ray, closest);
      }
    const next = Math.min(tx, tz);
    if (
      next > exit + EPS ||
      next === Infinity ||
      (closest && next > closest.distance + EPS)
    )
      break;
    if (tx < tz) {
      x += sx;
      tx += dx;
    } else if (tz < tx) {
      z += sz;
      tz += dz;
    } else {
      x += sx;
      z += sz;
      tx += dx;
      tz += dz;
    }
  }
  return closest;
}
