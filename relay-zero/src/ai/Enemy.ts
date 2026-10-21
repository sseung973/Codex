import { gameTheme } from "../visual/GameTheme";
import { RobotShutdown } from "./RobotShutdown";
import {
  Scene,
  MeshBuilder,
  Mesh,
  StandardMaterial,
  Color3,
  Vector3,
  TransformNode,
} from "@babylonjs/core";
import { Health, DamageInfo } from "../combat/Damage";
import { Level } from "../world/Level";
import { Player } from "../player/Player";
import { Navigation } from "./Navigation";
import { Difficulty, difficulties } from "../core/Difficulty";
import type { ObjectiveKind } from "../core/Objectives";
export type EnemyRole = "assault" | "defender" | "support";
// Armor/visor change per robot, while small joint and inset surfaces never do.
// Sharing these two materials prevents late waves from compiling duplicate shaders.
const sharedSurfaces = new WeakMap<Scene, { joint: StandardMaterial; inset: StandardMaterial }>();
function robotSurfaces(scene: Scene): { joint: StandardMaterial; inset: StandardMaterial } {
  const cached = sharedSurfaces.get(scene);
  if (cached) return cached;
  const joint = new StandardMaterial("robot shared joints", scene);
  joint.diffuseColor = Color3.FromHexString(gameTheme.colors.rubber);
  joint.specularColor = new Color3(0.04, 0.05, 0.06);
  const inset = new StandardMaterial("robot shared inset", scene);
  inset.diffuseColor = Color3.FromHexString(gameTheme.colors.metal);
  inset.specularColor = new Color3(0.09, 0.11, 0.13);
  const surfaces = { joint, inset };
  sharedSurfaces.set(scene, surfaces);
  return surfaces;
}
export const roleForSpawn = (index: number): EnemyRole =>
  (["assault", "defender", "support", "assault"] as const)[index % 4];
export type EnemyState =
  "Idle" | "Patrol" | "Investigate" | "Chase" | "Attack" | "Search" | "Dead";
