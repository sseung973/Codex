import {
  type AbstractMesh,
  type PickingInfo,
  Ray,
  type Scene,
} from "@babylonjs/core";

interface WorldCache {
  dirty: boolean;
  count: number;
  meshes: AbstractMesh[];
}
const worlds = new WeakMap<Scene, WorldCache>();
/** Cache colliders separately: effects, robot details and weapon meshes never enter world rays. */
export function worldMeshes(scene: Scene): AbstractMesh[] {
  let cache = worlds.get(scene);
  if (!cache) {
    cache = { dirty: true, count: -1, meshes: [] };
    worlds.set(scene, cache);
    const invalidate = () => {
      cache!.dirty = true;
    };
    scene.onNewMeshAddedObservable.add(invalidate);
    scene.onMeshRemovedObservable.add(invalidate);
  }
  if (cache.dirty || cache.count !== scene.meshes.length) {
    cache.meshes = scene.meshes.filter((m) => m.metadata?.world === true);
    cache.dirty = false;
    cache.count = scene.meshes.length;
  }
  return cache.meshes;
}

/** World-space AABB broad phase followed by exact mesh triangles (including sloped ramps). */
export function pickWorld(scene: Scene, ray: Ray): PickingInfo | null {
  let closest: PickingInfo | null = null;
  for (const mesh of worldMeshes(scene)) {
    if (!mesh.isEnabled()) continue;
    mesh.computeWorldMatrix();
    const box = mesh.getBoundingInfo().boundingBox;
    if (!ray.intersectsBoxMinMax(box.minimumWorld, box.maximumWorld)) continue;
    const hit = ray.intersectsMesh(mesh, false);
    if (
      hit.hit &&
      hit.distance <= ray.length &&
      (!closest || hit.distance < closest.distance)
    )
      closest = hit;
  }
  return closest;
}
