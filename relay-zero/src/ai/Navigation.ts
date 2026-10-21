import { pickWorld } from "../world/WorldQuery";
import { Vector3, Ray } from "@babylonjs/core";
import { Level } from "../world/Level";
// Small static 2m grid. Occupancy is sampled once; A* runs only when a route expires.
export class Navigation {
  readonly size = 21;
  readonly cell = 2;
  blocked = new Set<number>();
  constructor(public level: Level) {
    this.rebuild();
  }
  rebuild(): void {
    this.blocked.clear();
    const level = this.level;
    for (const mesh of level.solids) mesh.computeWorldMatrix(true);
    for (let z = 0; z < this.size; z++)
      for (let x = 0; x < this.size; x++) {
        const p = this.world(x, z);
        const hit = pickWorld(
          level.scene,
          new Ray(p.add(new Vector3(0, 7, 0)), Vector3.Down(), 6.7),
        );
        if (hit?.hit) this.blocked.add(z * this.size + x);
      }
  }
  world(x: number, z: number): Vector3 {
    return new Vector3((x - 10) * this.cell, 0, (z - 10) * this.cell);
  }
  cellOf(p: Vector3): [number, number] {
    return [
      Math.max(0, Math.min(20, Math.round(p.x / 2) + 10)),
      Math.max(0, Math.min(20, Math.round(p.z / 2) + 10)),
    ];
  }
  reachable(start: Vector3): Set<number> {
    const [sx, sz] = this.cellOf(start),
      source = sz * this.size + sx;
    const seen = new Set([source]),
      queue = [source];
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head],
        x = current % this.size,
        z = Math.floor(current / this.size);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          nz = z + dz,
          key = nz * this.size + nx;
        if (
          nx < 0 ||
          nz < 0 ||
          nx >= this.size ||
          nz >= this.size ||
          this.blocked.has(key) ||
          seen.has(key)
        )
          continue;
        seen.add(key);
        queue.push(key);
      }
    }
    return seen;
  }
  route(start: Vector3, goal: Vector3): Vector3[] {
    const [sx, sz] = this.cellOf(start),
      [gx, gz] = this.cellOf(goal);
    const source = sz * this.size + sx;
    let target = gz * this.size + gx;
    if (this.blocked.has(target)) {
      let best = Infinity;
      for (let i = 0; i < this.size * this.size; i++)
        if (!this.blocked.has(i)) {
          const d =
            ((i % this.size) - gx) ** 2 + (Math.floor(i / this.size) - gz) ** 2;
          if (d < best) {
            best = d;
            target = i;
          }
        }
    }
    const open = new Set([source]),
      came = new Map<number, number>(),
      cost = new Map([[source, 0]]);
    const heuristic = (i: number) =>
      Math.abs((i % this.size) - (target % this.size)) +
      Math.abs(Math.floor(i / this.size) - Math.floor(target / this.size));
    let steps = 0;
    while (open.size && steps++ < 441) {
      let current = -1,
        best = Infinity;
      for (const i of open) {
        const f = (cost.get(i) ?? Infinity) + heuristic(i);
        if (f < best) {
          best = f;
          current = i;
        }
      }
      if (current === target) {
        const out: Vector3[] = [];
        while (current !== source) {
          out.unshift(
            this.world(current % this.size, Math.floor(current / this.size)),
          );
          current = came.get(current)!;
        }
        return out;
      }
      open.delete(current);
      const x = current % this.size,
        z = Math.floor(current / this.size);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          nz = z + dz,
          n = nz * this.size + nx;
        if (
          nx < 0 ||
          nz < 0 ||
          nx >= this.size ||
          nz >= this.size ||
          this.blocked.has(n)
        )
          continue;
        const g = (cost.get(current) ?? 0) + 1;
        if (g < (cost.get(n) ?? Infinity)) {
          cost.set(n, g);
          came.set(n, current);
          open.add(n);
        }
      }
    }
    return [];
  }
}
