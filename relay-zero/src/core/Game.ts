import { PerformanceBudget } from "./PerformanceBudget";
import { Equipment } from "../weapons/Equipment";
import { ArenaDevices, PowerCell } from "../world/ArenaDevices";
import { Sniper, Bomber } from "../ai/Specialists";
import { EndlessRecords } from "./RunStats";
import { gameTheme } from "../visual/GameTheme";
import { Wallet, catalog } from "../weapons/Arsenal";
import { Objectives, objectiveForWave, objectiveNames } from "./Objectives";
import { ObjectiveMarker, objectivePoints } from "../world/ObjectiveMarker";
import { RunStats, Records } from "./RunStats";
import { MapId, maps } from "../world/MapData";
import { difficulties, Difficulty } from "./Difficulty";
import {
  Engine,
  Scene,
  Vector3,
  DefaultRenderingPipeline,
  Color3,
} from "@babylonjs/core";
import { Level } from "../world/Level";
import { PlayerInput } from "../player/PlayerInput";
import { Player } from "../player/Player";
import { Weapon } from "../weapons/Weapon";
import { Effects } from "../effects/Effects";
import { Audio } from "../audio/Audio";
import { HUD } from "../ui/HUD";
import { loadSettings } from "./Settings";
import { Target } from "../ai/Target";
import { Navigation } from "../ai/Navigation";
import { Enemy, enemyConfig, combatRole } from "../ai/Enemy";
import { Commander } from "../ai/Commander";
import { Waves } from "./Waves";
export class Game {
  engine: Engine;
  scene: Scene;
  level: Level;
  navigation: Navigation;
  input: PlayerInput;
  player: Player;
  weapon: Weapon;
  effects: Effects;
  audio: Audio;
  hud: HUD;
  targets: Target[] = [];
  enemies: Enemy[] = [];
  objectives = new Objectives();
  marker: ObjectiveMarker;
  missionPoints: Vector3[] = [];
  settings = loadSettings();
  waves = new Waves();
  difficulty: Difficulty = difficulties.normal;
  pipeline: DefaultRenderingPipeline;
  running = false;
  started = false;
  finished = false;
  practice = false;
  equipment: Equipment;
  devices: ArenaDevices;
  endlessRecords = new EndlessRecords();
  private accounted = new Set<string>();
  private pendingDeaths = 0;
  private resolvingBlast = false;
  private blasts: {
    point: Vector3;
    radius: number;
    damage: number;
    playerDamage: number;
    credited: boolean;
  }[] = [];
  wallet = new Wallet();
  shopping = false;
  score = 0;
  kills = 0;
  headshots = 0;
  stats = new RunStats();
  records = new Records();
  time = 0;
  hudTime = 0;
  debug = false;
  private graphics = new PerformanceBudget();
  private graphicsRequest = "";
  private lastRender = 0;
  private frameMs = 0;
  private framePeakMs = 0;
  private renderCpuMs = 0;
  private metricWindow = 0;
  damageCooldown = 0;
  private enemyCueCooldown = 0;
  constructor(canvas: HTMLCanvasElement, hud: HUD) {
    this.settings = hud.settings;
    this.engine = new Engine(canvas, false, {
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: false,
      adaptToDeviceRatio: false,
    });
    this.scene = new Scene(this.engine);
    // Pointer lock input is handled by PlayerInput; Babylon pointer picking is unused.
    this.scene.skipPointerMovePicking = true;
    this.scene.skipPointerDownPicking = true;
    this.scene.skipPointerUpPicking = true;
    this.level = new Level(this.scene, hud.selectedMap);
    this.navigation = new Navigation(this.level);
    this.missionPoints = objectivePoints(this.navigation, this.level);
    this.input = new PlayerInput(canvas);
    this.player = new Player(this.scene, this.input, this.settings);
    this.audio = new Audio(this.settings);
    this.effects = new Effects(this.scene);
    this.equipment = new Equipment(this.scene, this.level);
    this.equipment.onEMP = (count) => {
      this.audio.play("alert", 0.35);
      this.hud.toast(`EMP 방출 · ${count}기 정지`, 1.5);
    };
    this.devices = this.buildDevices();
    this.level.optimize();
    this.player.body.surroundingMeshes = this.level.solids;
    this.marker = new ObjectiveMarker(this.scene);
    this.weapon = new Weapon(this.scene, this.player, this.audio, this.effects);
    this.hud = hud;
    this.player.resetAt(this.level.spawn);
    this.weapon.root.setEnabled(false);
    this.pipeline = new DefaultRenderingPipeline("quality", false, this.scene, [
      this.player.camera,
    ]);
    this.pipeline.bloomThreshold = 0.85;
    this.pipeline.bloomWeight = gameTheme.lighting.bloom;
    this.pipeline.bloomKernel = 32;
    this.pipeline.imageProcessingEnabled = true;
    this.pipeline.imageProcessing.contrast = gameTheme.lighting.contrast;
    this.pipeline.imageProcessing.exposure = gameTheme.lighting.exposure;
    this.pipeline.imageProcessing.toneMappingEnabled = true;
    this.player.camera.position.set(10, 5.4, -15);
    this.player.camera.setTarget(new Vector3(-1, 2.2, 7));
    this.applySettings();
    this.hud.onMap = (id) => this.selectMap(id);
    this.hud.onPlay = () => {
      this.difficulty = difficulties[this.hud.selectedDifficulty];
      this.start(false);
    };
    this.hud.onPractice = () => this.start(true);
    this.hud.onShop = () => this.openShop();
    this.hud.onEndless = () => this.continueEndless();
    this.hud.onEMPBuy = () => {
      if (!this.shopping || this.finished || this.waves.intermission <= 0)
        return;
      if (this.equipment.buy(this.wallet)) {
        this.audio.play("ui");
        this.refreshShop();
      }
    };
    this.hud.onAttachment = (weaponId, id) => {
      if (!this.shopping || this.finished || this.waves.intermission <= 0)
        return;
      if (
        weaponId !== this.weapon.magazines[1].data.id &&
        !this.wallet.owned.has(weaponId)
      )
        return;
      if (this.wallet.buyAttachment(weaponId, id)) {
        this.weapon.applyAttachments(this.wallet.upgrades);
        this.audio.play("ui");
        this.refreshShop();
      }
    };
    this.hud.onBuy = (id) => {
      if (!this.shopping || this.finished || this.waves.intermission <= 0)
        return;
      const item = catalog.find((item) => item.data.id === id);
      if (item && this.wallet.buy(id)) {
        this.weapon.equipPrimary(item.data);
        this.audio.play("ui");
        this.refreshShop();
        this.updateHUD();
      }
    };
    this.hud.onResume = () => {
      this.shopping = false;
      void this.audio.unlock();
      this.input.request();
    };
    this.hud.onRestart = () => this.start(this.practice);
    this.hud.onExit = () => this.exitToMenu();
    this.input.onLockChange = (locked) => {
      this.running = locked && this.started && !this.finished && !this.shopping;
      if (this.shopping) {
        if (locked) document.exitPointerLock();
        return;
      }
      if (!this.finished)
        this.hud.show(
          this.running ? "playing" : this.started ? "pause" : "start",
        );
      if (locked) this.hud.el("error").hidden = true;
    };
    this.input.onError = () => {
      this.running = false;
      if (this.started && !this.finished && !this.shopping)
        this.hud.show("pause");
      this.hud.error(
        "Mouse capture failed. Open in a desktop browser, then click Resume.",
      );
    };
    canvas.addEventListener("click", () => {
      if (
        this.started &&
        !this.running &&
        !this.finished &&
        !this.shopping &&
        this.hud.el("settings-panel").hidden
      )
        this.input.request();
    });
    this.weapon.onHit = (head, kill, target) => {
      if (target instanceof PowerCell) return;
      this.hud.hit(head, kill);
      if (target instanceof Enemy) target.lastKnown.copyFrom(this.player.feet);
      if (head) this.headshots++;
      if (!this.weapon.melee) {
        this.stats.hits++;
        if (head) this.stats.heads++;
      }
      if (kill) {
        if (target instanceof Enemy) this.eliminate(target, head, true);
        else {
          this.kills++;
          this.score += head ? 150 : 100;
          this.hud.elimination("TARGET OFFLINE");
        }
      }
    };
    this.weapon.onBlocked = (target) => {
      if (!this.weapon.melee) this.stats.blocked++;
      if (target instanceof Enemy) target.lastKnown.copyFrom(this.player.feet);
      this.hud.hit(false, false);
      this.hud.el("hitmarker").style.color = "#65baff";
    };
    this.weapon.onShot = () => {
      this.stats.shots++;
      for (const e of this.enemies) e.hear(this.player.feet, 34);
    };
    this.player.onStep = () => {
      this.audio.play("step", this.player.crouched ? 0.35 : 1);
      for (const e of this.enemies)
        e.hear(
          this.player.feet,
          this.player.crouched ? 2 : this.player.state === "Sprinting" ? 13 : 6,
        );
    };
    this.player.onDash = () => this.audio.play("swing", 0.4);
    this.player.onJump = () => this.audio.play("jump");
    this.player.onLand = () => this.audio.play("land");
    this.hud.onSettings = () => this.applySettings();
    this.waves.onWave = (wave, count) => this.spawnWave(wave, count);
    this.waves.onReinforcement = (wave, count, offset) => {
      this.spawnBatch(wave, count, offset);
      const commanderArrived =
        (wave === 5 || (this.waves.endless && wave % 5 === 0)) &&
        offset + count === this.waves.total;
      this.hud.toast(
        commanderArrived
          ? "지휘 로봇 진입 · 표시 구역을 피해 약점을 노려"
          : `증원 진입 · ${count}기 · 남은 적 ${this.waves.remaining}기`,
        commanderArrived ? 3 : 2,
      );
      this.audio.play("alert", 0.55);
    };
    this.waves.onClear = () => {
      this.player.health = Math.min(
        100,
        this.player.health + this.difficulty.recovery,
      );
      for (const m of new Set([
        ...this.weapon.magazines,
        ...this.weapon.inventory.values(),
      ]))
        m.reserve = Math.min(
          m.data.reserveAmmo,
          m.reserve + m.data.magazineSize * this.difficulty.resupplyMagazines,
        );
      this.hud.toast(
        `웨이브 완료 · 체력 +${this.difficulty.recovery} · 탄약 보급 · B: 무기 상점`,
        4,
      );
      this.audio.play("ui");
    };
    this.waves.onVictory = () => this.finish(true);
    window.addEventListener("resize", () => this.applyGraphics());
    this.engine.onContextLostObservable.add(() => {
      this.running = false;
      if (this.input.locked) document.exitPointerLock();
      this.hud.error("그래픽 연결이 끊겼어. 복구를 기다리는 중이야.");
    });
    this.engine.onContextRestoredObservable.add(() => {
      this.applyGraphics();
      this.hud.el("error").hidden = true;
      this.hud.toast("그래픽 복구 완료 · 게임으로 돌아가기를 눌러줘", 4);
    });
    this.engine.runRenderLoop(() => this.frame());
  }
  openShop(): void {
    if (
      !this.started ||
      this.finished ||
      this.practice ||
      this.waves.intermission <= 0
    ) {
      this.hud.toast("상점은 웨이브 사이에 열 수 있어", 2);
      return;
    }
    this.shopping = true;
    this.running = false;
    this.input.clear();
    this.refreshShop();
    if (this.input.locked) document.exitPointerLock();
  }
  refreshShop(): void {
    this.hud.shop(
      this.wallet,
      this.weapon.primaryOwned ? this.weapon.magazines[0].data.id : "",
      this.equipment,
      this.weapon.magazines[1].data.id,
    );
    this.updateHUD();
  }
  private buildDevices(): ArenaDevices {
    const devices = new ArenaDevices(
      this.level,
      this.navigation,
      this.missionPoints,
    );
    devices.onBlast = (point) =>
      this.blasts.push({
        point,
        radius: 5,
        damage: 120,
        playerDamage: 35,
        credited: true,
      });
    devices.onChange = () => {
      for (const e of this.enemies) e.pathClock = 0;
    };
    return devices;
  }
  private eliminate(enemy: Enemy, head: boolean, credited: boolean): void {
    if (this.accounted.has(enemy.id)) return;
    this.accounted.add(enemy.id);
    if (credited) {
      this.kills++;
      if (!this.practice) this.wallet.reward(enemy.elite, head);
      const points = Math.round(
        (head ? 150 : 100) * this.difficulty.scoreMultiplier,
      );
      this.score += points;
      this.hud.elimination(
        `${enemy instanceof Commander ? "COMMAND UNIT" : enemy.role === "sniper" ? "SNIPER" : enemy.role === "bomber" ? "BOMBER" : "SENTINEL"} OFFLINE  +${points}`,
      );
      this.effects.impact(enemy.eye, true);
      this.audio.play("land", 0.3);
    }
    if (enemy instanceof Bomber)
      this.blasts.push({
        point: enemy.position.add(new Vector3(0, 0.9, 0)),
        radius: Bomber.radius,
        damage: 110,
        playerDamage: 28 * this.difficulty.damage,
        credited,
      });
    this.pendingDeaths++;
  }
  private resolveBlasts(): void {
    // Drain a queue so chain reactions cannot recurse or credit a robot twice.
    this.resolvingBlast = true;
    let budget = 100;
    while (this.blasts.length && budget-- > 0) {
      const blast = this.blasts.shift()!;
      this.equipment.pulse(blast.point, blast.radius);
      this.audio.play("enemy", 0.6);
      if (
        !this.practice &&
        !this.finished &&
        Vector3.DistanceSquared(blast.point, this.player.camera.position) <=
          blast.radius ** 2 &&
        this.level.lineClear(blast.point, this.player.camera.position)
      )
        this.hurtPlayer(blast.playerDamage, blast.point);
      for (const enemy of this.enemies) {
        if (
          enemy.health <= 0 ||
          Vector3.DistanceSquared(blast.point, enemy.eye) > blast.radius ** 2 ||
          !this.level.lineClear(blast.point, enemy.eye)
        )
          continue;
        if (
          enemy.receiveDamage({
            damage: blast.damage,
            source: "blast",
            target: enemy.id,
            hitPoint: enemy.eye,
            hitNormal: enemy.eye.subtract(blast.point).normalize(),
            isHeadshot: false,
            damageType: "explosion",
          })
        )
          this.eliminate(enemy, false, blast.credited);
      }
      for (const cell of this.devices.cells) {
        if (
          cell.health > 0 &&
          Vector3.DistanceSquared(cell.mesh.position, blast.point) <=
            blast.radius ** 2 &&
          this.level.lineClear(
            blast.point,
            cell.mesh.position.add(
              blast.point.subtract(cell.mesh.position).normalize().scale(0.65),
            ),
          )
        )
          cell.receiveDamage({
            damage: blast.damage,
            source: "blast",
            target: cell.id,
            hitPoint: cell.mesh.position,
            hitNormal: Vector3.Up(),
            isHeadshot: false,
            damageType: "explosion",
          });
      }
    }
    this.resolvingBlast = false;
    if (this.player.health <= 0 && !this.finished) this.finish(false);
    const deaths = this.pendingDeaths;
    this.pendingDeaths = 0;
    for (let i = 0; i < deaths; i++) this.waves.kill();
  }
  private hurtPlayer(damage: number, origin: Vector3): void {
    if (this.finished || this.player.health <= 0) return;
    const before = this.player.health;
    const dead = this.player.receiveDamage({
      damage,
      source: "enemy",
      target: "player",
      hitPoint: this.player.camera.position.clone(),
      hitNormal: Vector3.Up(),
      isHeadshot: false,
      damageType: "explosion",
    });
    this.stats.damage += before - this.player.health;
    const dir = origin.subtract(this.player.feet);
    this.hud.damage(Math.atan2(dir.x, dir.z) - this.player.yaw);
    if (dead && !this.resolvingBlast) this.finish(false);
  }
  continueEndless(): void {
    if (
      !this.finished ||
      !this.waves.complete ||
      this.waves.endless ||
      this.player.health <= 0 ||
      this.practice
    )
      return;
    this.finished = false;
    this.running = false;
    this.score = this.kills = this.time = 0;
    this.stats = new RunStats();
    this.blasts = [];
    this.equipment.reset();
    this.devices.reset();
    this.waves.continueEndless();
    this.hud.set(
      "run-difficulty",
      `${maps[this.level.mapId].name} · ${this.difficulty.label} · 무한 웨이브`,
    );
    this.hud.show("pause");
    this.hud.toast(
      "무한 웨이브 · 무장 유지 / 점수·시간 새로 시작 · B: 상점",
      4,
    );
    this.updateHUD();
    void this.audio.unlock();
    this.input.request();
  }
  selectMap(id: MapId): void {
    if (this.started || id === this.level.mapId) return;
    this.effects.clear();
    this.equipment.reset();
    this.level.dispose();
    this.level = new Level(this.scene, id);
    this.navigation = new Navigation(this.level);
    this.missionPoints = objectivePoints(this.navigation, this.level);
    this.devices = this.buildDevices();
    this.level.optimize();
    this.player.body.surroundingMeshes = this.level.solids;
    this.equipment.level = this.level;
    this.player.resetAt(this.level.spawn);
    this.player.camera.position.set(10, 5.4, -15);
    this.player.camera.setTarget(new Vector3(-1, 2.2, 7));
    this.applySettings();
  }
  applySettings(): void {
    this.audio.apply();
    const request = `${this.settings.quality}:${this.settings.autoGraphics}`;
    if (request !== this.graphicsRequest) {
      this.graphicsRequest = request;
      this.graphics.configure(
        this.settings.quality,
        this.settings.autoGraphics,
      );
    }
    this.applyGraphics();
  }
  private applyGraphics(): void {
    const quality = this.graphics.quality;
    this.engine.setHardwareScalingLevel(
      this.graphics.scaling(window.innerWidth, window.innerHeight),
    );
    this.scene.shadowsEnabled = quality === "high";
    for (const light of this.level.lights.slice(2))
      light.setEnabled(quality === "high");
    // Keep the flash light registered between shots: toggling lights invalidates shaders.
    this.weapon.muzzleLight.setEnabled(quality === "high");
    this.pipeline.imageProcessingEnabled = quality !== "low";
    this.pipeline.fxaaEnabled = quality !== "low";
    this.pipeline.bloomEnabled = quality === "high";
    this.pipeline.samples = 1;
    for (const material of this.scene.materials)
      if (material.isFrozen) material.unfreeze();
    this.engine.resize();
    this.hud.set(
      "graphics-detail",
      `현재 적용: ${{ low: "낮음", medium: "중간", high: "높음" }[quality]} · ${this.settings.autoGraphics ? "자동 성능 조절 켜짐" : "수동 설정"}`,
    );
  }
  start(practice: boolean): void {
    this.started = true;
    this.finished = false;
    this.running = false;
    this.practice = practice;
    this.wallet.reset();
    this.accounted.clear();
    this.pendingDeaths = 0;
    this.blasts = [];
    this.equipment.reset();
    this.devices.reset();
    this.shopping = false;
    this.objectives.reset();
    this.marker.show(undefined, 3, false);
    this.hud.set(
      "run-difficulty",
      practice
        ? "사격 연습장"
        : `${maps[this.level.mapId].name} · ${this.difficulty.label} · 점수 ×${this.difficulty.scoreMultiplier}`,
    );
    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.stats = new RunStats();
    this.time = 0;
    this.damageCooldown = 0;
    this.enemyCueCooldown = 0;
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    for (const t of this.targets) t.dispose();
    this.targets = [];
    this.effects.clear();
    this.player.resetAt(this.level.spawn);
    this.weapon.startLoadout(this.hud.selectedPistol, practice);
    this.weapon.root.setEnabled(true);
    this.hud.el("health-fill").style.width = "100%";
    this.hud.el("boss-panel").hidden = true;
    this.hud.el("error").hidden = true;
    this.hud.hitTime = 0;
    this.hud.damageTime = 0;
    this.hud.toastTime = 0;
    this.hud.killTime = 0;
    this.hud.tick(0);
    if (practice) {
      for (const [x, z] of [
        [0, -9],
        [-5, -3],
        [5, 1],
      ])
        this.targets.push(new Target(this.scene, new Vector3(x, 0, z)));
      this.hud.toast("FIRING RANGE · TARGETS RESET · UNLIMITED RESUPPLY", 3);
    } else {
      this.waves.reset(this.difficulty.waves, this.difficulty.rest);
      this.hud.toast("RELAY ONLINE · FIRST CONTACT IN 3", 3);
    }
    void this.audio.unlock();
    this.hud.show("pause");
    this.input.request();
  }
  exitToMenu(): void {
    // Set state before releasing pointer lock, so its event cannot reopen Pause.
    this.running = false;
    this.started = false;
    this.finished = false;
    this.shopping = false;
    this.wallet.reset();
    this.accounted.clear();
    this.pendingDeaths = 0;
    this.blasts = [];
    this.equipment.reset();
    this.devices.reset();
    this.objectives.reset();
    this.marker.show(undefined, 3, false);
    this.input.clear();
    if (this.input.locked) document.exitPointerLock();
    for (const enemy of this.enemies) enemy.dispose();
    this.enemies = [];
    for (const target of this.targets) target.dispose();
    this.targets = [];
    this.effects.clear();
    this.waves.reset();
    this.player.resetAt(this.level.spawn);
    this.weapon.reset();
    this.weapon.root.setEnabled(false);
    this.player.camera.position.set(10, 5.4, -15);
    this.player.camera.setTarget(new Vector3(-1, 2.2, 7));
    this.player.camera.fov = (this.settings.fov * Math.PI) / 180;
    this.debug = false;
    this.hud.el("debug").hidden = true;
    this.hud.el("boss-panel").hidden = true;
    this.hud.el("error").hidden = true;
    this.hud.killTime =
      this.hud.hitTime =
      this.hud.damageTime =
      this.hud.toastTime =
        0;
    this.hud.tick(0);
    this.hud.show("start");
  }
  spawnWave(wave: number, count: number): void {
    this.accounted.clear();
    const kind = objectiveForWave(
      this.waves.endless ? ((wave - 1) % 5) + 1 : wave,
    );
    const points =
      kind === "defend" ? [this.missionPoints[1]] : this.missionPoints;
    this.objectives.reset(kind, points);
    if (!this.objectives.done) this.waves.requireObjective();
    this.marker.show(
      this.objectives.done ? undefined : this.objectives.point,
      this.objectives.radius,
      false,
    );
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    this.spawnBatch(wave, this.waves.firstBatch, 0);
    this.hud.toast(
      `${!this.waves.endless && wave === 5 ? "FINAL WAVE" : "WAVE " + String(wave).padStart(2, "0")} · ${count} HOSTILES INBOUND`,
      2.5,
    );
    this.audio.play("alert");
  }
  private spawnBatch(wave: number, count: number, offset: number): void {
    for (let i = offset; i < offset + count; i++) {
      const spawn =
        this.level.enemySpawns[
          (i + (offset ? wave * 2 : 0)) % this.level.enemySpawns.length
        ].clone();
      // Find a free grid cell near the entry; higher counts must not spawn in buildings.
      let best = Infinity;
      const preferred = spawn.clone();
      for (let z = 0; z < this.navigation.size; z++) {
        for (let x = 0; x < this.navigation.size; x++) {
          if (this.navigation.blocked.has(z * this.navigation.size + x))
            continue;
          const candidate = this.navigation.world(x, z);
          if (Vector3.DistanceSquared(candidate, this.player.feet) < 64)
            continue;
          if (
            this.enemies.some(
              (enemy) => Vector3.DistanceSquared(candidate, enemy.position) < 3,
            )
          )
            continue;
          const distance = Vector3.DistanceSquared(candidate, preferred);
          if (distance < best) {
            best = distance;
            spawn.copyFrom(candidate);
          }
        }
      }
      const elite =
        wave >= this.difficulty.eliteFrom &&
        i < this.difficulty.eliteCount + wave - this.difficulty.eliteFrom;
      const role = combatRole(i, wave);
      const commander =
        (wave === 5 || (this.waves.endless && wave % 5 === 0)) &&
        i === this.waves.total - 1;
      const Bot =
        role === "sniper" ? Sniper : role === "bomber" ? Bomber : Enemy;
      const e = commander
        ? new Commander(
            this.scene,
            this.level,
            this.navigation,
            {
              ...this.difficulty,
              health:
                this.difficulty.health * (1 + Math.max(0, wave - 5) * 0.08),
            },
            spawn,
            `w${wave}-commander`,
          )
        : new Bot(
            this.scene,
            this.level,
            this.navigation,
            enemyConfig(wave, elite, this.difficulty, role),
            spawn,
            `w${wave}-e${i}`,
            elite,
            role,
          );
      e.onRepair = (target) => this.effects.tracer(e.eye, target.eye);
      e.onAttack = (enemy) => {
        if (enemy instanceof Commander) enemy.beginPulse(this.player.feet);
        else this.enemyAttack(enemy);
      };
      if (e instanceof Commander) {
        e.onPulse = (point) => this.enemyAttack(e, point);
      }
      e.onAlert = () => this.audio.play("alert", 0.5);
      e.onTelegraph = (enemy) => {
        if (enemy instanceof Sniper) enemy.lockAim(this.player.camera.position);
        if (
          this.enemyCueCooldown <= 0 &&
          Vector3.DistanceSquared(enemy.position, this.player.feet) < 625
        ) {
          this.audio.play("alert", 0.16);
          this.enemyCueCooldown = 0.6;
        }
      };
      e.setObjectiveTarget(
        this.objectives.done ? undefined : this.objectives.point,
        this.objectives.kind,
      );
      this.enemies.push(e);
      this.effects.spawn(spawn);
    }
  }
  enemyAttack(e: Enemy, telegraphed?: Vector3): void {
    if (
      !this.running ||
      this.finished ||
      this.player.health <= 0 ||
      e.stunRemaining > 0 ||
      e.health <= 0
    )
      return;
    if (e instanceof Bomber) {
      e.receiveDamage({
        damage: 99999,
        source: e.id,
        target: e.id,
        hitPoint: e.eye,
        hitNormal: Vector3.Up(),
        isHeadshot: false,
        damageType: "explosion",
      });
      // Resolve the blast before completing a wave: mutual destruction is a defeat.
      this.eliminate(e, false, false);
      this.resolveBlasts();
      return;
    }
    const origin = e.eye.add(new Vector3(0, -0.35, 0));
    if (
      !telegraphed &&
      !this.level.lineClear(origin, this.player.camera.position)
    )
      return;
    const distance = Vector3.Distance(origin, this.player.camera.position);
    this.audio.play("enemy", Math.max(0.12, 1 - distance / 40));
    const movePenalty = this.player.velocity.length() > 6 ? 0.65 : 1;
    const chance =
      e.config.accuracy * movePenalty * (this.player.crouched ? 0.8 : 1);
    const hit =
      e instanceof Sniper
        ? Vector3.DistanceSquared(this.player.camera.position, e.aimPoint) <=
          0.65 ** 2
        : telegraphed
          ? Vector3.DistanceSquared(this.player.feet, telegraphed) <=
              (e instanceof Commander ? e.warningRadius ** 2 : 6) &&
            this.level.lineClear(origin, this.player.camera.position)
          : Math.random() < chance;
    const point =
      e instanceof Sniper
        ? e.aimPoint.clone()
        : telegraphed
          ? telegraphed.add(new Vector3(0, 1.1, 0))
          : this.player.camera.position.clone();
    if (!hit && !telegraphed && !(e instanceof Sniper))
      point.addInPlace(
        new Vector3(
          (Math.random() - 0.5) * 2.5,
          1 + Math.random(),
          (Math.random() - 0.5) * 2,
        ),
      );
    this.effects.tracer(origin, point);
    if (telegraphed) this.effects.impact(telegraphed, false);
    if (hit && this.damageCooldown <= 0) {
      this.damageCooldown = 0.12;
      const previousHealth = this.player.health;
      const dead = this.player.receiveDamage({
        damage: e.config.damage,
        source: e.id,
        target: "player",
        hitPoint: this.player.camera.position.clone(),
        hitNormal: Vector3.Up(),
        isHeadshot: false,
        damageType: "hitscan",
      });
      this.stats.damage += previousHealth - this.player.health;
      const dir = e.position.subtract(this.player.feet);
      this.hud.damage(Math.atan2(dir.x, dir.z) - this.player.yaw);
      if (dead) this.finish(false);
    }
  }
  finish(victory: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    this.input.clear();
    this.hud.show(
      victory ? "victory" : "defeat",
      this.score,
      this.kills,
      this.time,
    );
    const record =
      this.practice || this.waves.endless
        ? undefined
        : this.records.save(
            this.level.mapId,
            this.difficulty.id,
            this.score,
            this.time,
            victory,
          );
    this.hud.results(
      this.stats,
      this.score,
      this.kills,
      this.time,
      victory,
      record,
    );
    if (this.waves.endless) {
      const record = this.endlessRecords.save(
        this.level.mapId,
        this.difficulty.id,
        this.score,
        Math.max(6, this.waves.index),
      );
      this.hud.set("overlay-label", "ENDLESS / SIGNAL LOST");
      this.hud.set(
        "overlay-detail",
        `무한 ${this.waves.index}웨이브 도달 · 최고 ${record.best.score.toLocaleString()}점 / ${record.best.wave}웨이브 · ${record.saved ? "이 기기에 저장됨" : "저장 불가"}`,
      );
    }
    this.hud.refreshRecord();
    this.updateHUD();
    if (this.input.locked) document.exitPointerLock();
    this.audio.play(victory ? "headshot" : "land");
  }
  frame(): void {
    if (document.hidden) {
      this.graphics.resetWindow();
      return;
    }
    const now = performance.now();
    const interval = now - this.lastRender;
    if (!this.running && interval < 1000 / 15) {
      this.input.endFrame();
      return;
    }
    this.lastRender = now;
    const rawMilliseconds = this.engine.getDeltaTime();
    const dt = Math.min(
      (this.running ? rawMilliseconds : interval) / 1000,
      0.05,
    );
    if (this.running && this.graphics.sample(rawMilliseconds))
      this.applyGraphics();
    if (this.debug) {
      const ms = this.engine.getDeltaTime();
      this.frameMs = this.frameMs ? this.frameMs * 0.9 + ms * 0.1 : ms;
      this.framePeakMs = Math.max(this.framePeakMs, ms);
      this.metricWindow += ms;
      if (this.metricWindow >= 2000) {
        this.framePeakMs = ms;
        this.metricWindow = 0;
      }
    }
    if (this.running && this.input.consume("KeyB")) this.openShop();
    if (this.running) {
      this.time += dt;
      this.damageCooldown = Math.max(0, this.damageCooldown - dt);
      this.enemyCueCooldown = Math.max(0, this.enemyCueCooldown - dt);
      this.player.adsFov = this.weapon.data.weaponType === "sniper" ? 32 : 61;
      this.player.update(dt, this.weapon.aiming);
      if (this.input.consume("KeyG")) {
        const ray = this.player.camera.getForwardRay();
        if (this.equipment.throw(ray.origin, ray.direction))
          this.audio.play("swing", 0.4);
        else
          this.hud.toast(
            this.equipment.ammo === 0
              ? "EMP 없음 · 웨이브 사이 B로 보충"
              : "EMP 준비 중",
            1,
          );
      }
      this.devices.update(dt);
      const usingObjective =
        !this.objectives.done &&
        this.objectives.kind === "activate" &&
        this.objectives.point &&
        Vector3.DistanceSquared(this.player.feet, this.objectives.point) < 16;
      if (!usingObjective && this.input.consume("KeyE")) {
        const hint = this.devices.hint(this.player.camera.position);
        if (
          hint &&
          !this.devices.interact(
            this.player.camera.position,
            this.enemies.filter((e) => e.health > 0).map((e) => e.position),
          )
        )
          this.hud.toast("장치 대기 중 · 차단 위치를 비워줘", 1);
      }
      this.weapon.update(dt);
      this.resolveBlasts();
      this.equipment.update(dt, this.enemies);
      if (this.running && !this.finished) {
        if (this.practice) {
          this.equipment.ammo = 3;
          for (const t of this.targets) t.update(dt);
          for (const m of this.weapon.magazines)
            if (m.reserve < m.data.magazineSize) m.reserve = m.data.reserveAmmo;
        } else {
          const point = this.objectives.point;
          if (this.waves.intermission <= 0 && !this.objectives.done && point) {
            const previousStage = this.objectives.stage;
            const complete = this.objectives.update(
              dt,
              this.player.feet,
              this.enemies.filter((e) => e.health > 0).map((e) => e.position),
              this.input.down("KeyE") &&
                !this.input.fire &&
                this.player.grounded,
              this.level.lineClear(
                this.player.camera.position,
                point.add(new Vector3(0, 1, 0)),
              ),
            );
            this.marker.show(
              this.objectives.done ? undefined : this.objectives.point,
              this.objectives.radius,
              this.objectives.contested,
            );
            if (complete) {
              for (const e of this.enemies)
                e.setObjectiveTarget(undefined, this.objectives.kind);
              this.hud.toast("목표 완료 · 남은 적을 정리해", 3);
              this.audio.play("ui");
              this.waves.finishObjective();
            } else if (previousStage !== this.objectives.stage) {
              for (const e of this.enemies)
                e.setObjectiveTarget(
                  this.objectives.point,
                  this.objectives.kind,
                );
              this.hud.toast("첫 장치 가동 · 다음 장치로 이동해", 3);
              this.audio.play("ui");
            }
          }
          if (this.running) this.waves.update(dt);
          for (const e of this.enemies) {
            if (!this.running) break;
            e.update(dt, this.player, this.enemies);
            this.resolveBlasts();
          }
        }
      }
      this.effects.update(dt);
      this.hud.tick(dt);
      if (import.meta.env.DEV && this.input.consume("F3")) {
        this.debug = !this.debug;
        this.hud.el("debug").hidden = !this.debug;
      }
      this.hudTime += dt;
      if (this.hudTime > 0.05) {
        this.hudTime = 0;
        this.updateHUD();
      }
    }
    if (this.finished) {
      for (const enemy of this.enemies)
        if (enemy.state === "Dead") enemy.shutdown.update(dt);
    }
    this.input.endFrame();
    const renderStart = this.debug ? performance.now() : 0;
    this.scene.render();
    if (this.debug) {
      const ms = performance.now() - renderStart;
      this.renderCpuMs = this.renderCpuMs
        ? this.renderCpuMs * 0.9 + ms * 0.1
        : ms;
    }
  }
  updateHUD(): void {
    const h = this.hud,
      w = this.weapon;
    const boss = this.enemies.find(
      (e): e is Commander => e instanceof Commander && e.health > 0,
    );
    h.el("boss-panel").hidden = !boss;
    if (boss) {
      h.el("boss-fill").style.width =
        `${(100 * boss.health) / boss.maxHealth}%`;
      h.set(
        "boss-state",
        boss.windupRemaining > 0
          ? "표시 구역을 피해!"
          : boss.weakWindow > 0
            ? "약점 노출 · 지금 공격해"
            : "지휘 로봇 · 공격을 대비해",
      );
    }
    h.set("health", String(Math.ceil(this.player.health)));
    h.el("health-fill").style.width = `${this.player.health}%`;
    h.el("health-fill").style.background =
      this.player.health < 30 ? gameTheme.colors.danger : gameTheme.colors.blue;
    h.set("ammo", w.melee ? "∞" : String(w.mag.ammo).padStart(2, "0"));
    h.set("reserve", w.melee ? "근접" : String(w.mag.reserve));
    h.set("score", String(this.score).padStart(5, "0"));
    h.set("weapon-name", w.data.name);
    h.set(
      "dash-status",
      this.player.dash.cooldown > 0
        ? `ALT · 대시 ${this.player.dash.cooldown.toFixed(1)}초`
        : "ALT · 대시 준비",
    );
    h.el("dash-status").classList.toggle(
      "cooling",
      this.player.dash.cooldown > 0,
    );
    h.set("emp-status", `G · EMP ×${this.equipment.ammo}`);
    h.set("device-hint", this.devices.hint(this.player.camera.position));
    h.set("coins", `${this.wallet.coins} COINS · B 상점`);
    h.set(
      "slot1",
      w.primaryOwned ? `1 · ${w.magazines[0].data.name}` : "1 · 주무기 미구매",
    );
    h.set("slot2", `2 · ${w.magazines[1].data.name}`);
    h.set(
      "wave-label",
      this.practice
        ? "FIRING RANGE"
        : `${this.difficulty.label} · WAVE ${String(Math.max(1, this.waves.index)).padStart(2, "0")}${this.waves.endless ? " / ∞" : " / 05"}`,
    );
    h.set(
      "objective",
      this.practice
        ? "CALIBRATE YOUR AIM"
        : this.waves.intermission > 0
          ? "PERIMETER CLEAR"
          : objectiveNames[this.objectives.kind],
    );
    h.set(
      "enemies",
      this.practice
        ? "TARGETS RESET AUTOMATICALLY"
        : this.waves.intermission > 0
          ? `NEXT CONTACT IN ${Math.ceil(this.waves.intermission)}s`
          : `${this.waves.remaining} SENTINELS REMAINING${this.waves.pending ? ` · 증원 ${this.waves.pending}` : ""}`,
    );
    const point = this.objectives.point;
    const active =
      !this.practice &&
      this.waves.intermission <= 0 &&
      !this.objectives.done &&
      !!point;
    h.el("mission-status").hidden = !active;
    if (active && point) {
      const delta = point.subtract(this.player.feet);
      h.set("mission-hint", this.objectives.hint);
      h.set(
        "mission-distance",
        `${Math.round(delta.length())}m · ${Math.floor((this.objectives.progress / this.objectives.duration) * 100)}%`,
      );
      h.el("mission-fill").style.width =
        `${(this.objectives.progress / this.objectives.duration) * 100}%`;
      h.el("mission-arrow").style.transform =
        `rotate(${Math.atan2(delta.x, delta.z) - this.player.yaw}rad)`;
    }
    h.el("crosshair").style.setProperty(
      "--gap",
      `${w.aiming ? 2 : 4 + w.spread * 650}px`,
    );
    h.el("crosshair").style.setProperty(
      "--scale",
      String(this.settings.crosshairSize),
    );
    h.el("ammo").classList.toggle("empty-feedback", w.dryTime > 0);
    h.el("ammo").classList.toggle("reloading", w.reloading);
    h.el("crosshair").style.opacity = String(1 - w.ads);
    h.el("ads-reticle").hidden = !w.aiming;
    h.el("ads-reticle").classList.toggle("smg", w.data.weaponType === "smg");
    h.el("ads-reticle").classList.toggle("heavy", w.data.id === "r20");
    h.el("ads-reticle").classList.toggle(
      "sniper",
      w.data.weaponType === "sniper",
    );
    h.el("reload-bar").style.opacity = w.reloading ? "1" : "0";
    h.el("reload-bar").firstElementChild!.setAttribute(
      "style",
      `width:${(1 - w.mag.reloadRemaining / w.mag.reloadDuration) * 100}%`,
    );
    h.set(
      "reload-label",
      w.melee
        ? "좌클릭 · 근접 공격"
        : w.reloading
          ? "RELOADING"
          : w.mag.ammo === 0
            ? "R · RELOAD NOW"
            : "R  RELOAD",
    );
    h.el("slot1").classList.toggle("active", w.slot === 0);
    h.el("slot2").classList.toggle("active", w.slot === 1);
    h.el("slot3").classList.toggle("active", w.slot === 2);
    for (const [i, bar] of [
      ...document.querySelectorAll(".wave-bars i"),
    ].entries())
      bar.classList.toggle("active", i < this.waves.index && !this.practice);
    if (this.debug) {
      const p = this.player.feet,
        v = this.player.velocity;
      h.set(
        "debug",
        `FPS ${this.engine.getFps().toFixed(0)} · FRAME ${this.frameMs.toFixed(1)}ms · PEAK ${this.framePeakMs.toFixed(1)}ms\nRENDER CPU ${this.renderCpuMs.toFixed(1)}ms · ACTIVE MESHES ${this.scene.getActiveMeshes().length}\nPOSITION ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)}\nVELOCITY ${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.z.toFixed(1)}\n${this.player.state} / GROUNDED ${this.player.grounded}\n${w.data.name} / ${w.mag.ammo}\nSPREAD ${w.spread.toFixed(4)}\nENEMIES ${this.waves.remaining} / WAVE ${this.waves.index}\n${this.enemies
          .filter((e) => e.state !== "Dead")
          .map((e) => e.state)
          .join(" ")}`,
      );
    }
  }
}
