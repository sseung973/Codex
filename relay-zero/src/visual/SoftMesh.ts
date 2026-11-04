import {
  Geometry,
  Mesh,
  Scene,
  ShadowGenerator,
  Vector3,
  VertexBuffer,
  VertexData,
} from "@babylonjs/core";

type Numbers = ArrayLike<number>;
interface SoftData {
  positions: number[];
  normals: number[];
  indices: number[];
  uvs: number[];
}
interface Cached {
  source: number[];
  normals: number[];
  indices: number[];
  data: SoftData;
  geometry: Geometry;
}
const caches = new WeakMap<Scene, Map<string, Cached[]>>();

/** Unity SoftMesh's render-only bevel. Collision and hit meshes keep their original vertices. */
export function roundedData(
  input: Numbers,
  normals: Numbers,
  indices: Numbers,
  maximumRadius: number,
): SoftData | null {
  if (normals.length !== input.length) return null;
  const output: SoftData = { positions: [], normals: [], indices: [], uvs: [] };
  const replaced = new Set<number>(),
    remap = new Map<number, number>();
  const point = (index: number) => Vector3.FromArray(input, index * 3);
  const normal = (index: number) => Vector3.FromArray(normals, index * 3);
  let winding = -1;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i],
      b = indices[i + 1],
      c = indices[i + 2];
    const dot = Vector3.Dot(
      Vector3.Cross(point(b).subtract(point(a)), point(c).subtract(point(a))),
      normal(a),
    );
    if (Math.abs(dot) > 1e-10) {
      winding = Math.sign(dot);
      break;
    }
  }
  const triangle = (a: number, b: number, c: number) => {
    const p = output.positions,
      n = output.normals;
    const cross = Vector3.Cross(
      Vector3.FromArray(p, b * 3).subtract(Vector3.FromArray(p, a * 3)),
      Vector3.FromArray(p, c * 3).subtract(Vector3.FromArray(p, a * 3)),
    );
    if (Vector3.Dot(cross, Vector3.FromArray(n, a * 3)) * winding < 0)
      [b, c] = [c, b];
    output.indices.push(a, b, c);
  };
  for (let start = 0; start + 24 <= input.length / 3;) {
    const center = Vector3.Zero(),
      axes: Vector3[] = [];
    let valid = true;
    for (let i = 0; i < 24; i++) {
      center.addInPlace(point(start + i));
      if (
        Vector3.DistanceSquared(
          normal(start + i),
          normal(start + Math.floor(i / 4) * 4),
        ) > 1e-5
      )
        valid = false;
    }
    center.scaleInPlace(1 / 24);
    for (let f = 0; valid && f < 6; f++) {
      const axis = normal(start + f * 4).normalize();
      if (axis.lengthSquared() < 0.9) {
        valid = false;
        break;
      }
      let unique = true;
      for (const other of axes) {
        const dot = Math.abs(Vector3.Dot(axis, other));
        if (dot > 0.999) {
          unique = false;
          break;
        }
        if (dot > 0.001) {
          valid = false;
          break;
        }
      }
      if (unique) axes.push(axis);
    }
    if (!valid || axes.length !== 3) {
      start++;
      continue;
    }
    const half = [0, 0, 0];
    for (let i = 0; i < 24; i++)
      for (let a = 0; a < 3; a++)
        half[a] = Math.max(
          half[a],
          Math.abs(Vector3.Dot(point(start + i).subtract(center), axes[a])),
        );
    if (Math.min(...half) < 0.001) {
      start++;
      continue;
    }
    for (let i = 0; i < 24; i++)
      for (let a = 0; a < 3; a++)
        if (
          Math.abs(
            Math.abs(Vector3.Dot(point(start + i).subtract(center), axes[a])) -
              half[a],
          ) > 0.0003
        )
          valid = false;
    for (let i = 0; valid && i < indices.length; i += 3) {
      const count = [indices[i], indices[i + 1], indices[i + 2]].filter(
        (n) => n >= start && n < start + 24,
      ).length;
      if (count !== 0 && count !== 3) valid = false;
    }
    if (!valid) {
      start++;
      continue;
    }
    const radius = Math.min(maximumRadius, Math.min(...half) * 0.22);
    if (radius < 0.003) {
      start += 24;
      continue;
    }
    for (let i = 0; i < 24; i++) replaced.add(start + i);
    const inner = half.map((h) => h - radius);
    for (let face = 0; face < 3; face++)
      for (const sign of [-1, 1]) {
        const u = (face + 1) % 3,
          w = (face + 2) % 3,
          first = output.positions.length / 3;
        const xs = [-half[u], -half[u] + radius, half[u] - radius, half[u]],
          ys = [-half[w], -half[w] + radius, half[w] - radius, half[w]];
        for (let y = 0; y < 4; y++)
          for (let x = 0; x < 4; x++) {
            const p = [0, 0, 0];
            p[face] = half[face] * sign;
            p[u] = xs[x];
            p[w] = ys[y];
            const core = p.map((v, i) =>
              Math.max(-inner[i], Math.min(inner[i], v)),
            );
            const n = Vector3.FromArray(p)
              .subtract(Vector3.FromArray(core))
              .normalize();
            const q = Vector3.FromArray(core).add(n.scale(radius));
            const vertex = center
              .add(axes[0].scale(q.x))
              .add(axes[1].scale(q.y))
              .add(axes[2].scale(q.z));
            const direction = axes[0]
              .scale(n.x)
              .add(axes[1].scale(n.y))
              .add(axes[2].scale(n.z));
            output.positions.push(vertex.x, vertex.y, vertex.z);
            output.normals.push(direction.x, direction.y, direction.z);
            output.uvs.push(x / 3, y / 3);
          }
        for (let y = 0; y < 3; y++)
          for (let x = 0; x < 3; x++) {
            const a = first + y * 4 + x;
            triangle(a, a + 1, a + 4);
            triangle(a + 1, a + 5, a + 4);
          }
      }
    start += 24;
  }
  if (!replaced.size) return null;
  for (let i = 0; i < indices.length; i += 3) {
    if (replaced.has(indices[i])) continue;
    for (const old of [indices[i], indices[i + 1], indices[i + 2]]) {
      let index = remap.get(old);
      if (index === undefined) {
        index = output.positions.length / 3;
        remap.set(old, index);
        output.positions.push(
          input[old * 3],
          input[old * 3 + 1],
          input[old * 3 + 2],
        );
        output.normals.push(
          normals[old * 3],
          normals[old * 3 + 1],
          normals[old * 3 + 2],
        );
        output.uvs.push(0, 0);
      }
      output.indices.push(index);
    }
  }
  return output;
}

