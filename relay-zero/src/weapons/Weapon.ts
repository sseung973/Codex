import { pickWorld } from "../world/WorldQuery";
import { WeaponMotion } from "./WeaponMotion";
import { withAttachments, type AttachmentInventory } from "./Attachments";
import { starters, catalog } from "./Arsenal";
import type { WeaponData } from "./WeaponData";
import { recoilImpulse } from "./Recoil";
import { WeaponModels } from "./WeaponModels";
import { meleeHit } from "./Melee";
import {
  Scene,
  TransformNode,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Ray,
  Mesh,
  PointLight,
} from "@babylonjs/core";
import { Player } from "../player/Player";
import { Audio } from "../audio/Audio";
import { Effects } from "../effects/Effects";
import { damp } from "../core/Settings";
import { Magazine, rifle, pistol, baton } from "./WeaponData";
import type { IDamageable, DamageInfo } from "../combat/Damage";
export class Weapon {
  magazines = [new Magazine(rifle), new Magazine(pistol), new Magazine(baton)];
  slot = 0;
  primaryOwned = true;
  inventory = new Map<string, Magazine>();
  upgrades: AttachmentInventory = new Map();
  root: TransformNode;
  muzzle: Mesh;
  flash: Mesh;
  muzzleLight: PointLight;
  models: WeaponModels;
  motion: WeaponMotion;
  dryTime = 0;
  swingTime = 0;
  swingPending = false;
  nearWall = 0;
  cooldown = 0;
  flashTime = 0;
  heat = 0;
  shots = 0;
  burstIdle = 0;
  ads = 0;
  spread = 0;
  held = false;
  onHit: (head: boolean, kill: boolean, target: IDamageable) => void = () => {};
  onBlocked: (target: IDamageable) => void = () => {};
  onShot: () => void = () => {};
  constructor(
    public scene: Scene,
    public player: Player,
    public audio: Audio,
    public effects: Effects,
  ) {
    this.root = new TransformNode("weaponRoot", scene);
    this.root.parent = player.camera;
    this.motion = new WeaponMotion(scene, this.root);
    this.motion.reset();
    this.models = new WeaponModels(scene, this.motion.recoil);
    this.muzzle = this.models.views[0].muzzle;
    const flashMat = new StandardMaterial("flash", scene);
    flashMat.emissiveColor = new Color3(1, 0.76, 0.33);
    flashMat.disableLighting = true;
    this.flash = MeshBuilder.CreateSphere(
      "muzzle flash",
      { diameter: 0.09, segments: 4 },
      scene,
    );
    this.flash.parent = this.muzzle;
    this.flash.position.set(0, 0.07, 0);
    this.flash.scaling.set(0.7, 1.6, 0.7);
    this.flash.material = flashMat;
    this.flash.isPickable = false;
    this.flash.renderingGroupId = 1;
    this.flash.setEnabled(false);
    this.muzzleLight = new PointLight(
      "weapon flash pulse",
      Vector3.Zero(),
      scene,
    );
    this.muzzleLight.diffuse = new Color3(1, 0.72, 0.36);
    this.muzzleLight.range = 2;
    this.muzzleLight.renderPriority = 1;
    this.muzzleLight.includedOnlyMeshes = this.models.views.flatMap((v) =>
      v.root.getChildMeshes(),
    );
    this.muzzleLight.intensity = 0;
    scene.setRenderingAutoClearDepthStencil(1, true, true, true);
  }
  get mag(): Magazine {
    return this.magazines[this.slot];
  }
  get data() {
    return this.mag.data;
  }
  get melee(): boolean {
    return this.data.weaponType === "melee";
  }
  get aiming(): boolean {
    return (
      !this.melee &&
      this.player.state !== "Dashing" &&
      this.player.input.ads &&
      this.mag.reloadRemaining <= 0
    );
  }
  get reloading(): boolean {
    return this.mag.reloadRemaining > 0;
  }
  switchTo(slot: number): void {
    if (
      slot === this.slot ||
      slot < 0 ||
      slot >= this.magazines.length ||
      (slot === 0 && !this.primaryOwned)
    )
      return;
    this.mag.reloadRemaining = 0;
    this.slot = slot;
    this.shots = 0;
    this.burstIdle = 0;
    this.cooldown = 0.25;
    this.motion.reset();
    this.dryTime = 0;
    this.held = true;
    this.swingPending = false;
    this.swingTime = 0;
    this.flashTime = 0;
    this.flash.setEnabled(false);
    this.muzzleLight.intensity = 0;
    this.models.select(slot);
    this.muzzle = this.models.views[slot].muzzle;
    this.flash.parent = this.muzzle;
  }
  update(dt: number): void {
    if (this.swingTime > 0) {
      this.swingTime = Math.max(0, this.swingTime - dt);
      if (this.swingPending && this.swingTime <= 0.3) {
        this.swingPending = false;
        this.strike();
      }
    }
    this.player.recoilRecovery = this.data.recoilRecovery;
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.dryTime = Math.max(0, this.dryTime - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.mag.update(dt)) this.audio.play("reload");
    if (this.player.input.consume("Digit1")) this.switchTo(0);
    if (this.player.input.consume("Digit2")) this.switchTo(1);
    if (this.player.input.consume("Digit3")) this.switchTo(2);
    if (this.player.input.wheel) {
      let next = (this.slot + this.player.input.wheel + 3) % 3;
      if (next === 0 && !this.primaryOwned)
        next = (next + this.player.input.wheel + 3) % 3;
      this.switchTo(next);
    }
    if (this.player.input.consume("KeyR") && !this.melee && this.mag.reload())
      this.audio.play("reload");
    this.ads = damp(this.ads, this.aiming ? 1 : 0, 15, dt);
    this.models.views[this.slot].root.setEnabled(
      !(this.aiming && this.data.weaponType === "sniper"),
    );
    this.heat = Math.max(0, this.heat - dt * 1.8);
    this.burstIdle += dt;
    if (this.burstIdle > 0.32) this.shots = 0;
    const moving =
      this.player.velocity.x ** 2 + this.player.velocity.z ** 2 > 2;
    this.spread =
      (this.aiming ? this.data.adsSpread : this.data.baseSpread) +
      (moving ? this.data.movementSpread * (this.aiming ? 0.25 : 1) : 0) +
      (!this.player.grounded ? this.data.airSpread : 0) +
      this.heat * 0.002;
    if (this.player.crouched) this.spread *= 0.7;
    if (
      (this.player.input.fire || this.player.input.firePressed) &&
      (!this.held || this.data.automatic) &&
      this.cooldown === 0 &&
      !this.reloading &&
      this.player.state !== "Sprinting" &&
      this.player.state !== "Dashing"
    )
      this.fire();
    this.held = this.player.input.fire;
    const reload = this.reloading
      ? Math.sin(
          (1 - this.mag.reloadRemaining / this.mag.reloadDuration) * Math.PI,
        )
      : 0;
    const wall = pickWorld(this.scene, this.player.camera.getForwardRay(1.05));
    this.nearWall = damp(
      this.nearWall,
      wall?.hit ? Math.max(0, 1 - wall.distance / 1.05) : 0,
      18,
      dt,
    );
    const swing =
      this.melee && this.swingTime > 0
        ? Math.sin((1 - this.swingTime / 0.48) * Math.PI)
        : 0;
    this.motion.update(dt, {
      ads: this.ads,
      sprint: this.player.state === "Sprinting",
      grounded: this.player.grounded,
      moving,
      dx: this.player.input.dx,
      dy: this.player.input.dy,
      strafe:
        Number(this.player.input.down("KeyD")) -
        Number(this.player.input.down("KeyA")),
      reload,
      wall: this.nearWall,
      swing,
      sniper: this.data.weaponType === "sniper",
    });
    const visibleFlash =
      !this.melee &&
      this.flashTime > 0 &&
      !(this.aiming && this.data.weaponType === "sniper");
    this.flash.setEnabled(visibleFlash);
    this.muzzle.computeWorldMatrix(true);
    this.muzzleLight.position.copyFrom(this.muzzle.getAbsolutePosition());
    this.muzzleLight.intensity = visibleFlash
      ? 1.4 * Math.min(1, this.flashTime / 0.024)
      : 0;
  }
  strike(): void {
    const ray = this.player.camera.getForwardRay(this.data.range);
    const hit = meleeHit(
      this.scene,
      ray.origin,
      ray.direction,
      this.data.range,
    );
    const entity = hit?.pickedMesh?.metadata?.entity as IDamageable | undefined;
    if (!hit?.pickedPoint || !entity) return;
    const kill = entity.receiveDamage({
      damage: this.data.damage,
      source: "player",
      target: entity.id,
      hitPoint: hit.pickedPoint,
      hitNormal: hit.getNormal(true) || Vector3.Up(),
      isHeadshot: false,
      damageType: "melee",
      shield: hit.pickedMesh?.metadata?.shield === true,
    });
    this.effects.impact(hit.pickedPoint, !!hit.pickedMesh?.metadata?.entity);
    this.audio.play("hit");
    if (hit.pickedMesh?.metadata?.shield) this.onBlocked(entity);
    else this.onHit(false, kill, entity);
  }
  fire(): void {
    if (this.melee) {
      this.cooldown = 1 / this.data.fireRate;
      this.swingTime = 0.48;
      this.swingPending = true;
      this.audio.play("swing");
      return;
    }

    if (this.mag.ammo <= 0) {
      this.audio.play("dry");
      this.dryTime = 0.18;
      this.cooldown = 0.22;
      return;
    }
    this.mag.ammo--;
    this.flashTime = 0.024;
    this.flash.rotation.y = (this.shots * 2.4) % (Math.PI * 2);
    this.cooldown = 1 / this.data.fireRate;
    this.shots++;
    this.burstIdle = 0;
    this.heat = Math.min(3, this.heat + 0.36);
    this.audio.play("fire");
    this.onShot();
    const camera = this.player.camera;
    camera.computeWorldMatrix();
    const ray = camera.getForwardRay(this.data.range);
    const right = Vector3.Cross(Vector3.Up(), ray.direction).normalize(),
      up = Vector3.Cross(ray.direction, right).normalize();
    const angle = Math.random() * Math.PI * 2,
      radius = Math.sqrt(Math.random()) * this.spread;
    ray.direction
      .addInPlace(right.scale(Math.cos(angle) * radius))
      .addInPlace(up.scale(Math.sin(angle) * radius))
      .normalize();
    let hit = this.scene.pickWithRay(
      ray,
      (m) => m.isEnabled() && m.isPickable && m !== this.player.body,
    );
    this.root.computeWorldMatrix(true);
    this.muzzle.computeWorldMatrix(true);
    const muzzle = this.muzzle.getAbsolutePosition();
    let target =
      hit?.pickedPoint || ray.origin.add(ray.direction.scale(this.data.range));
    // Camera-to-muzzle and muzzle-to-target obstruction tests prevent wall penetration.
    const toMuzzle = muzzle.subtract(camera.position);
    const block = pickWorld(
      this.scene,
      new Ray(camera.position, toMuzzle.normalizeToNew(), toMuzzle.length()),
    );
    if (block?.hit) {
      hit = block;
      target = block.pickedPoint!;
    } else {
      const path = target.subtract(muzzle);
      const obstruction = pickWorld(
        this.scene,
        new Ray(muzzle, path.normalizeToNew(), path.length()),
      );
      if (obstruction?.hit && obstruction.distance < path.length() - 0.08) {
        hit = obstruction;
        target = obstruction.pickedPoint!;
      }
    }
    this.effects.tracer(block?.hit ? camera.position : muzzle, target);
    if (hit?.hit && hit.pickedPoint) {
      this.effects.impact(hit.pickedPoint, !!hit.pickedMesh?.metadata?.entity);
      const entity = hit.pickedMesh?.metadata?.entity as
        IDamageable | undefined;
      if (entity && entity.health > 0) {
        const head = hit.pickedMesh?.metadata?.head === true;
        const info: DamageInfo = {
          damage: this.data.damage * (head ? this.data.headshotMultiplier : 1),
          source: "player",
          target: entity.id,
          hitPoint: hit.pickedPoint,
          hitNormal: hit.getNormal(true) || Vector3.Up(),
          isHeadshot: head,
          damageType: "hitscan",
          shield: hit.pickedMesh?.metadata?.shield === true,
          weakpoint: hit.pickedMesh?.metadata?.weakpoint === true,
        };
        const killed = entity.receiveDamage(info);
        this.audio.play(head ? "headshot" : "hit");
        if (info.shield) this.onBlocked(entity);
        else this.onHit(head, killed, entity);
      }
    }
    const impulse = recoilImpulse(
      this.data,
      this.shots,
      this.aiming,
      this.player.crouched,
      this.player.state === "Walking",
      !this.player.grounded,
    );
    this.player.recoilPitch = Math.min(
      0.24,
      this.player.recoilPitch + impulse.pitch,
    );
    this.player.recoilYaw = Math.max(
      -0.06,
      Math.min(0.06, this.player.recoilYaw + impulse.yaw),
    );
    this.player.recoilDelay = 0.18;
    this.player.updateCamera(0, this.aiming);
    this.motion.shot(this.data.cameraKick, this.shots, this.ads);
  }
  startLoadout(id: string, practice = false): void {
    this.reset();
    this.inventory.clear();
    this.upgrades = new Map();
    this.primaryOwned = practice;
    this.magazines = [
      new Magazine(rifle),
      new Magazine(starters.find((p) => p.id === id) ?? pistol),
      new Magazine(baton),
    ];
    this.models.configure(0, rifle);
    this.models.configure(1, this.magazines[1].data);
    if (!practice) this.switchTo(1);
  }
  applyAttachments(upgrades: AttachmentInventory): void {
    this.upgrades = upgrades;
    for (const m of new Set([...this.magazines, ...this.inventory.values()])) {
      const base = [...starters, ...catalog.map((item) => item.data)].find(
        (w) => w.id === m.data.id,
      );
      if (!base) continue;
      m.data = withAttachments(base, upgrades.get(base.id));
      m.reloadRemaining = 0;
    }
  }
  equipPrimary(data: WeaponData): void {
    if (this.primaryOwned)
      this.inventory.set(this.magazines[0].data.id, this.magazines[0]);
    this.magazines[0] =
      this.inventory.get(data.id) ??
      new Magazine(withAttachments(data, this.upgrades.get(data.id)));
    this.inventory.set(data.id, this.magazines[0]);
    this.primaryOwned = true;
    this.models.configure(0, data);
    if (this.slot === 0) this.slot = 1;
    this.switchTo(0);
  }
  reset(): void {
    for (const m of this.magazines) m.reset();
    this.slot = 0;
    this.models.select(0);
    this.muzzle = this.models.views[0].muzzle;
    this.flash.parent = this.muzzle;
    this.motion.reset();
    this.dryTime = 0;
    this.swingTime = 0;
    this.swingPending = false;
    this.nearWall = 0;
    this.flashTime = 0;
    this.cooldown = 0;
    this.heat = 0;
    this.shots = 0;
    this.burstIdle = 0;
    this.held = false;
    this.ads = 0;
    this.flash.setEnabled(false);
    this.muzzleLight.intensity = 0;
  }
}
