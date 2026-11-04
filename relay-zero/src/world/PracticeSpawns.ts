import { Vector3 } from "@babylonjs/core";
import type { Navigation } from "../ai/Navigation";

/** Same reachable-cell placement as Unity's GridNavigation.Spawn, with spacing between targets. */
export function practiceSpawns(
  navigation: Navigation,
  player: Vector3,
): Vector3[] {
  const safe = [...navigation.reachable(player)].map((key) =>
    navigation.world(key % navigation.size, Math.floor(key / navigation.size)),
  );
  const result: Vector3[] = [];
  for (const [x, z] of [
    [0, -9],
    [-5, -3],
    [5, 1],
  ]) {
    const preferred = new Vector3(x, 0, z);
    const point = safe
      .filter(
        (p) =>
          Vector3.DistanceSquared(p, player) >= 64 &&
          result.every((other) => Vector3.DistanceSquared(p, other) >= 3),
      )
      .sort(
        (a, b) =>
          Vector3.DistanceSquared(a, preferred) -
          Vector3.DistanceSquared(b, preferred),
      )[0];
    if (point) result.push(point.clone());
  }
  return result;
}
