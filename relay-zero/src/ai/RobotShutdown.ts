import {
  Mesh,
  StandardMaterial,
  TransformNode,
  Vector3,
  Quaternion,
  Color3,
} from "@babylonjs/core";
interface Particle {
  position: Vector3;
  previous: Vector3;
}
interface Link {
  a: number;
  b: number;
  length: number;
}
interface Binding {
  mesh: Mesh;
  segment: number;
  offset: Vector3;
  rotation: Quaternion;
}
/** Fixed-step position-based ragdoll: articulated segments, gravity and static-world collision. */
export class RobotShutdown {
  elapsed = 0;
  active = false;
  particles: Particle[] = [];
  links: Link[] = [];
  private accumulator = 0;
  private segments = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [8, 9],
    [10, 11],
  ];
  private directions: Vector3[] = [];
  private bindings: Binding[] = [];
  private bounds: { min: Vector3; max: Vector3 }[] = [];
  private lights: { material: StandardMaterial; color: Color3 }[] = [];
  constructor(
    private root: TransformNode,
    private parts: Mesh[],
  ) {}
  start(normal: Vector3): void {
    if (this.active) return;
    this.active = true;
    const matrix = this.root.computeWorldMatrix(true).clone();
    const local = [
      [0, 0.72, 0],
      [0, 1.35, 0],
      [0, 1.62, 0],
      [0, 1.92, 0],
      [-0.44, 1.34, 0],
      [-0.44, 0.88, 0.15],
      [0.44, 1.34, 0],
      [0.44, 0.88, 0.15],
      [-0.23, 0.68, 0],
      [-0.23, 0.13, 0.08],
      [0.23, 0.68, 0],
      [0.23, 0.13, 0.08],
    ];
    const impulse = normal.scale(-0.025);
    impulse.y = 0.014;
    for (const [x, y, z] of local) {
      const p = Vector3.TransformCoordinates(new Vector3(x, y, z), matrix);
      this.particles.push({
        position: p,
        previous: p.subtract(impulse.scale(0.7 + y * 0.3)),
      });
    }
    for (const [a, b] of [
      ...this.segments,
      [1, 2],
      [1, 4],
      [1, 6],
      [0, 4],
      [0, 6],
      [0, 8],
      [0, 10],
      [1, 8],
      [1, 10],
      [4, 6],
      [8, 10],
    ])
      this.links.push({
        a,
        b,
        length: Vector3.Distance(
          this.particles[a].position,
          this.particles[b].position,
        ),
      });
    this.directions = this.segments.map(([a, b]) =>
      this.particles[b].position
        .subtract(this.particles[a].position)
        .normalize(),
    );
    for (const mesh of this.parts) {
      mesh.computeWorldMatrix(true);
      const position = mesh.getAbsolutePosition().clone(),
        rotation = Quaternion.Identity();
      mesh.getWorldMatrix().decompose(undefined, rotation);
      const head = ["head", "visor"].includes(mesh.name),
        arm = ["arm", "shoulder", "blaster"].includes(mesh.name),
        leg = ["leg", "shin", "foot"].includes(mesh.name);
      const segment = head
        ? 1
        : arm
          ? mesh.position.x < 0
            ? 2
            : 3
          : leg
            ? mesh.position.x < 0
              ? 4
              : 5
            : 0;
      const [a, b] = this.segments[segment],
        center = this.particles[a].position
          .add(this.particles[b].position)
          .scale(0.5);
      this.bindings.push({
        mesh,
        segment,
        offset: position.subtract(center),
        rotation,
      });
    }
    this.root.rotation.setAll(0);
    this.root.rotationQuaternion = null;
    this.lights = [...new Set(this.parts.map((p) => p.material))]
      .filter(
        (m): m is StandardMaterial =>
          m instanceof StandardMaterial && m.disableLighting,
      )
      .map((material) => ({ material, color: material.emissiveColor.clone() }));
    for (const mesh of this.root.getScene().meshes) {
      if (mesh.metadata?.world !== true) continue;
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      this.bounds.push({
        min: box.minimumWorld.clone(),
        max: box.maximumWorld.clone(),
      });
    }
  }
  private collide(p: Particle): void {
    const radius = 0.2;
    for (const b of this.bounds) {
      const min = b.min,
        max = b.max,
        v = p.position;
      if (
        v.x < min.x - radius ||
        v.x > max.x + radius ||
        v.y < min.y - radius ||
        v.y > max.y + radius ||
        v.z < min.z - radius ||
        v.z > max.z + radius
      )
        continue;
      const distances = [
        v.x - min.x + radius,
        max.x + radius - v.x,
        v.y - min.y + radius,
        max.y + radius - v.y,
        v.z - min.z + radius,
        max.z + radius - v.z,
      ];
      const face = distances.indexOf(Math.min(...distances));
      const axis = (["x", "x", "y", "y", "z", "z"] as const)[face];
      v[axis] = face % 2 === 0 ? min[axis] - radius : max[axis] + radius;
      p.previous[axis] = v[axis];
      p.previous.x += (v.x - p.previous.x) * 0.35;
      p.previous.z += (v.z - p.previous.z) * 0.35;
    }
    // Arena safety floor also covers a thin ground plane and numerical overshoot.
    if (p.position.y < radius) {
      p.position.y = radius;
      p.previous.y = radius;
    }
  }
  update(dt: number): void {
    if (!this.active || !this.root.isEnabled()) return;
    this.elapsed += dt;
    if (this.elapsed > 5) {
      this.root.setEnabled(false);
      return;
    }
    if (this.elapsed < 2.5) {
      this.accumulator += Math.min(dt, 0.05);
      while (this.accumulator >= 1 / 60) {
        this.accumulator -= 1 / 60;
        for (const p of this.particles) {
          const velocity = p.position.subtract(p.previous).scale(0.98);
          p.previous.copyFrom(p.position);
          p.position.addInPlace(velocity);
          p.position.y -= 18 / 3600;
        }
        for (let iteration = 0; iteration < 7; iteration++) {
          for (const l of this.links) {
            const a = this.particles[l.a].position,
              b = this.particles[l.b].position,
              d = b.subtract(a),
              length = d.length();
            if (length < 1e-6) continue;
            d.scaleInPlace(((length - l.length) / length) * 0.5);
            a.addInPlace(d);
            b.subtractInPlace(d);
          }
          for (const p of this.particles) this.collide(p);
        }
      }
      for (const binding of this.bindings) {
        const [a, b] = this.segments[binding.segment],
          start = this.particles[a].position,
          end = this.particles[b].position;
        const delta = Quaternion.FromUnitVectorsToRef(
          this.directions[binding.segment],
          end.subtract(start).normalize(),
          Quaternion.Identity(),
        );
        const offset = Vector3.Zero();
        binding.offset.rotateByQuaternionToRef(delta, offset);
        binding.mesh.position.copyFrom(
          start.add(end).scale(0.5).add(offset).subtract(this.root.position),
        );
        binding.mesh.rotationQuaternion = delta.multiply(binding.rotation);
      }
      let low = Infinity;
      for (const p of this.parts) {
        if (!p.isEnabled()) continue;
        p.computeWorldMatrix(true);
        low = Math.min(low, p.getBoundingInfo().boundingBox.minimumWorld.y);
      }
      if (low < 0) for (const p of this.parts) p.position.y -= low;
    }
    const power = Math.max(0, 1 - this.elapsed / 0.9);
    for (const l of this.lights)
      l.material.emissiveColor.copyFrom(l.color.scale(power));
  }
}