function equal(a: Numbers, b: Numbers): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function softenMesh(mesh: Mesh, radius: number): boolean {
  if (mesh.metadata?.softened) return true;
  const p = mesh.getVerticesData(VertexBuffer.PositionKind),
    n = mesh.getVerticesData(VertexBuffer.NormalKind),
    t = mesh.getIndices();
  if (!p || !n || !t) return false;
  let hash = 2166136261;
  for (const data of [p, n, t])
    for (let i = 0; i < data.length; i++)
      hash = Math.imul(hash ^ Math.round(data[i] * 1e6), 16777619);
  const key = `${radius}:${p.length}:${t.length}:${hash}`;
  const scene = mesh.getScene(),
    cache = caches.get(scene) ?? new Map<string, Cached[]>();
  caches.set(scene, cache);
  const bucket = cache.get(key) ?? [];
  let entry = bucket.find(
    (e) => equal(e.source, p) && equal(e.normals, n) && equal(e.indices, t),
  );
  if (!entry) {
    const data = roundedData(p, n, t, radius);
    if (!data) return false;
    const vertex = Object.assign(new VertexData(), data);
    const geometry = new Geometry("soft " + key, scene, vertex);
    entry = {
      source: Array.from(p),
      normals: Array.from(n),
      indices: Array.from(t),
      data,
      geometry,
    };
    bucket.push(entry);
    cache.set(key, bucket);
  } else if (entry.geometry.isDisposed())
    entry.geometry = new Geometry(
      "soft " + key,
      scene,
      Object.assign(new VertexData(), entry.data),
    );
  entry.geometry.applyToMesh(mesh);
  mesh.metadata = { ...mesh.metadata, softened: true };
  return true;
}

export function softenActor(
  source: Mesh,
  radius: number,
  shadows?: ShadowGenerator,
): Mesh | null {
  const visual = new Mesh("rounded / " + source.name, source.getScene());
  source.geometry?.applyToMesh(visual);
  if (!softenMesh(visual, radius)) {
    visual.dispose();
    return null;
  }
  visual.parent = source;
  visual.material = source.material;
  visual.isPickable = visual.checkCollisions = false;
  visual.renderingGroupId = source.renderingGroupId;
  visual.metadata = { visualOnly: true, softened: true };
  source.isVisible = false;
  if (shadows?.getShadowMap()?.renderList?.includes(source)) {
    shadows.removeShadowCaster(source);
    shadows.addShadowCaster(visual);
    source.onDisposeObservable.addOnce(() =>
      shadows.removeShadowCaster(visual),
    );
  }
  return visual;
}
