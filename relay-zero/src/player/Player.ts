import {
  Scene,
  UniversalCamera,
  Vector3,
  MeshBuilder,
  Mesh,
  Ray,
} from "@babylonjs/core";
import { PlayerInput } from "./PlayerInput";
import { movement, damp, Settings } from "../core/Settings";
import { Health } from "../combat/Damage";
export type MovementState =
  "Idle" | "Walking" | "Sprinting" | "Crouching" | "Airborne";
export class Player extends Health {
  camera: UniversalCamera;
  body: Mesh;
  velocity = Vector3.Zero();
  grounded = true;
  state: MovementState = "Idle";
  yaw = 0;
  pitch = 0;
  recoilPitch = 0;
  recoilYaw = 0;
  adsFov = 61;
  recoilRecovery = 8;
  recoilDelay = 0;
  eye = 1.65;
  bob = 0;
  landing = 0;
  onStep: () => void = () => {};
  onJump: () => void = () => {};
  onLand: () => void = () => {};
  stepTime = 0;
  constructor(
    public scene: Scene,
    public input: PlayerInput,
    public settings: Settings,
  ) {
    super("player", 100);
    this.camera = new UniversalCamera(
      "playerCamera",
      new Vector3(0, 1.65, -17),
      scene,
    );
    this.camera.minZ = 0.06;
    this.camera.maxZ = 170;
    this.camera.inputs.clear();
    this.body = MeshBuilder.CreateBox("playerCollider", { size: 1 }, scene);
    this.body.isVisible = false;
    this.body.isPickable = false;
    this.body.ellipsoid = new Vector3(0.36, 0.85, 0.36);
    this.body.position.set(0, 0.85, -17);
  }
  get feet(): Vector3 {
    return this.body.position.subtract(
      new Vector3(0, this.body.ellipsoid.y, 0),
    );
  }
  get crouched(): boolean {
    return this.state === "Crouching";
  }
  resetAt(pos: Vector3): void {
    this.reset();
    this.body.ellipsoid.y = 0.85;
    this.body.position.copyFrom(pos).y += 0.85;
    this.velocity.setAll(0);
    this.yaw = 0;
    this.pitch = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.recoilDelay = 0;
    this.grounded = true;
    this.eye = 1.65;
    this.updateCamera(0, false);
  }
  look(ads: boolean): void {
    const s = 0.0016 * this.settings.sensitivity * (ads ? 0.63 : 1);
    this.yaw += this.input.dx * s;
    this.pitch = Math.max(
      -1.54,
      Math.min(1.54, this.pitch + this.input.dy * s),
    );
  }
  update(dt: number, ads: boolean): void {
    this.look(ads);
    const feet = this.feet;
    const ground = this.scene.pickWithRay(
      new Ray(feet.add(new Vector3(0, 0.35, 0)), Vector3.Down(), 0.48),
      (m) => m.metadata?.world === true,
    );
    const normal = ground?.getNormal(true);
    this.grounded = !!(
      ground?.hit &&
      this.velocity.y <= 0.1 &&
      (!normal || normal.y > Math.cos(movement.maxSlope))
    );
    const crouch = this.input.down("ControlLeft") || this.input.down("KeyC");
    const ceiling = this.scene.pickWithRay(
      new Ray(feet.add(new Vector3(0, 0.3, 0)), Vector3.Up(), 1.5),
      (m) => m.metadata?.world === true,
    );
    const short = crouch || !!ceiling?.hit;
    const radius = short ? 0.53 : 0.85;
    if (this.body.ellipsoid.y !== radius) {
      this.body.position.y += radius - this.body.ellipsoid.y;
      this.body.ellipsoid.y = radius;
    }
    const x = Number(this.input.down("KeyD")) - Number(this.input.down("KeyA")),
      z = Number(this.input.down("KeyW")) - Number(this.input.down("KeyS"));
    const moving = x !== 0 || z !== 0;
    const sprint = this.input.down("ShiftLeft") && z > 0 && !short && !ads;
    this.state = !this.grounded
      ? "Airborne"
      : short
        ? "Crouching"
        : moving
          ? sprint
            ? "Sprinting"
            : "Walking"
          : "Idle";
    const speed = short
      ? movement.crouchSpeed
      : sprint
        ? movement.sprintSpeed
        : movement.walkSpeed;
    const wish = new Vector3(
      x * Math.cos(this.yaw) + z * Math.sin(this.yaw),
      0,
      z * Math.cos(this.yaw) - x * Math.sin(this.yaw),
    );
    if (moving) wish.normalize().scaleInPlace(speed * (ads ? 0.66 : 1));
    if (this.grounded) {
      // Direct ground control: release and direction changes have no inertia.
      this.velocity.x = wish.x;
      this.velocity.z = wish.z;
    } else {
      // Preserve jump momentum and reduced airborne steering.
      const maxChange = movement.airAcceleration * dt;
      if (moving)
        for (const k of ["x", "z"] as const) {
          this.velocity[k] += Math.max(
            -maxChange,
            Math.min(maxChange, wish[k] - this.velocity[k]),
          );
        }
    }
    if (this.grounded) {
      this.velocity.y = -2;
      if (this.input.consume("Space")) {
        this.velocity.y = movement.jumpForce;
        this.grounded = false;
        this.onJump();
      }
    } else this.velocity.y -= movement.gravity * dt;
    const beforeY = this.body.position.y;
    const vertical = this.velocity.y;
    this.body.moveWithCollisions(this.velocity.scale(dt));
    if (vertical > 0 && this.body.position.y - beforeY < vertical * dt * 0.3)
      this.velocity.y = 0;
    if (
      !this.grounded &&
      vertical < -4 &&
      this.body.position.y - beforeY > vertical * dt * 0.4
    ) {
      this.landing = Math.min(0.1, -vertical * 0.006);
      this.onLand();
      this.grounded = true;
      this.velocity.y = 0;
    }
    if (this.grounded && moving) {
      this.stepTime += dt;
      if (this.stepTime > (short ? 0.62 : sprint ? 0.29 : 0.42)) {
        this.stepTime = 0;
        this.onStep();
      }
    } else this.stepTime = 0;
    if (this.body.position.y < -10) this.resetAt(new Vector3(0, 0, -17));
    this.updateCamera(dt, ads);
  }
  updateCamera(dt: number, ads: boolean): void {
    this.eye = damp(
      this.eye,
      this.body.ellipsoid.y < 0.8 ? 1.02 : 1.65,
      15,
      dt,
    );
    const recoveryDt = Math.max(0, dt - this.recoilDelay);
    this.recoilDelay = Math.max(0, this.recoilDelay - dt);
    this.recoilPitch = damp(
      this.recoilPitch,
      0,
      this.recoilRecovery,
      recoveryDt,
    );
    this.recoilYaw = damp(this.recoilYaw, 0, this.recoilRecovery, recoveryDt);
    this.landing = damp(this.landing, 0, 12, dt);
    this.bob += dt * (this.state === "Sprinting" ? 15 : 11);
    const amount =
      this.settings.headBob &&
      this.grounded &&
      this.velocity.x ** 2 + this.velocity.z ** 2 > 1
        ? 0.018
        : 0;
    this.camera.position.copyFrom(this.feet).y +=
      this.eye + Math.sin(this.bob) * amount * (ads ? 0.15 : 1) - this.landing;
    this.camera.rotation.set(
      Math.max(-1.55, Math.min(1.55, this.pitch - this.recoilPitch)),
      this.yaw + this.recoilYaw,
      0,
    );
    this.camera.fov = damp(
      this.camera.fov,
      ((ads
        ? this.adsFov
        : this.settings.fov + (this.state === "Sprinting" ? 5 : 0)) *
        Math.PI) /
        180,
      14,
      dt,
    );
  }
}
