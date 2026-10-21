import { Scene, Ray, Vector3, PickingInfo } from "@babylonjs/core";
import type { IDamageable } from "../combat/Damage";
/** A short fan of rays, occluded by world geometry. At most one target per swing. */
export function meleeHit(
  scene: Scene,
  origin: Vector3,
  forward: Vector3,
  range: number,
): PickingInfo | null {
  const right = Vector3.Cross(Vector3.Up(), forward).normalize();
  let best: PickingInfo | null = null;
  for (const offset of [0, -0.18, 0.18, -0.36, 0.36, -0.55, 0.55, -0.7, 0.7]) {
    const direction = forward.add(right.scale(offset)).normalize();
    const hit = scene.pickWithRay(
      new Ray(origin, direction, range),
      (m) =>
        m.isEnabled() &&
        m.isPickable &&
        (m.metadata?.world === true || !!m.metadata?.entity),
    );
    const entity = hit?.pickedMesh?.metadata?.entity as IDamageable | undefined;
    if (
      hit?.hit &&
      entity &&
      entity.health > 0 &&
      (!best || hit.distance < best.distance)
    )
      best = hit;
  }
  return best;
}
