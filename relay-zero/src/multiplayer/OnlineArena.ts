import { Vector3, Ray } from "@babylonjs/core";
import type { Game } from "../core/Game";
import { Enemy, enemyConfig, roleForSpawn, type EnemyRole } from "../ai/Enemy";
import { difficulties } from "../core/Difficulty";
import { rifle, pistol, baton, type WeaponData } from "../weapons/WeaponData";
import { pickWorld } from "../world/WorldQuery";
import { maps, type MapId } from "../world/MapData";
import { RoomClient, type OnlineMode } from "./RoomClient";
import { Avatar } from "./Avatar";
import { finiteVector, rayBox, ShotGate, type Vec } from "./Combat";
const tuple = (v: Vector3): Vec => [v.x, v.y, v.z];
const vec = (v: Vec) => new Vector3(...v);
type BotState = {
  id: string;
  p: Vec;
  y: number;
  hp: number;
  max: number;
  role: EnemyRole;
  elite: boolean;
  shield: number;
  animation: number;
};
type State = {
  hp: number[];
  scores: number[];
  respawn: number[];
  epochs: number[];
  protect: number[];
  wave: number;
  pending: number;
  wait: number;
  revive: number;
  enemies: BotState[];
  time: number;
};
export class OnlineArena {
  client = new RoomClient();
  active = false;
  begun = false;
  ended = false;
  avatar?: Avatar;
  lobby: HTMLElement;
  status: HTMLElement;
  mode: OnlineMode = "duel";
  hp = [100, 100];
  scores = [0, 0];
  respawn = [0, 0];
  epochs = [0, 0];
  protect = [0, 0];
  remote = {
    p: [0, 0, 18] as Vec,
    y: Math.PI,
    pitch: 0,
    crouch: false,
    revive: false,
  };
  clock = 0;
  wave = 0;
  pending = 0;
  wait = 3;
  revive = 0;
  private seq = 0;
  private gates = [new ShotGate(), new ShotGate()];
  private netClock = 0;
  private hudClock = 0;
  private lastFrame = performance.now();
  private lastMessage = performance.now();
  private localEpoch = 0;
  private ready = false;
  private enemies = new Map<string, Enemy>();
  private replicaTargets = new Map<string, Vector3>();
  private serial = 0;
  constructor(public game: Game) {
    const root = document.createElement("section");
    root.id = "online-lobby";
    root.className = "overlay";
    root.hidden = true;
    root.innerHTML = `<div class="dialog lobby-dialog"><div class="panel-heading"><div><p class="eyebrow">FRIENDS / PRIVATE ROOM</p><h2>함께 전장으로.</h2></div><button id="close-lobby" class="icon-button" aria-label="대기실 닫기">✕</button></div><p id="online-rules"></p><div id="room-actions"><button id="create-room" class="primary">방 만들기 <span>＋</span></button><div class="room-join"><label for="room-code-input">초대받은 방 코드</label><div><input id="room-code-input" maxlength="10" autocomplete="off" spellcheck="false" placeholder="10자리 코드"><button id="join-room" class="secondary">입장</button></div></div></div><div id="room-connected" hidden><span class="difficulty-label">ROOM CODE</span><strong id="room-code"></strong><button id="copy-invite" class="secondary">초대 링크 복사</button><p id="room-roster"></p><button id="room-ready" class="primary">준비 완료</button><button id="leave-room" class="text-button">방 나가기</button></div><p id="online-status" role="status" aria-live="polite"></p><p class="settings-note">친구 2명 전용 · PC 키보드 + 마우스<br>ESC 메뉴를 열어도 온라인 전투는 계속돼. 방장이 나가면 방이 종료돼.</p></div>`;
    game.hud.root.append(root);
    this.lobby = root;
    this.status = this.el("online-status");
    this.el("create-room").onclick = () =>
      this.client.connect({
        type: "create",
        mode: this.mode,
        map: game.hud.selectedMap,
      });
    this.el("join-room").onclick = () => {
      const code = (this.el("room-code-input") as HTMLInputElement).value
        .trim()
        .toUpperCase();
      if (!/^[A-F0-9]{10}$/.test(code)) {
        this.status.textContent = "초대 링크에 있는 10자리 방 코드를 입력해줘.";
        return;
      }
      this.client.connect({ type: "join", code });
    };
    this.el("room-code-input").onkeydown = (e) => {
      if (e.key === "Enter") this.el("join-room").click();
    };
    this.el("close-lobby").onclick = () => {
      this.client.close();
      root.hidden = true;
    };
    this.el("leave-room").onclick = () => {
      this.client.close();
      this.resetLobby();
      this.status.textContent = "방에서 나왔어.";
    };
    this.el("room-ready").onclick = () => {
      this.ready = !this.ready;
      this.client.send({ type: "ready", value: this.ready });
    };
    this.el("copy-invite").onclick = () => {
      const url = new URL(location.href);
      url.searchParams.set("room", this.client.code);
      url.hash = "";
      if (!navigator.clipboard) {
        this.status.textContent = `방 코드 ${this.client.code}를 친구에게 알려줘.`;
        return;
      }
      void navigator.clipboard
        .writeText(url.toString())
        .then(() => {
          this.status.textContent = "초대 링크를 복사했어. 친구에게 보내줘.";
        })
        .catch(() => {
          this.status.textContent = `복사가 안 되면 방 코드 ${this.client.code}를 친구에게 알려줘.`;
        });
    };
    this.client.onStatus = (text) => {
      this.status.textContent = text;
    };
    this.client.onMessage = (m) => this.message(m);
    const invite = new URL(location.href).searchParams.get("room");
    if (invite && /^[A-Fa-f0-9]{10}$/.test(invite)) {
      this.open("duel");
      (this.el("room-code-input") as HTMLInputElement).value =
        invite.toUpperCase();
      this.status.textContent = "친구의 초대야. 입장을 눌러줘.";
    }
    document.addEventListener("visibilitychange", () => {
      if (
        document.hidden &&
        this.active &&
        this.begun &&
        !this.ended &&
        this.client.role === "host"
      ) {
        // Background browsers throttle animation frames; stop rather than freeze a live match.
        this.client.close();
        this.finish(
          false,
          "방장이 다른 탭으로 이동해서 경기가 종료됐어. 새 방에서 다시 시작해줘.",
        );
      }
    });
  }
  private el(id: string): HTMLElement {
    return this.lobby
      ? this.lobby.querySelector<HTMLElement>("#" + id)!
      : document.getElementById(id)!;
  }
  open(mode: OnlineMode): void {
    this.mode = mode;
    this.resetLobby();
    this.el("online-rules").textContent =
      mode === "duel"
        ? "1대1 결투 · AR-7 / P-12 / 충격봉 · 5킬 선승 · 3초 후 재투입"
        : "2인 협동 · 같은 무장으로 5개 웨이브 생존 · E 2초로 친구 소생 · 둘 다 쓰러지면 패배";
    this.lobby.hidden = false;
    this.status.textContent = "방을 만들거나 친구가 보낸 코드로 입장해줘.";
  }
  private resetLobby(): void {
    this.ready = false;
    this.el("room-actions").hidden = false;
    this.el("room-connected").hidden = true;
  }
  private message(m: any): void {
    this.lastMessage = performance.now();
    if (m.type === "room") {
      this.mode = m.mode;
      this.el("online-rules").textContent =
        m.mode === "duel"
          ? "1대1 결투 · 같은 무장 · 5킬 선승"
          : "2인 협동 · 5개 웨이브 · E 2초로 친구 소생";
      this.el("room-actions").hidden = true;
      this.el("room-connected").hidden = false;
      this.el("room-code").textContent = m.code;
      this.el("room-roster").textContent =
        m.players.length === 2
          ? m.players
              .map(
                (p: any) =>
                  `${p.role === this.client.role ? "나" : "친구"} · ${p.ready ? "준비 완료" : "준비 중"}`,
              )
              .join(" / ")
          : "친구의 입장을 기다리는 중 · 초대 링크를 보내줘";
      this.el("room-ready").textContent = this.ready
        ? "준비 취소"
        : "준비 완료";
      this.status.textContent = `${maps[m.map as MapId].name} · ${m.mode === "duel" ? "1대1 결투 · 5킬 선승" : "2인 협동 · 5웨이브"} · 둘 다 준비하면 시작해.`;
    } else if (m.type === "start") this.start(m.mode, m.map);
    else if (m.type === "begin") {
      this.lastMessage = performance.now();
      this.begun = true;
      this.protect = [2, 2];
      this.game.hud.toast("연결 완료 · 전투 시작", 2);
    } else if (m.type === "closed") {
      if (this.active) this.finish(false, m.message);
      this.client.close();
      this.resetLobby();
      this.status.textContent = m.message;
    } else if (!this.active || this.ended) return;
    else if (m.type === "pose" && finiteVector(m.p)) {
      // Clients own movement; host validates each shot against this last accepted pose.
      this.remote = {
        p: m.p,
        y: m.y,
        pitch: m.pitch,
        crouch: m.crouch,
        revive: m.revive === true,
      };
      this.avatar?.place(vec(m.p), m.y);
    } else if (m.type === "shot" && this.client.role === "host")
      this.shoot(1, m);
    else if (m.type === "state" && this.client.role === "guest")
      this.applyState(m.state);
    else if (m.type === "event" && this.client.role === "guest") {
      if (m.event === "end") this.finish(m.won, m.detail);
      else if (m.event === "hit") {
        this.game.hud.hit(m.head, m.kill);
        this.game.audio.play(m.head ? "headshot" : "hit");
      } else if (m.event === "damage" && finiteVector(m.origin))
        this.damageFeedback(vec(m.origin), m.amount);
      else if (m.event === "tracer" && finiteVector(m.a) && finiteVector(m.b)) {
        this.game.effects.tracer(vec(m.a), vec(m.b));
        this.game.audio.play("enemy", 0.25);
      }
    }
  }
  private start(mode: OnlineMode, map: MapId): void {
    const g = this.game;
    // Clear the single-player scene before installing multiplayer callbacks.
    g.exitToMenu();
    g.selectMap(map);
    g.hud.selectedMap = map;
    const choice = g.hud.el("map-choice") as HTMLSelectElement;
    choice.value = map;
    choice.dispatchEvent?.(new Event("change"));
    g.devices?.setOnline(true);
    this.mode = mode;
    this.active = true;
    this.begun = false;
    this.ended = false;
    this.lobby.hidden = true;
    this.hp = [100, 100];
    this.scores = [0, 0];
    this.respawn = [0, 0];
    this.epochs = [0, 0];
    this.protect = [2, 2];
    this.clock = 0;
    this.wave = 0;
    this.pending = 0;
    this.wait = 3;
    this.revive = 0;
    this.serial = 0;
    this.seq = 0;
    this.localEpoch = 0;
    this.gates = [new ShotGate(), new ShotGate()];
    this.netClock = this.hudClock = 0;
    this.lastFrame = this.lastMessage = performance.now();
    g.started = true;
    g.finished = false;
    g.running = false;
    g.practice = false;
    g.score = g.kills = 0;
    g.time = 0;
    g.player.resetAt(this.spawn(this.self));
    if (this.self === 1) g.player.yaw = Math.PI;
    g.weapon.startLoadout("p12", true);
    g.weapon.root.setEnabled(true);
    g.weapon.networkAttack = (ray, data) => {
      if (!this.begun || this.ended) return;
      const shot = {
        type: "shot",
        o: tuple(ray.origin),
        d: tuple(ray.direction),
        weapon: data.id,
        seq: ++this.seq,
      };
      if (this.client.role === "host") this.shoot(0, shot);
      else this.client.send(shot);
    };
    this.remote = {
      p: tuple(this.spawn(1 - this.self)),
      y: this.self === 0 ? Math.PI : 0,
      pitch: 0,
      crouch: false,
      revive: false,
    };
    this.avatar = new Avatar(g.scene, "friend", mode === "coop");
    this.avatar.place(vec(this.remote.p), this.remote.y, true);
    g.hud.show("pause");
    this.pauseCopy();
    this.paintHUD();
  }
  get self(): number {
    return this.client.role === "host" ? 0 : 1;
  }
  private spawn(index: number): Vector3 {
    return new Vector3(index === 0 ? -2 : 2, 0, index === 0 ? -17 : 18);
  }
  lockChanged(locked: boolean): void {
    if (!this.active) return;
    this.game.running = locked && !this.ended;
    if (locked && !this.ended) {
      this.client.send({ type: "loaded" });
      this.game.hud.show("playing");
    } else if (!this.ended) {
      this.game.hud.show("pause");
      this.pauseCopy();
    }
    this.game.hud.el("open-shop").hidden = true;
  }
  private pauseCopy(): void {
    const h = this.game.hud;
    h.set("overlay-label", "ONLINE / FRIENDS");
    h.set(
      "overlay-title",
      this.begun ? "전투는 계속되고 있어." : "전장에 진입해.",
    );
    h.set(
      "overlay-detail",
      this.begun
        ? "ESC 메뉴를 열어도 상대와 로봇은 계속 움직여."
        : "둘 다 게임으로 돌아가기를 누르면 전투가 시작돼.",
    );
    h.el("restart").hidden = true;
    h.el("open-shop").hidden = true;
    h.el("endless").hidden = true;
  }
  private damageFeedback(origin: Vector3, amount: number): void {
    const g = this.game;
    const d = origin.subtract(g.player.feet);
    g.hud.damage(Math.atan2(d.x, d.z) - g.player.yaw, amount);
  }
  private shoot(index: number, m: any): void {
    if (
      !this.begun ||
      this.ended ||
      this.hp[index] <= 0 ||
      this.protect[index] > 0 ||
      !finiteVector(m.o) ||
      !finiteVector(m.d)
    )
      return;
    const data: WeaponData | undefined = [rifle, pistol, baton].find(
      (w) => w.id === m.weapon,
    );
    if (!data) return;
    const g = this.game,
      origin = vec(m.o),
      direction = vec(m.d);
    const feet = index === 0 ? g.player.feet : vec(this.remote.p),
      eye = feet.add(
        new Vector3(
          0,
          index === 0 ? g.player.eye : this.remote.crouch ? 1.15 : 1.65,
          0,
        ),
      );
    if (
      Vector3.DistanceSquared(origin, eye) > 4 ||
      Math.abs(direction.length() - 1) > 0.02 ||
      !this.gates[index].accept(m.seq, this.clock, data.fireRate)
    )
      return;
    for (const e of this.enemies.values()) e.hear(feet, 34);
    const ray = new Ray(origin, direction, data.range);
    const wall = pickWorld(g.scene, ray);
    let distance = wall?.hit ? wall.distance : data.range;
    let enemy: Enemy | undefined;
    let head = false;
    let shield = false;
    if (this.mode === "coop") {
      const pick = g.scene.pickWithRay(
        ray,
        (mesh) =>
          mesh.isEnabled() &&
          mesh.isPickable &&
          mesh.metadata?.entity instanceof Enemy,
      );
      if (pick?.hit && pick.pickedPoint && pick.distance < distance) {
        enemy = pick.pickedMesh!.metadata.entity;
        head = pick.pickedMesh!.metadata.head === true;
        shield = pick.pickedMesh!.metadata.shield === true;
        distance = pick.distance;
      }
    } else {
      const target = index === 0 ? vec(this.remote.p) : g.player.feet;
      const crouch = index === 0 ? this.remote.crouch : g.player.crouched;
      const height = crouch ? 1.32 : 1.9,
        extra = data.weaponType === "melee" ? 0.25 : 0;
      const t = rayBox(
        tuple(origin),
        tuple(direction),
        [target.x - 0.4 - extra, target.y, target.z - 0.32 - extra],
        [target.x + 0.4 + extra, target.y + height, target.z + 0.32 + extra],
        data.range,
      );
      if (
        t !== null &&
        t < distance &&
        this.hp[1 - index] > 0 &&
        this.protect[1 - index] <= 0
      ) {
        distance = t;
        head = origin.y + direction.y * t > target.y + height - 0.4;
        this.damage(
          1 - index,
          data.damage * (head ? data.headshotMultiplier : 1),
          origin,
        );
        this.confirm(index, head, this.hp[1 - index] <= 0);
      }
    }
    const impact = origin.add(direction.scale(distance));
    // A remote tracer is also the shooter's positional firing cue.
    if (index === 1) {
      g.effects.tracer(origin, impact);
      g.audio.play("enemy", 0.25);
    } else
      this.client.send({
        type: "event",
        event: "tracer",
        a: tuple(origin),
        b: tuple(impact),
      });
    if (enemy && enemy.health > 0) {
      const kill = enemy.receiveDamage({
        damage: data.damage * (head ? data.headshotMultiplier : 1),
        source: "friend",
        target: enemy.id,
        hitPoint: impact,
        hitNormal: Vector3.Up(),
        isHeadshot: head,
        shield,
        damageType: data.weaponType === "melee" ? "melee" : "hitscan",
      });
      this.confirm(index, head, kill);
      if (kill) {
        this.scores[index]++;
        g.effects.impact(enemy.eye, true);
      }
    }
  }
  private confirm(index: number, head: boolean, kill: boolean): void {
    if (index === 0) {
      this.game.hud.hit(head, kill);
      this.game.audio.play(head ? "headshot" : "hit");
    } else this.client.send({ type: "event", event: "hit", head, kill });
  }
  private damage(index: number, amount: number, origin: Vector3): void {
    if (this.hp[index] <= 0 || this.protect[index] > 0) return;
    const loss = Math.min(this.hp[index], Math.max(0, amount));
    this.hp[index] -= loss;
    if (index === 0) {
      this.game.player.health = this.hp[0];
      this.damageFeedback(origin, loss);
    } else
      this.client.send({
        type: "event",
        event: "damage",
        origin: tuple(origin),
        amount: loss,
      });
    if (this.hp[index] === 0) {
      if (this.mode === "duel") {
        this.scores[1 - index]++;
        this.respawn[index] = 3;
        if (this.scores[1 - index] >= 5)
          this.endMatch(1 - index, "5킬 선승 · 결투 종료");
      } else if (this.hp.every((h) => h <= 0))
        this.endMatch(-1, "둘 다 쓰러졌어. 다음에는 서로 엄호하며 도전해봐.");
    }
  }
  private endMatch(winner: number, detail: string): void {
    this.client.send({ type: "state", state: this.state() });
    this.client.send({
      type: "event",
      event: "end",
      won: this.mode === "coop" ? winner === 0 : winner === 1,
      detail,
    });
    this.finish(this.mode === "coop" ? winner === 0 : winner === 0, detail);
  }
  private finish(won: boolean, detail: string): void {
    if (this.ended) return;
    this.ended = true;
    this.game.finished = true;
    this.game.running = false;
    this.game.input.clear();
    const h = this.game.hud;
    h.show(
      won ? "victory" : "defeat",
      this.scores[this.self],
      this.scores[this.self],
      this.clock,
    );
    h.set(
      "overlay-label",
      this.mode === "duel" ? "DUEL / FINAL SCORE" : "CO-OP / MISSION REPORT",
    );
    h.set("overlay-title", won ? "임무 완료." : "다시 도전해.");
    h.set("overlay-detail", detail);
    h.set(
      "results",
      this.mode === "duel"
        ? `나 ${this.scores[this.self]} : ${this.scores[1 - this.self]} 친구`
        : `${this.wave} / 5 웨이브 · 팀 처치 ${this.scores[0] + this.scores[1]}`,
    );
    for (const id of ["restart", "endless", "open-shop"])
      h.el(id).hidden = true;
    if (this.game.input.locked) document.exitPointerLock();
  }
  leave(): void {
    this.client.close();
    this.game.devices?.setOnline(false);
    this.active = this.begun = this.ended = false;
    this.game.weapon.networkAttack = undefined;
    this.avatar?.dispose();
    this.avatar = undefined;
    for (const e of this.enemies.values()) e.dispose();
    this.enemies.clear();
    this.replicaTargets.clear();
    this.game.hud.el("restart").hidden = false;
    this.game.hud.root.classList.remove("online-game");
  }
  private respawnPlayer(index: number): void {
    this.hp[index] = 100;
    this.respawn[index] = 0;
    this.protect[index] = 2;
    this.epochs[index]++;
    if (index === 0) this.resetLocal();
  }
  private resetLocal(): void {
    const g = this.game;
    g.player.resetAt(this.spawn(this.self));
    if (this.self === 1) g.player.yaw = Math.PI;
    g.weapon.startLoadout("p12", true);
    g.hud.damageTime = 0;
    this.localEpoch = this.epochs[this.self];
  }
  private nextWave(): void {
    for (const e of this.enemies.values()) e.dispose();
    this.enemies.clear();
    if (this.wave >= 5) {
      this.endMatch(0, "두 명이 함께 5개 웨이브를 돌파했어!");
      return;
    }
    this.wave++;
    this.pending = 4 + this.wave * 2;
    this.wait = 0;
    for (let i = 0; i < 2; i++)
      if (this.hp[i] <= 0) this.respawnPlayer(i);
      else this.hp[i] = Math.min(100, this.hp[i] + 25);
    for (const m of this.game.weapon.magazines) m.reserve = m.data.reserveAmmo;
    this.game.hud.toast(`CO-OP · WAVE ${this.wave} / 5`, 3);
  }
  private spawnBot(): void {
    const g = this.game;
    let pos =
      g.level.enemySpawns[this.serial % g.level.enemySpawns.length].clone();
    let best = -Infinity;
    const candidates = g.navigation.reachable(g.level.spawn);
    for (const key of candidates) {
      const p = g.navigation.world(key % 21, Math.floor(key / 21));
      const separation = Math.min(
        Vector3.DistanceSquared(p, g.player.feet),
        Vector3.DistanceSquared(p, vec(this.remote.p)),
      );
      const crowd = [...this.enemies.values()].some(
        (e) => e.health > 0 && Vector3.DistanceSquared(e.position, p) < 9,
      );
      const score = separation - Vector3.DistanceSquared(p, pos) * 0.4;
      if (!crowd && score > best) {
        best = score;
        pos = p;
      }
    }
    const role = roleForSpawn(this.serial),
      elite = this.wave >= 4 && this.serial % 4 === 0;
    const bot = new Enemy(
      g.scene,
      g.level,
      g.navigation,
      enemyConfig(this.wave, elite, difficulties.normal, role),
      pos,
      `coop-${++this.serial}`,
      elite,
      role,
    );
    bot.onAttack = (e) => {
      if (this.ended) return;
      const index = this.target(e);
      const target =
        index === 0
          ? g.player.camera.position
          : vec(this.remote.p).add(
              new Vector3(0, this.remote.crouch ? 1.15 : 1.65, 0),
            );
      if (this.hp[index] <= 0 || !g.level.lineClear(e.eye, target)) return;
      g.effects.tracer(e.eye, target);
      this.client.send({
        type: "event",
        event: "tracer",
        a: tuple(e.eye),
        b: tuple(target),
      });
      g.audio.play("enemy", 0.25);
      if (Math.random() < e.config.accuracy)
        this.damage(index, e.config.damage, e.position);
    };
    bot.onRepair = (target) => {
      g.effects.tracer(bot.eye, target.eye);
      this.client.send({
        type: "event",
        event: "tracer",
        a: tuple(bot.eye),
        b: tuple(target.eye),
      });
    };
    this.enemies.set(bot.id, bot);
    this.pending--;
    g.effects.spawn(pos);
  }
  private target(enemy: Enemy): number {
    if (this.hp[0] <= 0) return 1;
    if (this.hp[1] <= 0) return 0;
    const g = this.game,
      remote = vec(this.remote.p).add(new Vector3(0, 1.65, 0));
    const a =
      Vector3.DistanceSquared(enemy.eye, g.player.camera.position) +
      (g.level.lineClear(enemy.eye, g.player.camera.position) ? 0 : 1000);
    const b =
      Vector3.DistanceSquared(enemy.eye, remote) +
      (g.level.lineClear(enemy.eye, remote) ? 0 : 1000);
    return a <= b ? 0 : 1;
  }
  private hostUpdate(dt: number): void {
    for (let i = 0; i < 2; i++) {
      this.protect[i] = Math.max(0, this.protect[i] - dt);
      if (this.respawn[i] > 0) {
        this.respawn[i] = Math.max(0, this.respawn[i] - dt);
        if (this.respawn[i] === 0) this.respawnPlayer(i);
      }
    }
    if (this.mode === "duel") return;
    const g = this.game,
      alive = [...this.enemies.values()].filter((e) => e.health > 0);
    if (this.wait > 0) {
      this.wait = Math.max(0, this.wait - dt);
      if (this.wait === 0) this.nextWave();
      return;
    }
    if (this.pending > 0 && alive.length < 6) this.spawnBot();
    for (const e of this.enemies.values()) {
      const index = this.target(e);
      const remotePlayer = {
        feet: vec(this.remote.p),
        camera: {
          position: vec(this.remote.p).add(
            new Vector3(0, this.remote.crouch ? 1.15 : 1.65, 0),
          ),
        },
      };
      e.update(dt, index === 0 ? g.player : (remotePlayer as typeof g.player), [
        ...this.enemies.values(),
      ]);
    }
    const down = this.hp.findIndex((h) => h <= 0);
    if (down >= 0) {
      const rescuer = 1 - down;
      const holding =
        rescuer === 0
          ? g.input.down("KeyE") && !g.input.fire
          : this.remote.revive;
      const near =
        Vector3.DistanceSquared(g.player.feet, vec(this.remote.p)) < 9;
      if (
        holding &&
        near &&
        g.level.lineClear(
          g.player.camera.position,
          vec(this.remote.p).add(new Vector3(0, 1, 0)),
        )
      ) {
        this.revive += dt;
        if (this.revive >= 2) {
          this.hp[down] = 50;
          this.protect[down] = 1;
          this.revive = 0;
        }
      } else this.revive = 0;
    }
    if (
      this.pending === 0 &&
      [...this.enemies.values()].every((e) => e.health <= 0) &&
      !this.ended
    ) {
      this.wait = 8;
    }
  }
  private state(): State {
    return {
      hp: this.hp,
      scores: this.scores,
      respawn: this.respawn,
      epochs: this.epochs,
      protect: this.protect,
      wave: this.wave,
      pending: this.pending,
      wait: this.wait,
      revive: this.revive,
      time: this.clock,
      enemies: [...this.enemies.values()].map((e) => ({
        id: e.id,
        p: tuple(e.position),
        y: e.root.rotation.y,
        hp: e.health,
        max: e.maxHealth,
        role: e.role,
        elite: e.elite,
        shield: e.shieldHealth,
        animation: e.animation,
      })),
    };
  }
  private applyState(s: State): void {
    if (
      !s ||
      !Array.isArray(s.hp) ||
      s.hp.length !== 2 ||
      !s.hp.every((n) => Number.isFinite(n) && n >= 0 && n <= 100) ||
      !Array.isArray(s.enemies) ||
      s.enemies.length > 20
    )
      return;
    const g = this.game,
      previousWave = this.wave;
    this.hp = s.hp;
    this.scores = s.scores;
    this.respawn = s.respawn;
    this.epochs = s.epochs;
    this.protect = s.protect;
    this.wave = s.wave;
    this.pending = s.pending;
    this.wait = s.wait;
    this.revive = s.revive;
    this.clock = s.time;
    if (this.epochs[1] !== this.localEpoch) this.resetLocal();
    if (this.wave !== previousWave) {
      for (const m of g.weapon.magazines) m.reserve = m.data.reserveAmmo;
      g.hud.toast(`CO-OP · WAVE ${this.wave} / 5`, 3);
    }
    const ids = new Set<string>();
    for (const b of s.enemies) {
      if (!finiteVector(b.p)) continue;
      ids.add(b.id);
      let enemy = this.enemies.get(b.id);
      if (!enemy) {
        enemy = new Enemy(
          g.scene,
          g.level,
          g.navigation,
          {
            ...enemyConfig(this.wave, b.elite, difficulties.normal, b.role),
            health: b.max,
          },
          vec(b.p),
          b.id,
          b.elite,
          b.role,
        );
        this.enemies.set(b.id, enemy);
      }
      if (b.hp <= 0 && enemy.health > 0)
        enemy.receiveDamage({
          damage: 999999,
          source: "host",
          target: b.id,
          hitPoint: enemy.eye,
          hitNormal: Vector3.Up(),
          isHeadshot: false,
          damageType: "hitscan",
        });
      enemy.animation = b.animation;
      enemy.health = b.hp;
      enemy.shieldHealth = b.shield;
      if (enemy.shield) enemy.shield.setEnabled(b.shield > 0 && b.hp > 0);
      this.replicaTargets.set(b.id, vec(b.p));
      enemy.root.rotation.y = b.y;
    }
    for (const [id, e] of this.enemies)
      if (!ids.has(id)) {
        e.dispose();
        this.enemies.delete(id);
        this.replicaTargets.delete(id);
      }
  }
  frame(): void {
    const now = performance.now(),
      dt = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    const g = this.game;
    if (this.begun && !this.ended && now - this.lastMessage > 20000) {
      this.client.close();
      this.finish(
        false,
        "연결 응답이 없어 경기를 종료했어. 새 방에서 다시 시작해줘.",
      );
    }
    if (!this.ended && this.begun) {
      g.sampleGraphics?.(g.engine?.getDeltaTime() ?? dt * 1000);
      if (this.client.role === "host") this.clock += dt;
      g.player.health = this.hp[this.self];
      if (g.player.health > 0) {
        g.player.adsFov = 61;
        g.player.update(dt, g.weapon.aiming);
        if (this.protect[this.self] <= 0) g.weapon.update(dt);
      } else if (g.input.locked) {
        g.player.look(false);
        g.player.updateCamera(dt, false);
      }
      if (this.client.role === "host") this.hostUpdate(dt);
      else
        for (const [id, e] of this.enemies) {
          const p = this.replicaTargets.get(id);
          if (p && e.health > 0)
            Vector3.LerpToRef(
              e.position,
              p,
              1 - Math.exp(-18 * dt),
              e.position,
            );
          if (e.health > 0) {
            const walking = p && Vector3.DistanceSquared(e.position, p) > 0.003;
            e.animation += dt;
            for (const part of e.parts)
              if (part.name === "leg")
                part.rotation.x = walking
                  ? Math.sin(
                      e.animation * 9 + (part.position.x > 0 ? 0 : Math.PI),
                    ) * 0.24
                  : 0;
          } else e.shutdown.update(dt);
        }
      g.player.health = this.hp[this.self];
    }
    if (this.avatar) {
      this.avatar.health = this.hp[1 - this.self];
      this.avatar.update(dt, this.remote.crouch, this.remote.pitch);
    }
    this.netClock += dt;
    if (this.netClock >= 1 / 15 && !this.ended) {
      this.netClock = 0;
      this.client.send({
        type: "pose",
        p: tuple(g.player.feet),
        y: g.player.yaw,
        pitch: g.player.pitch,
        crouch: g.player.crouched,
        revive: g.input.locked && g.input.down("KeyE") && !g.input.fire,
      });
      if (this.client.role === "host" && this.begun)
        this.client.send({ type: "state", state: this.state() });
    }
    this.hudClock += dt;
    if (this.hudClock >= 0.05) {
      this.hudClock = 0;
      this.paintHUD();
    }
    g.effects.update(dt);
    g.hud.tick(dt);
    g.input.endFrame();
    g.scene.render();
  }
  private paintHUD(): void {
    const g = this.game,
      h = g.hud;
    g.updateHUD();
    h.root.classList.add("online-game");
    const local = this.self,
      other = 1 - local,
      remaining =
        [...this.enemies.values()].filter((e) => e.health > 0).length +
        this.pending;
    h.set("health", String(Math.ceil(this.hp[local])));
    h.el("health-fill").style.width = `${this.hp[local]}%`;
    h.set(
      "score",
      this.mode === "duel"
        ? `${this.scores[local]} : ${this.scores[other]}`
        : String(this.scores[0] + this.scores[1]),
    );
    h.set(
      "coins",
      this.mode === "duel"
        ? "5 KILLS TO WIN"
        : `TEAM · 친구 체력 ${Math.ceil(this.hp[other])}`,
    );
    h.set(
      "wave-label",
      this.mode === "duel"
        ? "FRIENDS / 1 VS 1"
        : `CO-OP / WAVE ${Math.max(1, this.wave)} / 05`,
    );
    h.set(
      "objective",
      !this.begun
        ? "친구가 진입하면 시작"
        : this.mode === "duel"
          ? "먼저 5킬을 달성해"
          : "서로 엄호하며 살아남아",
    );
    h.set(
      "enemies",
      !this.begun
        ? "둘 다 게임으로 돌아가기를 눌러줘"
        : this.wait > 0 && this.mode === "coop"
          ? `다음 웨이브 ${Math.ceil(this.wait)}초 · 쓰러진 친구 자동 복귀`
          : this.mode === "coop"
            ? `남은 로봇 ${remaining}기`
            : `${maps[g.level.mapId].name} · ${this.client.ping}ms`,
    );
    h.set(
      "emp-status",
      `친구 · ${this.hp[other] <= 0 ? "쓰러짐" : Math.ceil(this.hp[other]) + " HP"} · ${this.client.ping}ms`,
    );
    h.set(
      "device-hint",
      this.hp[local] <= 0
        ? this.mode === "duel"
          ? `${Math.ceil(this.respawn[local])}초 후 재투입`
          : "쓰러졌어 · 친구가 E로 소생하거나 웨이브를 완료하면 복귀"
        : this.hp[other] <= 0 && this.mode === "coop"
          ? `친구에게 접근해 E 2초 · 소생 ${Math.floor((this.revive / 2) * 100)}%`
          : this.protect[local] > 0
            ? "재투입 보호 중 · 잠시 후 사격 가능"
            : "",
    );
    h.el("mission-status").hidden = true;
    h.el("boss-panel").hidden = true;
    h.el("open-shop").hidden = true;
    h.el("endless").hidden = true;
    h.set(
      "run-difficulty",
      this.mode === "duel"
        ? "친구 1대1 · 같은 무장 · 5킬 선승"
        : "2인 협동 · 5웨이브 · E로 친구 소생",
    );
  }
}
