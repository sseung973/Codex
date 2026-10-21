import {
  Scene,
  MeshBuilder,
  Mesh,
  StandardMaterial,
  Color3,
  Vector3,
  Quaternion,
  Axis,
} from "@babylonjs/core";
interface Effect {
  mesh: Mesh;
  ttl: number;
  duration: number;
  velocity: Vector3;
}
export class Effects {
  sparks: Effect[] = [];
  tracers: Effect[] = [];
  private arrivals: Effect[] = [];
  private arrivalIndex = 0;
  private robotMaterial: StandardMaterial;
  private wallMaterial: StandardMaterial;
  sparkIndex = 0;
  tracerIndex = 0;
  constructor(scene: Scene) {
    const mat = new StandardMaterial("spark", scene);
    mat.emissiveColor = new Color3(0.83, 0.56, 0.27);
    mat.disableLighting = true;
    this.robotMaterial = mat;
    this.wallMaterial = new StandardMaterial("concrete debris", scene);
    this.wallMaterial.diffuseColor = Color3.FromHexString("#737e87");
    this.wallMaterial.specularColor.set(0, 0, 0);
    const trace = new StandardMaterial("tracer", scene);
    trace.emissiveColor = new Color3(0.82, 0.72, 0.52);
    trace.disableLighting = true;
    const arrivalMat = new StandardMaterial("arrival signal", scene);
    arrivalMat.emissiveColor = Color3.FromHexString("#e56561");
    arrivalMat.disableLighting = true;
    for (let i = 0; i < 12; i++) {
      const m = MeshBuilder.CreateTorus(
        "arrival",
        { diameter: 1.2, thickness: 0.025, tessellation: 24 },
        scene,
      );
      m.material = arrivalMat;
      m.isPickable = false;
      m.setEnabled(false);
      this.arrivals.push({
        mesh: m,
        ttl: 0,
        duration: 0.45,
        velocity: Vector3.Zero(),
      });
    }
    for (let i = 0; i < 80; i++) {
      const m = MeshBuilder.CreateBox("impact", { size: 0.045 }, scene);
      m.material = mat;
      m.isPickable = false;
      m.setEnabled(false);
      this.sparks.push({
        mesh: m,
        ttl: 0,
        duration: 0.25,
        velocity: Vector3.Zero(),
      });
    }
    for (let i = 0; i < 16; i++) {
      const m = MeshBuilder.CreateCylinder(
        "tracer",
        { height: 1, diameter: 0.009, tessellation: 4 },
        scene,
      );
      m.material = trace;
      m.isPickable = false;
      m.setEnabled(false);
      this.tracers.push({
        mesh: m,
        ttl: 0,
        duration: 0.065,
        velocity: Vector3.Zero(),
      });
    }
  }
  spawn(p: Vector3): void {
    const e = this.arrivals[this.arrivalIndex++ % this.arrivals.length];
    e.mesh.position.copyFrom(p).y += 0.04;
    e.mesh.scaling.setAll(0.6);
    e.mesh.visibility = 1;
    e.ttl = e.duration;
    e.mesh.setEnabled(true);
  }
  impact(p: Vector3, robot = false): void {
    for (let i = 0; i < (robot ? 6 : 3); i++) {
      const e = this.sparks[this.sparkIndex++ % this.sparks.length];
      e.mesh.material = robot ? this.robotMaterial : this.wallMaterial;
      e.mesh.scaling.setAll(1);
      e.mesh.position.copyFrom(p);
      e.velocity.set(
        (Math.random() - 0.5) * 3,
        Math.random() * 2.4,
        (Math.random() - 0.5) * 3,
      );
      e.ttl = 0.22;
      e.mesh.setEnabled(true);
    }
  }
  tracer(a: Vector3, b: Vector3): void {
    const e = this.tracers[this.tracerIndex++ % this.tracers.length];
    const d = b.subtract(a);
    if (d.lengthSquared() < 0.000001) return;
    e.mesh.position.copyFrom(a.add(b).scale(0.5));
    e.mesh.scaling.y = d.length();
    e.mesh.rotationQuaternion = Quaternion.FromUnitVectorsToRef(
      Axis.Y,
      d.normalize(),
      e.mesh.rotationQuaternion || Quaternion.Identity(),
    );
    e.ttl = 0.028;
    e.mesh.setEnabled(true);
  }
  update(dt: number): void {
    for (const e of this.arrivals)
      if (e.ttl > 0) {
        e.ttl = Math.max(0, e.ttl - dt);
        e.mesh.scaling.setAll(0.6 + (1 - e.ttl / e.duration) * 0.9);
        e.mesh.visibility = e.ttl / e.duration;
        e.mesh.setEnabled(e.ttl > 0);
      }
    for (const e of this.sparks)
      if (e.ttl > 0) {
        e.ttl -= dt;
        e.mesh.scaling.setAll(Math.max(0.1, e.ttl / 0.22));
        e.velocity.y -= 5 * dt;
        e.mesh.position.addInPlace(e.velocity.scale(dt));
        e.mesh.setEnabled(e.ttl > 0);
      }
    for (const e of this.tracers)
      if (e.ttl > 0) {
        e.ttl -= dt;
        e.mesh.setEnabled(e.ttl > 0);
      }
  }
  clear(): void {
    for (const e of [...this.sparks, ...this.tracers, ...this.arrivals]) {
      e.ttl = 0;
      e.mesh.setEnabled(false);
    }
  }
}