export interface EnemyConfig {
  health: number;
  damage: number;
  accuracy: number;
  reactionTime: number;
  moveSpeed: number;
  fireRate: number;
  detectionRange: number;
  visionAngle: number;
  range: number;
  burstCount: number;
  burstPause: number;
}
export function enemyConfig(
  wave: number,
  elite = false,
  difficulty: Difficulty = difficulties.easy,
  role: EnemyRole = "assault",
): EnemyConfig {
  return {
    health: Math.round((elite ? 155 : 78 + wave * 7) * difficulty.health),
    damage: (elite ? 10 : 5 + wave * 0.65) * difficulty.damage,
    accuracy: Math.min(
      0.82,
      (elite ? 0.48 : 0.24 + wave * 0.025) * difficulty.accuracy,
    ),
    reactionTime: Math.max(
      0.22,
      (elite ? 0.5 : 1.1 - wave * 0.07) * difficulty.reaction,
    ),
    moveSpeed:
      (elite ? 3.9 : 2.8 + wave * 0.15) *
      difficulty.speed *
      (role === "assault" ? 1.3 : role === "defender" ? 0.75 : 0.95),
    fireRate: (elite ? 3.5 : 2.3) * difficulty.fireRate,
    detectionRange: 30,
    visionAngle: Math.PI * 0.72,
    range: role === "assault" ? 9 : role === "defender" ? 17 : 22,
    burstCount: (elite ? 4 : 3) + difficulty.extraBurst,
    burstPause: difficulty.burstPause,
  };
}
export class Enemy extends Health {
  state: EnemyState = "Idle";
  shield: Mesh | undefined;
  shieldHealth = 120;
  repairClock = 0;
  repairFlash = 0;
  onRepair: (target: Enemy) => void = () => {};
  body: Mesh;
  root: TransformNode;
  parts: Mesh[] = [];
  mat: StandardMaterial;
  lastKnown = Vector3.Zero();
  think = 0;
  lost = 0;
  reaction = 0;
  fireClock = 0;
  burst = 0;
  path: Vector3[] = [];
  pathClock = 0;
  flash = 0;
  private statusLight: StandardMaterial;
  private statusKey = "";
  stagger = 0;
  attackCue = 0;
  private attackReady = false;
  objectiveTarget?: Vector3;
  objectiveKind: ObjectiveKind = "eliminate";
  animation = 0;
  shutdown: RobotShutdown;
  searchTime = 0;
  home: Vector3;
  onAttack: (e: Enemy) => void = () => {};
  onAlert: () => void = () => {};
  onTelegraph: (e: Enemy) => void = () => {};
  constructor(
    public scene: Scene,
    public level: Level,
    public navigation: Navigation,
    public config: EnemyConfig,
    pos: Vector3,
    id: string,
    public elite = false,
    public role: EnemyRole = "assault",
  ) {
    super(id, config.health);
    this.home = pos.clone();
    this.lastKnown.copyFrom(pos);
    this.body = MeshBuilder.CreateBox("enemy collider", { size: 1 }, scene);
    this.body.position.copyFrom(pos).y += 0.9;
    this.body.ellipsoid = new Vector3(0.4, 0.85, 0.4);
    this.body.isVisible = false;
    this.body.isPickable = false;
    this.root = new TransformNode("sentinel " + id, scene);
    this.root.position.copyFrom(pos);
    this.root.rotation.y = Math.atan2(-pos.x, -17 - pos.z);
    this.mat = new StandardMaterial("sentinel armor " + id, scene);
    this.mat.diffuseColor = Color3.FromHexString(
      role === "support"
        ? gameTheme.colors.concrete
        : role === "defender"
          ? gameTheme.colors.paint
          : gameTheme.colors.steel,
    );
    this.mat.specularColor = new Color3(0.16, 0.16, 0.16);
    const { joint, inset } = robotSurfaces(scene);
    const visor = new StandardMaterial("visor " + id, scene);
    visor.emissiveColor = Color3.FromHexString(elite ? "#edac58" : "#e56561");
    visor.disableLighting = true;
    this.statusLight = visor;
    const part = (
      name: string,
      position: Vector3,
      size: Vector3,
      material = this.mat,
      head = false,
    ) => {
      const m = MeshBuilder.CreateBox(
        name,
        { width: size.x, height: size.y, depth: size.z },
        scene,
      );
      m.parent = this.root;
      m.position.copyFrom(position);
      m.material = material;
      m.metadata = { entity: this, head };
      this.parts.push(m);
      if (name === "torso" || name === "head" || name === "front shield")
        level.shadows.addShadowCaster(m);
      return m;
    };
    part("torso", new Vector3(0, 1.14, 0), new Vector3(0.63, 0.7, 0.38));
    part(
      "chest plate",
      new Vector3(0, 1.29, 0.23),
      new Vector3(0.49, 0.25, 0.12),
    );
    part("chest inset", new Vector3(0, 1.29, 0.301), new Vector3(0.31, 0.14, 0.035), inset);
    for (const x of [-0.2, 0.2])
      part("chest fastener", new Vector3(x, 1.3, 0.304),
        new Vector3(0.045, 0.12, 0.045), joint);
    part("waist", new Vector3(0, 0.71, 0), new Vector3(0.4, 0.19, 0.3), joint);
    part(
      "head",
      new Vector3(0, 1.77, 0),
      new Vector3(0.37, 0.36, 0.37),
      this.mat,
      true,
    );
    part(
      "visor",
      new Vector3(0, 1.79, 0.195),
      new Vector3(0.3, 0.08, 0.025),
      visor,
      true,
    );
    part("helmet brow", new Vector3(0, 1.91, 0.2), new Vector3(.42, .07, .12), inset, true);
    part("helmet jaw", new Vector3(0, 1.64, 0.17), new Vector3(.27, .08, .14), joint, true);
    for (const x of [-0.23, 0.23]) {
      part("leg", new Vector3(x, 0.39, 0), new Vector3(0.2, 0.65, 0.23), joint);
      part("shin", new Vector3(x, 0.26, 0.04), new Vector3(0.23, 0.3, 0.25));
      part("knee guard", new Vector3(x, .43, .155), new Vector3(.24, .13, .08), inset);
      part(
        "foot",
        new Vector3(x, 0.065, 0.07),
        new Vector3(0.25, 0.13, 0.37),
        joint,
      );
    }
    for (const x of [-0.44, 0.44]) {
      part("shoulder", new Vector3(x, 1.34, 0), new Vector3(0.22, 0.28, 0.32));
      part("shoulder cap", new Vector3(x * 1.15, 1.47, .02),
        new Vector3(.13, .08, .31), inset);
      part(
        "arm",
        new Vector3(x, 1.05, 0.1),
        new Vector3(0.15, 0.38, 0.21),
        joint,
      );
    }
    part(
      "blaster",
      new Vector3(0.43, 1.14, 0.39),
      new Vector3(0.15, 0.15, 0.57),
      joint,
    );
    part(
      "status",
      new Vector3(0, 1.1, 0.2),
      new Vector3(0.14, 0.04, 0.025),
      visor,
    );
    if (role === "defender") {
      const shieldMat = new StandardMaterial("shield " + id, scene);
      shieldMat.diffuseColor = Color3.FromHexString(gameTheme.colors.paint);
      shieldMat.emissiveColor = new Color3(0.01, 0.025, 0.035);
      this.shield = part(
        "front shield",
        new Vector3(-0.1, 1.03, 0.57),
        new Vector3(1.15, 1.3, 0.13),
        shieldMat,
      );
      this.shield.metadata.shield = true;
      for (const m of [
        part("shield upper rim", new Vector3(-.1, 1.69, .665),
          new Vector3(1.2, .09, .08), joint),
        part("shield viewport", new Vector3(-.1, 1.4, .668),
          new Vector3(.6, .13, .07), inset),
      ]) m.isPickable = false;
    }
    if (role === "support") {
      part(
        "repair pack",
        new Vector3(0, 1.2, -0.32),
        new Vector3(0.55, 0.65, 0.3),
        joint,
      );
      for (const x of [-.19, .19])
        part("repair pack rail", new Vector3(x, 1.2, -.49),
          new Vector3(.08, .53, .06), inset);
      part(
        "repair beacon",
        new Vector3(0, 2.04, 0),
        new Vector3(0.2, 0.14, 0.2),
        visor,
      );
    }
    this.shutdown = new RobotShutdown(this.root, this.parts);
    this.think = Math.random() * 0.15;
  }
  get position(): Vector3 {
    return this.root.position;
  }
  get eye(): Vector3 {
    return this.position.add(new Vector3(0, 1.65, 0));
  }
  setObjectiveTarget(point: Vector3 | undefined, kind: ObjectiveKind): void {
    if (this.objectiveKind === kind &&
        (!point && !this.objectiveTarget || point && this.objectiveTarget &&
          Vector3.DistanceSquared(point, this.objectiveTarget) < .01)) return;
    this.objectiveKind = kind;
    this.objectiveTarget = point?.clone();
    this.pathClock = 0;
    if (point && this.state !== "Dead" &&
        (this.state === "Idle" || this.state === "Patrol")) {
      this.lastKnown.copyFrom(point);
      this.state = "Investigate";
    }
  }
  hear(pos: Vector3, radius: number): void {
    if (
      this.state === "Dead" ||
      this.state === "Attack" ||
      this.state === "Chase"
    )
      return;
    if (Vector3.DistanceSquared(this.position, pos) < radius * radius) {
      this.lastKnown.copyFrom(pos);
      this.state = "Investigate";
      this.pathClock = 0;
    }
  }
  receiveDamage(info: DamageInfo): boolean {
    if (this.health <= 0) return false;
    if (info.shield && this.shieldHealth > 0 && this.shield) {
      this.shieldHealth = Math.max(0, this.shieldHealth - info.damage);
      this.shield.setEnabled(this.shieldHealth > 0);
      if (this.shieldHealth === 0)
        for (const p of this.parts)
          if (p.name === "shield upper rim" || p.name === "shield viewport") p.setEnabled(false);
      this.state = "Chase";
      return false;
    }
    const dead = super.receiveDamage(info);
    this.flash = 0.12;
    this.mat.emissiveColor.set(.7, .32, .1);
    this.stagger = 0.12;
    this.attackCue = 0;
    this.attackReady = false;
    this.state = dead ? "Dead" : "Chase";
    if (dead) {
      this.shutdown.start(info.hitNormal);
      for (const p of this.parts) p.isPickable = false;
    }
    return dead;
  }
  repair(others: Enemy[]): void {
    if (this.role !== "support" || this.health <= 0) return;
    const target = others
      .filter(
        (e) =>
          e !== this &&
          e.health > 0 &&
          e.health < e.maxHealth &&
          Vector3.DistanceSquared(this.position, e.position) <= 64 &&
          this.level.lineClear(this.eye, e.eye),
      )
      .sort((a, b) =>
        a.health / a.maxHealth - (this.objectiveTarget && a.role === "defender" ? .16 : 0) -
        b.health / b.maxHealth + (this.objectiveTarget && b.role === "defender" ? .16 : 0))[0];
    if (!target) return;
    target.health = Math.min(target.maxHealth, target.health + 12);
    target.repairFlash = 0.35;
    this.repairFlash = 0.35;
    this.onRepair(target);
  }
  update(dt: number, player: Player, others: Enemy[]): void {
    this.animation += dt;
    this.repairFlash = Math.max(0, this.repairFlash - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.stagger = Math.max(0, this.stagger - dt);
    this.attackCue = Math.max(0, this.attackCue - dt);
    this.mat.emissiveColor.set(
      this.flash > 0 ? 0.7 : 0,
      this.flash > 0 ? 0.32 : this.repairFlash > 0 ? 0.25 : 0,
      this.flash > 0 ? 0.1 : this.repairFlash > 0 ? 0.4 : 0,
    );
    if (this.state === "Dead") {
      this.shutdown.update(dt);
      return;
    }
    const alert = this.state === "Chase" || this.state === "Attack";
    const glow =
      this.attackReady && this.attackCue > 0
        ? gameTheme.colors.amber
        : this.repairFlash > 0
        ? gameTheme.colors.blue
        : this.elite
          ? gameTheme.colors.amber
          : gameTheme.colors.danger;
    const statusKey = glow + alert + (this.attackReady && this.attackCue > 0);
    if (statusKey !== this.statusKey) {
      this.statusKey = statusKey;
      this.statusLight.emissiveColor
        .copyFrom(Color3.FromHexString(glow))
        .scaleInPlace(this.attackReady && this.attackCue > 0 ? 1.5 : alert ? 1 : 0.45);
    }
    this.repairClock -= dt;
    if (this.repairClock <= 0) {
      this.repairClock = 1.5;
      this.repair(others);
    }
    this.think -= dt;
    this.pathClock -= dt;
    this.fireClock -= dt;
    this.reaction -= dt;
    if (this.think <= 0) {
      this.think = 0.12;
      const offset = player.camera.position.subtract(this.eye),
        distance = offset.length();
      const forward = new Vector3(
        Math.sin(this.root.rotation.y),
        0,
        Math.cos(this.root.rotation.y),
      );
      const dot = Vector3.Dot(forward, offset.normalizeToNew());
      const alerted = ["Chase", "Attack"].includes(this.state);
      const visible =
        distance < this.config.detectionRange &&
        (alerted || dot > Math.cos(this.config.visionAngle / 2)) &&
        this.level.lineClear(this.eye, player.camera.position);
      if (visible) {
        if (!alerted) {
          this.reaction = this.config.reactionTime;
          this.onAlert();
        }
        this.lastKnown.copyFrom(player.feet);
        this.lost = 0;
        this.state = distance < this.config.range ? "Attack" : "Chase";
        // Guards contest the active objective; supporters follow to keep them repaired.
        if (this.objectiveTarget && this.role !== "assault" &&
            Vector3.DistanceSquared(this.position, this.objectiveTarget) >
              (this.role === "defender" ? 9 : 22)) this.state = "Chase";
      } else {
        this.lost += 0.12;
        if (this.state === "Attack") this.state = "Chase";
        if (this.state === "Chase" && this.lost > 1.1) this.state = "Search";
        if (this.state === "Idle") {
          this.searchTime += 0.12;
          if (this.searchTime > 0.8) this.state = "Patrol";
        }
      }
      if (!visible || this.state !== "Attack") {
        this.attackReady = false;
        this.attackCue = 0;
      }
      if (
        this.state === "Attack" &&
        this.reaction <= 0 &&
        this.fireClock <= 0 &&
        this.stagger <= 0 &&
        visible
      ) {
        if (this.burst === 0 && !this.attackReady) {
          this.attackReady = true;
          this.attackCue = Math.max(.4, Math.min(.65, this.config.reactionTime * .7));
          this.onTelegraph(this);
        } else if (this.attackCue <= 0) {
          this.onAttack(this);
          this.attackReady = false;
          this.burst++;
          this.fireClock = this.burst >= this.config.burstCount
            ? this.config.burstPause : 1 / this.config.fireRate;
          if (this.burst >= this.config.burstCount) this.burst = 0;
        }
      }
    }
    let goal = this.lastKnown;
    if (this.objectiveTarget && this.role !== "assault" &&
        Vector3.DistanceSquared(this.position, this.objectiveTarget) >
          (this.role === "defender" ? 9 : 22)) goal = this.objectiveTarget;
    if (this.state === "Patrol") {
      goal = this.home.add(
        new Vector3(
          Math.sin(this.animation * 0.12) * 4,
          0,
          Math.cos(this.animation * 0.12) * 3,
        ),
      );
    }
    if (this.state === "Attack") {
      const d = player.feet.subtract(this.position);
      this.root.rotation.y = Math.atan2(d.x, d.z);
      return;
    }
    if (this.state === "Idle") return;
    if (Vector3.DistanceSquared(this.position, goal) < 1.8) {
      if (this.state === "Search" || this.state === "Investigate") {
        this.searchTime += dt;
        this.root.rotation.y += dt * 0.9;
        if (this.searchTime > 4) {
          this.state = "Patrol";
          this.searchTime = 0;
        }
      }
      return;
    }
    if (this.pathClock <= 0) {
      this.pathClock = 0.9 + Math.random() * 0.25;
      this.path = this.navigation.route(this.position, goal);
    }
    while (
      this.path.length &&
      Vector3.DistanceSquared(this.position, this.path[0]) < 0.5
    )
      this.path.shift();
    const waypoint = this.path[0];
    if (!waypoint) return;
    const direction = waypoint.subtract(this.position);
    direction.y = 0;
    direction.normalize();
    for (const other of others)
      if (other !== this && other.state !== "Dead") {
        const separation = this.position.subtract(other.position);
        const d = separation.length();
        if (d < 1.1 && d > 0.01)
          direction.addInPlace(separation.scale(((1.1 - d) * 0.8) / d));
      }
    direction.normalize();
    const speed =
      this.config.moveSpeed *
      (this.state === "Patrol" ? 0.55 : 1) *
      (this.stagger > 0 ? 0.2 : 1);
    this.body.moveWithCollisions(
      new Vector3(direction.x * speed * dt, -4 * dt, direction.z * speed * dt),
    );
    this.root.position.copyFrom(this.body.position).y -= 0.9;
    this.root.position.y = Math.max(0, this.root.position.y);
    this.root.rotation.y = Math.atan2(direction.x, direction.z);
    for (const p of this.parts)
      if (p.name === "leg")
        p.rotation.x =
          Math.sin(this.animation * 9 + (p.position.x > 0 ? 0 : Math.PI)) *
          0.24;
  }
  dispose(): void {
    const { joint, inset } = robotSurfaces(this.scene);
    const materials = new Set(this.parts.map((p) => p.material));
    for (const m of materials) if (m && m !== joint && m !== inset) m.dispose();
    for (const p of this.parts) {
      this.level.shadows.removeShadowCaster(p);
      p.dispose();
    }
    this.root.dispose();
    this.body.dispose();
    this.mat.dispose();
  }
}
