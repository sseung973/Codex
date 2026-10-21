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
import { Enemy, enemyConfig, roleForSpawn } from "../ai/Enemy";
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
  private frameMs = 0;
  private framePeakMs = 0;
  private renderCpuMs = 0;
  private metricWindow = 0;
  damageCooldown = 0;
  private enemyCueCooldown = 0;
  constructor(canvas: HTMLCanvasElement, hud: HUD) {
    this.settings = hud.settings;
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      adaptToDeviceRatio: false,
    });
    this.scene = new Scene(this.engine);
    this.level = new Level(this.scene, hud.selectedMap);
    this.navigation = new Navigation(this.level);
    this.missionPoints = objectivePoints(this.navigation, this.level);
    this.input = new PlayerInput(canvas);
    this.player = new Player(this.scene, this.input, this.settings);
    this.audio = new Audio(this.settings);
    this.effects = new Effects(this.scene);
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
    this.hud.onBuy = (id) => {
      if (!this.shopping || this.finished || this.waves.intermission <= 0)
        return;
      const item = catalog.find((item) => item.data.id === id);
      if (item && this.wallet.buy(id)) {
        this.weapon.equipPrimary(item.data);
        this.audio.play("ui");
        this.hud.shop(this.wallet, item.data.id);
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
      this.hud.hit(head, kill);
      if (target instanceof Enemy) target.lastKnown.copyFrom(this.player.feet);
      if (head) this.headshots++;
      if (!this.weapon.melee) {
        this.stats.hits++;
        if (head) this.stats.heads++;
      }
      if (kill) {
        if (target instanceof Enemy) {
          if (!this.practice) this.wallet.reward(target.elite, head);
          this.effects.impact(target.eye, true);
          this.audio.play("land", 0.3);
        }
        this.kills++;
        const points = Math.round(
          (head ? 150 : 100) *
            (this.practice ? 1 : this.difficulty.scoreMultiplier),
        );
        this.score += points;
        this.hud.elimination(target instanceof Commander
          ? `COMMAND UNIT OFFLINE  +${points}`
          : `${head ? "PRECISION ELIMINATION" : "SENTINEL OFFLINE"}  +${points}`);
        if (target instanceof Enemy) this.waves.kill();
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
    this.player.onJump = () => this.audio.play("jump");
    this.player.onLand = () => this.audio.play("land");
    this.hud.onSettings = () => this.applySettings();
    this.waves.onWave = (wave, count) => this.spawnWave(wave, count);
    this.waves.onReinforcement = (wave, count, offset) => {
      this.spawnBatch(wave, count, offset);
      const commanderArrived = wave === this.difficulty.waves.length &&
        offset + count === this.difficulty.waves[wave - 1];
      this.hud.toast(commanderArrived
        ? "지휘 로봇 진입 · 표시 구역을 피해 약점을 노려"
        : `증원 진입 · ${count}기 · 남은 적 ${this.waves.remaining}기`,
      commanderArrived ? 3 : 2);
      this.audio.play("alert", .55);
    };
    this.waves.onClear = () => {
      this.player.health = Math.min(
        100,
        this.player.health + this.difficulty.recovery,
      );
      for (const m of this.weapon.magazines)
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
    window.addEventListener("resize", () => this.engine.resize());
    this.engine.onContextLostObservable.add(() => {
      this.running = false;
      if (this.input.locked) document.exitPointerLock();
      this.hud.error("Graphics connection lost. Reload the page to restart.");
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
    this.hud.shop(
      this.wallet,
      this.weapon.primaryOwned ? this.weapon.magazines[0].data.id : "",
    );
    if (this.input.locked) document.exitPointerLock();
  }
  selectMap(id: MapId): void {
    if (this.started || id === this.level.mapId) return;
    this.effects.clear();
    this.level.dispose();
    this.level = new Level(this.scene, id);
    this.navigation = new Navigation(this.level);
    this.missionPoints = objectivePoints(this.navigation, this.level);
    this.player.resetAt(this.level.spawn);
    this.player.camera.position.set(10, 5.4, -15);
    this.player.camera.setTarget(new Vector3(-1, 2.2, 7));
    this.applySettings();
  }
  applySettings(): void {
    this.audio.apply();
    this.engine.setHardwareScalingLevel(
      this.settings.quality === "low"
        ? 1.6
        : this.settings.quality === "medium"
          ? 1.2
          : 1,
    );
    this.scene.shadowsEnabled = this.settings.quality !== "low";
    for (const light of this.level.lights.slice(2))
      light.setEnabled(this.settings.quality !== "low");
    this.pipeline.fxaaEnabled = true;
    this.pipeline.bloomEnabled = this.settings.quality === "high";
    this.pipeline.samples = 1;
    this.engine.resize();
  }
  start(practice: boolean): void {
    this.started = true;
    this.finished = false;
    this.running = false;
    this.practice = practice;
    this.wallet.reset();
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
    const kind = objectiveForWave(wave);
    const points = wave === 4 ? [this.missionPoints[1]] : this.missionPoints;
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
      `${wave === 5 ? "FINAL WAVE" : "WAVE " + String(wave).padStart(2, "0")} · ${count} HOSTILES INBOUND`,
      2.5,
    );
    this.audio.play("alert");
  }
  private spawnBatch(wave: number, count: number, offset: number): void {
    for (let i = offset; i < offset + count; i++) {
      const spawn =
        this.level.enemySpawns[(i + (offset ? wave * 2 : 0)) % this.level.enemySpawns.length].clone();
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
      const role = roleForSpawn(i);
      const commander = wave === this.difficulty.waves.length &&
        i === this.difficulty.waves[wave - 1] - 1;
      const e = commander
        ? new Commander(this.scene, this.level, this.navigation,
            this.difficulty, spawn, `w${wave}-commander`)
        : new Enemy(this.scene, this.level, this.navigation,
            enemyConfig(wave, elite, this.difficulty, role),
            spawn, `w${wave}-e${i}`, elite, role);
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
        if (this.enemyCueCooldown <= 0 &&
            Vector3.DistanceSquared(enemy.position, this.player.feet) < 625) {
          this.audio.play("alert", .16);
          this.enemyCueCooldown = .6;
        }
      };
      e.setObjectiveTarget(this.objectives.done ? undefined : this.objectives.point,
        this.objectives.kind);
      this.enemies.push(e);
      this.effects.spawn(spawn);
    }
  }
  enemyAttack(e: Enemy, telegraphed?: Vector3): void {
    if (!this.running || this.finished || this.player.health <= 0) return;
    const origin = e.eye.add(new Vector3(0, -0.35, 0));
    if (!telegraphed && !this.level.lineClear(origin, this.player.camera.position)) return;
    const distance = Vector3.Distance(origin, this.player.camera.position);
    this.audio.play("enemy", Math.max(0.12, 1 - distance / 40));
    const movePenalty = this.player.velocity.length() > 6 ? 0.65 : 1;
    const chance =
      e.config.accuracy * movePenalty * (this.player.crouched ? 0.8 : 1);
    const hit = telegraphed
      ? Vector3.DistanceSquared(this.player.feet, telegraphed) <=
          (e instanceof Commander ? e.warningRadius ** 2 : 6) &&
        this.level.lineClear(origin, this.player.camera.position)
      : Math.random() < chance;
    const point = telegraphed
      ? telegraphed.add(new Vector3(0, 1.1, 0))
      : this.player.camera.position.clone();
    if (!hit && !telegraphed)
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
    const record = this.practice
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
    if (this.input.locked) document.exitPointerLock();
    this.audio.play(victory ? "headshot" : "land");
  }
  frame(): void {
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);
    if (this.debug) {
      const ms = this.engine.getDeltaTime();
      this.frameMs = this.frameMs ? this.frameMs * .9 + ms * .1 : ms;
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
      this.weapon.update(dt);
      if (this.running && !this.finished) {
        if (this.practice) {
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
              for (const e of this.enemies) e.setObjectiveTarget(undefined, this.objectives.kind);
              this.hud.toast("목표 완료 · 남은 적을 정리해", 3);
              this.audio.play("ui");
              this.waves.finishObjective();
            } else if (previousStage !== this.objectives.stage) {
              for (const e of this.enemies)
                e.setObjectiveTarget(this.objectives.point, this.objectives.kind);
              this.hud.toast("첫 장치 가동 · 다음 장치로 이동해", 3);
              this.audio.play("ui");
            }
          }
          if (this.running) this.waves.update(dt);
          for (const e of this.enemies) {
            if (!this.running) break;
            e.update(dt, this.player, this.enemies);
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
      this.renderCpuMs = this.renderCpuMs ? this.renderCpuMs * .9 + ms * .1 : ms;
    }
  }
  updateHUD(): void {
    const h = this.hud,
      w = this.weapon;
    const boss = this.enemies.find((e): e is Commander =>
      e instanceof Commander && e.health > 0);
    h.el("boss-panel").hidden = !boss;
    if (boss) {
      h.el("boss-fill").style.width = `${100 * boss.health / boss.maxHealth}%`;
      h.set("boss-state", boss.windupRemaining > 0
        ? "표시 구역을 피해!" : boss.weakWindow > 0
          ? "약점 노출 · 지금 공격해" : "지휘 로봇 · 공격을 대비해");
    }
    h.set("health", String(Math.ceil(this.player.health)));
    h.el("health-fill").style.width = `${this.player.health}%`;
    h.el("health-fill").style.background =
      this.player.health < 30 ? gameTheme.colors.danger : gameTheme.colors.blue;
    h.set("ammo", w.melee ? "∞" : String(w.mag.ammo).padStart(2, "0"));
    h.set("reserve", w.melee ? "근접" : String(w.mag.reserve));
    h.set("score", String(this.score).padStart(5, "0"));
    h.set("weapon-name", w.data.name);
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
        : `${this.difficulty.label} · WAVE ${String(Math.max(1, this.waves.index)).padStart(2, "0")} / 05`,
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
