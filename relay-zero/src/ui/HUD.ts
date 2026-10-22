import { combatMarkup } from "./CombatMarkup";
import { TacticalMap, type MapState } from "./TacticalMap";
import type { Level } from "../world/Level";
import { DamageFeedback } from "./DamageFeedback";
import { attachments, type AttachmentId } from "../weapons/Attachments";
import type { Equipment } from "../weapons/Equipment";
import { EndlessRecords } from "../core/RunStats";
import { sightMarkup } from "./Sights";
import { Wallet, catalog, starters } from "../weapons/Arsenal";
import { RunStats, Records, clock } from "../core/RunStats";
import { MapId, maps, loadMap, saveMap } from "../world/MapData";
import {
  DifficultyId,
  difficulties,
  loadDifficulty,
  saveDifficulty,
} from "../core/Difficulty";
import { Settings, saveSettings } from "../core/Settings";
export type Screen =
  "start" | "pause" | "victory" | "defeat" | "playing" | "shop";
export class HUD {
  root = document.querySelector<HTMLDivElement>("#ui")!;
  screen: Screen = "start";
  selectedDifficulty: DifficultyId = loadDifficulty();
  selectedPistol = "p12";
  onEndless: () => void = () => {};
  onEMPBuy: () => void = () => {};
  onAttachment: (weaponId: string, id: AttachmentId) => void = () => {};
  onShop: () => void = () => {};
  onBuy: (id: string) => void = () => {};
  onOnline: (mode: "duel" | "coop") => void = () => {};
  selectedMode: "solo" | "duel" | "coop" = "solo";
  onPlay: () => void = () => {};
  onMap: (id: MapId) => void = () => {};
  selectedMap: MapId = loadMap();
  onPractice: () => void = () => {};
  onResume: () => void = () => {};
  onRestart: () => void = () => {};
  onExit: () => void = () => {};
  onSettings: () => void = () => {};
  hitTime = 0;
  toastTime = 0;
  killTime = 0;
  damageFeedback = new DamageFeedback();
  private damageActive = false;
  get damageTime(): number {
    return this.damageFeedback.remaining;
  }
  set damageTime(value: number) {
    this.damageFeedback.remaining = Math.max(0, value);
    if (value <= 0) this.damageFeedback.amount = 0;
  }
  private cache = new Map<string, string>();
  waveBars: HTMLElement[] = [];
  private nodes = new Map<string, HTMLElement>();
  private styles = new Map<string, string>();
  private hitActive = false;
  private killActive = false;
  private toastActive = false;
  tacticalMap: TacticalMap;
  constructor(public settings: Settings) {
    this.root.innerHTML = `
 <div class="vignette"></div><header class="topbar"><a class="wordmark" href="#" aria-label="Relay Zero home"><span class="brand-symbol">R/</span> RELAY ZERO<span class="edition">ARENA</span></a><div class="top-right"><span id="sector-tag" class="sector-tag">SECTOR 07</span><button id="fullscreen" class="icon-button" aria-label="Toggle fullscreen">⛶</button><button id="sound" class="icon-button" aria-label="Toggle sound">♪</button></div></header>
 <main id="menu" class="menu"><div class="menu-copy"><div class="eyebrow"><span></span> COMBAT SIMULATION / VOL. 03</div><h1>RELAY <em>ZERO</em><span class="title-period">.</span></h1><p class="tagline">네 방식으로, 전장을 돌파해.</p><div class="menu-actions"><div class="section-label"><span>01 / SELECT OPERATION</span><b>플레이 방식</b></div><div class="mode-grid" role="group" aria-label="플레이 방식"><button class="mode-card selected" data-mode="solo" aria-pressed="true"><span class="mode-icon">⌖</span><b>싱글 작전</b><small>5웨이브 / 목표 수행</small></button><button class="mode-card" data-mode="duel" aria-pressed="false"><span class="mode-icon">×</span><b>친구 1대1</b><small>개인전 / 5킬 선승</small></button><button class="mode-card" data-mode="coop" aria-pressed="false"><span class="mode-icon">＋</span><b>2인 협동</b><small>생존전 / 친구 소생</small></button></div><div class="section-label"><span>02 / SELECT SECTOR</span><label for="map-choice">전장 선택</label></div><div class="map-grid" role="group" aria-label="전장 선택">${Object.entries(
   maps,
 )
   .map(
     ([id, m]) =>
       `<button class="map-card map-${id}" data-map="${id}" aria-pressed="${id === this.selectedMap}"><span class="map-art" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="map-card-copy"><small>SECTOR ${m.sector}</small><b>${m.name}</b></span></button>`,
   )
   .join(
     "",
   )}</div><select id="map-choice" class="difficulty-select" aria-label="전장 선택" hidden><option value="foundry">주조 공장</option><option value="cargo">화물 터미널</option><option value="nexus">넥서스 연구소</option></select><div class="map-summary"><b id="map-title">THE FOUNDRY</b><span id="map-detail"></span></div><div id="solo-options"><div><label class="difficulty-label" for="difficulty">난이도</label><select id="difficulty" class="difficulty-select"><option value="easy">쉬움</option><option value="normal">보통</option><option value="hard">어려움</option><option value="nightmare">악몽</option></select></div><div><label for="starter-pistol" class="difficulty-label">시작 피스톨</label><select id="starter-pistol" class="difficulty-select"></select></div><p id="difficulty-detail" class="difficulty-detail"></p><p id="personal-best" class="difficulty-detail"></p></div><p id="mode-detail" hidden class="difficulty-detail"></p><button id="play" class="primary">작전 시작 <span>↗</span></button><div class="menu-utilities"><button id="practice" class="secondary">사격 연습장 <span>⌖</span></button><button id="settings" class="secondary">설정</button><button id="controls" class="secondary">조작법</button></div></div><p class="desktop-note">PC BROWSER · KEYBOARD + MOUSE · FREE TO PLAY</p></div><aside class="arena-caption"><span class="caption-line"></span><div>ACTIVE SECTOR <b id="map-caption">07 / FOUNDRY</b></div><span class="coordinates">EXPLORE. ADAPT. STAY CONNECTED.</span><span id="mission-number" class="mission-number" hidden>07</span></aside></main>
 <section id="overlay" class="overlay" hidden><div class="dialog"><p class="eyebrow" id="overlay-label">SESSION PAUSED</p><h2 id="overlay-title">Take a breath.</h2><p id="overlay-detail">Your run is right where you left it.</p><p id="run-difficulty"></p><div id="results"></div><div id="shop-items" hidden></div><button id="endless" class="primary" hidden>무한 웨이브 도전 <span>∞</span></button><button id="open-shop" class="secondary">B · 무기 상점 (웨이브 사이)</button><button id="resume" class="primary">게임으로 돌아가기 <span>↗</span></button><button id="restart" class="secondary">다시 시작</button><button id="exit" class="secondary">메인 화면으로 나가기</button><button id="pause-settings" class="text-button">SETTINGS</button></div></section>
 <section id="settings-panel" class="overlay" hidden><div class="dialog settings-dialog"><div class="panel-heading"><h2>Settings</h2><button id="close-settings" class="icon-button" aria-label="Close settings">✕</button></div><label for="sensitivity">Mouse sensitivity <output id="sensitivity-out"></output><input id="sensitivity" type="range" min="0.15" max="3" step="0.05"></label><label for="masterVolume">Master volume <output id="masterVolume-out"></output><input id="masterVolume" type="range" min="0" max="1" step="0.05"></label><label for="sfxVolume">Effects volume <output id="sfxVolume-out"></output><input id="sfxVolume" type="range" min="0" max="1" step="0.05"></label><label for="fov">Field of view <output id="fov-out"></output><input id="fov" type="range" min="70" max="110" step="1"></label><label for="crosshairSize">Crosshair size <output id="crosshairSize-out"></output><input id="crosshairSize" type="range" min="0.5" max="2" step="0.1"></label><label class="inline">Graphics quality<select id="quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label class="inline">자동 성능 조절<input id="autoGraphics" type="checkbox"></label><p id="graphics-detail" class="settings-note">해상도를 유지하면서 그림자·조명 효과를 조절해 끊김을 줄여줘.</p><label class="inline">Head bob<input id="headBob" type="checkbox"></label><p class="settings-note">Saved automatically on this device.</p></div></section>
 <section id="controls-panel" class="overlay" hidden><div class="dialog"><div class="panel-heading"><h2>Controls</h2><button id="close-controls" class="icon-button" aria-label="Close controls">✕</button></div><dl class="controls-list"><dt>Move</dt><dd>W A S D</dd><dt>Look</dt><dd>MOUSE</dd><dt>Fire / Aim</dt><dd>LMB / RMB</dd><dt>Sprint / Jump</dt><dd>SHIFT / SPACE</dd><dt>대시</dt><dd>ALT · 쿨타임 3.5초</dd><dt>EMP 수류탄</dt><dd>G · 로봇 정지 / B에서 보충</dd><dt>전장 장치</dt><dd>E · 차단문 / 엄폐물</dd><dt>Crouch</dt><dd>CTRL / C</dd><dt>Reload</dt><dd>R</dd><dt>Switch weapon</dt><dd>1 / 2 / 3 / WHEEL</dd><dt>무기 상점</dt><dd>B · 웨이브 사이</dd><dt>장치 작동</dt><dd>E 길게 누르기</dd><dt>Pause</dt><dd>ESC</dd></dl><p class="settings-note">경량 돌격형: 빠른 접근 · 방패 방어형: 방패 파괴 또는 측면 공격 · 수리팩 지원형: 주변 적 수리 · 저격형: 레이저를 보고 이동 · 자폭형: 경고 원 밖으로 회피. 황색 전력통은 사격 시 폭발하며 자신도 피해를 받아.</p><p class="settings-note">게임 시작을 누르면 마우스가 게임에 고정돼.<br>ESC를 누르면 일시정지·나가기 메뉴가 열려.</p></div></section>
 ${combatMarkup(sightMarkup())}<pre id="debug" hidden></pre><div id="error" role="status" hidden></div><footer id="menu-footer"><span>RELAY ZERO <b>03.2</b></span><span>STAY MOVING. MAKE EVERY SHOT COUNT.</span><span id="graphics-status">WEBGL / READY</span></footer>`;
    this.tacticalMap = new TacticalMap(this.root);
    this.waveBars = [
      ...this.root.querySelectorAll<HTMLElement>(".wave-bars i"),
    ];
    const starter = this.el("starter-pistol") as HTMLSelectElement;
    for (const p of starters) {
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = `${p.name} · ${p.magazineSize}발 / 피해 ${p.damage}`;
      starter.append(option);
    }
    starter.onchange = () => {
      this.selectedPistol = starter.value;
    };
    this.el("endless").onclick = () => this.onEndless();
    this.el("open-shop").onclick = () => this.onShop();
    const mapSelect = this.el("map-choice") as HTMLSelectElement;
    mapSelect.value = this.selectedMap;
    const showMap = () => {
      const map = maps[this.selectedMap];
      this.set("map-title", map.title);
      this.set("map-caption", `${map.sector} / ${map.title}`);
      this.set("map-detail", map.description);
      this.set("sector-tag", `SECTOR ${map.sector}`);
      this.set("mission-number", map.sector);
      this.root.dataset.map = this.selectedMap;
      for (const button of this.root.querySelectorAll<HTMLElement>(
        "[data-map]",
      )) {
        const selected = button.dataset.map === this.selectedMap;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      }
    };
    showMap();
    mapSelect.onchange = () => {
      this.selectedMap = mapSelect.value as MapId;
      saveMap(this.selectedMap);
      showMap();
      this.refreshRecord();
      this.onMap(this.selectedMap);
    };
    for (const button of this.root.querySelectorAll<HTMLElement>("[data-map]"))
      button.onclick = () => {
        mapSelect.value = button.dataset.map!;
        mapSelect.dispatchEvent(new Event("change"));
      };
    for (const button of this.root.querySelectorAll<HTMLElement>("[data-mode]"))
      button.onclick = () => {
        this.selectedMode = button.dataset.mode as typeof this.selectedMode;
        for (const b of this.root.querySelectorAll<HTMLElement>(
          "[data-mode]",
        )) {
          b.classList.toggle("selected", b === button);
          b.setAttribute("aria-pressed", String(b === button));
        }
        this.el("solo-options").hidden = this.selectedMode !== "solo";
        this.el("mode-detail").hidden = this.selectedMode === "solo";
        this.set(
          "mode-detail",
          this.selectedMode === "duel"
            ? "같은 무장으로 시작 · 5킬 선승 · 방 코드로 친구 초대"
            : "두 명이 함께 5웨이브 생존 · 쓰러진 친구에게 E로 소생",
        );
        this.el("play").innerHTML =
          this.selectedMode === "solo"
            ? "작전 시작 <span>↗</span>"
            : "친구 대기실 <span>↗</span>";
      };
    const difficultySelect = this.el("difficulty") as HTMLSelectElement;
    difficultySelect.value = this.selectedDifficulty;
    this.el("difficulty-detail").textContent =
      difficulties[this.selectedDifficulty].description;
    difficultySelect.onchange = () => {
      this.selectedDifficulty = difficultySelect.value as DifficultyId;
      this.el("difficulty-detail").textContent =
        difficulties[this.selectedDifficulty].description;
      saveDifficulty(this.selectedDifficulty);
      this.refreshRecord();
    };
    this.el("play").onclick = () =>
      this.selectedMode === "solo"
        ? this.onPlay()
        : this.onOnline(this.selectedMode);
    this.el("practice").onclick = () => this.onPractice();
    this.el("resume").onclick = () => this.onResume();
    this.el("restart").onclick = () => this.onRestart();
    this.el("exit").onclick = () => this.onExit();
    for (const id of ["settings", "pause-settings"])
      this.el(id).onclick = () => (this.el("settings-panel").hidden = false);
    this.el("close-settings").onclick = () =>
      (this.el("settings-panel").hidden = true);
    this.el("controls").onclick = () =>
      (this.el("controls-panel").hidden = false);
    this.el("close-controls").onclick = () =>
      (this.el("controls-panel").hidden = true);
    this.el("fullscreen").onclick = () => {
      const p = document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen();
      p.catch(() => this.error("Fullscreen is unavailable in this browser."));
    };
    this.el("sound").onclick = () => {
      settings.masterVolume = settings.masterVolume > 0 ? 0 : 0.65;
      this.syncSettings();
      saveSettings(settings);
      this.onSettings();
    };
    for (const key of [
      "sensitivity",
      "masterVolume",
      "sfxVolume",
      "fov",
      "crosshairSize",
    ] as const) {
      const input = this.el(key) as HTMLInputElement;
      input.oninput = () => {
        settings[key] = Number(input.value);
        this.syncSettings();
        saveSettings(settings);
        this.onSettings();
      };
    }
    (this.el("quality") as HTMLSelectElement).onchange = (e) => {
      settings.quality = (e.target as HTMLSelectElement)
        .value as Settings["quality"];
      saveSettings(settings);
      this.onSettings();
    };
    (this.el("autoGraphics") as HTMLInputElement).onchange = (e) => {
      settings.autoGraphics = (e.target as HTMLInputElement).checked;
      saveSettings(settings);
      this.onSettings();
    };
    (this.el("headBob") as HTMLInputElement).onchange = (e) => {
      settings.headBob = (e.target as HTMLInputElement).checked;
      saveSettings(settings);
      this.onSettings();
    };
    this.syncSettings();
    this.refreshRecord();
  }
  shop(
    wallet: Wallet,
    equipped: string,
    equipment?: Equipment,
    sidearm = "p12",
  ): void {
    this.show("shop");
    this.set("overlay-label", `${wallet.coins} COINS / ARMORY`);
    this.set("overlay-title", "무장하고 다시 진입해.");
    this.set(
      "overlay-detail",
      "보유 무기는 무료 교체 · 총마다 부착물 최대 2개 · 상점에서는 시간 정지",
    );
    const root = this.el("shop-items");
    root.replaceChildren();
    for (const item of catalog) {
      const owned = wallet.owned.has(item.data.id),
        button = document.createElement("button");
      button.className = "shop-card";
      const title = document.createElement("b"),
        info = document.createElement("span");
      title.textContent = `${item.data.name} · ${equipped === item.data.id ? "장착 중" : owned ? "장착" : item.price + " 코인"}`;
      info.textContent = `${item.role} · 피해 ${item.data.damage} · ${item.data.magazineSize}발`;
      button.append(title, info);
      button.disabled =
        equipped === item.data.id || (!owned && wallet.coins < item.price);
      button.onclick = () => this.onBuy(item.data.id);
      root.append(button);
    }
    if (equipment) {
      const button = document.createElement("button");
      button.className = "shop-card equipment-card";
      button.textContent = `EMP 수류탄 +1 · 100 코인 · ${equipment.ammo}/3 보유`;
      button.disabled = equipment.ammo >= 3 || wallet.coins < 100;
      button.onclick = () => this.onEMPBuy();
      root.append(button);
    }
    for (const weapon of [
      starters.find((w) => w.id === sidearm)!,
      ...catalog.filter((i) => wallet.owned.has(i.data.id)).map((i) => i.data),
    ]) {
      const owned = wallet.upgrades.get(weapon.id);
      const heading = document.createElement("p");
      heading.className = "attachment-heading";
      heading.textContent = `${weapon.name} · 부착물 ${owned?.size ?? 0}/2`;
      root.append(heading);
      for (const item of attachments) {
        const button = document.createElement("button");
        button.className = "shop-card attachment-card";
        const name = document.createElement("b"),
          detail = document.createElement("span");
        name.textContent = `${item.name} · ${owned?.has(item.id) ? "장착됨" : item.price + " 코인"}`;
        detail.textContent = item.description;
        button.append(name, detail);
        button.disabled =
          owned?.has(item.id) ||
          (owned?.size ?? 0) >= 2 ||
          wallet.coins < item.price;
        button.onclick = () => this.onAttachment(weapon.id, item.id);
        root.append(button);
      }
    }
  }
  refreshRecord(): void {
    const best = new Records().get(this.selectedMap, this.selectedDifficulty);
    const endless = new EndlessRecords().get(
      this.selectedMap,
      this.selectedDifficulty,
    );
    this.set(
      "personal-best",
      `목표전 최고 ${best.score.toLocaleString()}점 · 최단 클리어 ${best.clearTime === null ? "—" : clock(best.clearTime)} · 무한 최고 ${endless.score.toLocaleString()}점 / ${endless.wave || "—"}웨이브`,
    );
  }
  results(
    stats: RunStats,
    score: number,
    kills: number,
    time: number,
    victory: boolean,
    record?: ReturnType<Records["save"]>,
  ): void {
    const root = this.el("results");
    root.replaceChildren();
    const grid = document.createElement("dl");
    grid.className = "result-grid";
    for (const [label, value] of [
      ["점수", score.toLocaleString()],
      ["처치", String(kills)],
      ["총기 명중률", `${stats.accuracy.toFixed(1)}%`],
      ["헤드샷 비율", `${stats.headRatio.toFixed(1)}%`],
      ["받은 피해", stats.damage.toFixed(0)],
      [victory ? "클리어 시간" : "생존 시간", clock(time)],
    ]) {
      const cell = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      cell.append(dt, dd);
      grid.append(cell);
    }
    root.append(grid);
    const note = document.createElement("p");
    note.className = "settings-note";
    note.textContent = `명중 ${stats.hits} / 발사 ${stats.shots} · 헤드샷 ${stats.heads} / 명중 ${stats.hits} · 방패 차단 ${stats.blocked}발. 근접·방패 차단은 명중률에서 제외. 일시정지 시간 제외.`;
    root.append(note);
    if (record) {
      const best = document.createElement("p");
      best.className = "record-summary";
      best.textContent = `${record.newScore || record.newTime ? "새 기록! · " : ""}최고 ${record.best.score.toLocaleString()}점 · 최단 클리어 ${record.best.clearTime === null ? "—" : clock(record.best.clearTime)}${record.saved ? " · 이 기기에 저장됨" : " · 저장 불가 (브라우저 저장소 제한)"}`;
      root.append(best);
    }
    this.refreshRecord();
  }
  el(id: string): HTMLElement {
    let node = this.nodes.get(id);
    if (!node) {
      node = document.getElementById(id)!;
      this.nodes.set(id, node);
    }
    return node;
  }
  set(id: string, value: string): void {
    if (this.cache.get(id) !== value) {
      this.el(id).textContent = value;
      this.cache.set(id, value);
    }
  }
  style(id: string, property: string, value: string): void {
    const key = id + ":" + property;
    if (this.styles.get(key) === value) return;
    this.el(id).style.setProperty(property, value);
    this.styles.set(key, value);
  }
  private hidden(id: string, hidden: boolean): void {
    const node = this.el(id);
    if (node.hidden !== hidden) node.hidden = hidden;
  }
  configureArena(level: Level): void {
    this.tacticalMap.configure(level);
  }
  telemetry(
    state: MapState & {
      elapsed: number;
      rest: number;
      mode: "solo" | "practice" | "duel" | "coop";
      friendly: number;
      opposition: number;
      roles: string[];
      allyHealth?: number;
    },
  ): void {
    const time = Math.max(
      0,
      state.rest > 0 ? Math.ceil(state.rest) : Math.floor(state.elapsed),
    );
    this.set(
      "match-time",
      `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`,
    );
    this.el("match-time").classList.toggle("countdown", state.rest > 0);
    this.set("friendly-score", String(state.friendly));
    this.set(
      "opposition-score",
      state.mode === "practice" ? "∞" : String(state.opposition),
    );
    this.set(
      "friendly-caption",
      state.mode === "duel"
        ? "YOU"
        : state.mode === "coop"
          ? "TEAM ELIMS"
          : "ELIMS",
    );
    this.set(
      "opposition-caption",
      state.mode === "duel"
        ? "RIVAL"
        : state.mode === "practice"
          ? "TARGETS"
          : "HOSTILES",
    );
    this.set(
      "combat-mode",
      state.mode === "duel"
        ? "1 VS 1 / FIRST TO 5"
        : state.mode === "coop"
          ? "CO-OP / HOLD TOGETHER"
          : state.mode === "practice"
            ? "FIRING RANGE"
            : "RELAY ZERO / LIVE OPERATION",
    );
    this.set("radar-legend", state.mode === "coop" ? "ALLY ◇" : "OBJECTIVE ◇");
    this.hidden("ally-card", state.mode !== "coop");
    this.el("ally-card").classList.toggle(
      "down",
      (state.allyHealth ?? 100) <= 0,
    );
    this.style("ally-health-fill", "width", `${state.allyHealth ?? 100}%`);
    this.set("ally-health", String(Math.ceil(state.allyHealth ?? 100)));
    this.hidden("rival-card", state.mode !== "duel");
    this.hidden("enemy-roster", state.mode === "duel");
    for (let i = 0; i < 5; i++) {
      const card = this.el(`enemy-card-${i}`),
        role = state.roles[i];
      if (card.hidden !== !role) card.hidden = !role;
      if (role && card.dataset.role !== role) card.dataset.role = role;
    }
    this.set(
      "enemy-overflow",
      state.roles.length > 5 ? `+${state.roles.length - 5}` : "",
    );
    this.tacticalMap.update(state);
  }
  abilities(state: {
    dash: number;
    emp: number;
    online: boolean;
    duel?: boolean;
    interact: boolean;
    revive?: number;
    melee: boolean;
  }): void {
    this.set("dash-status", state.dash > 0 ? state.dash.toFixed(1) : "");
    this.el("ability-dash").classList.toggle("cooling", state.dash > 0);
    this.style(
      "ability-dash",
      "--charge",
      `${100 * (1 - Math.min(1, state.dash / 3.5))}%`,
    );
    this.hidden("ability-emp", state.online);
    this.set("emp-status", String(state.emp));
    this.el("ability-emp").classList.toggle("unavailable", state.emp <= 0);
    this.hidden("ability-interact", state.duel === true);
    this.el("ability-interact").classList.toggle(
      "unavailable",
      !state.interact,
    );
    this.set(
      "interact-status",
      state.revive ? `${Math.floor((state.revive / 2) * 100)}%` : "",
    );
    const title = state.online
      ? "E · 쓰러진 친구 소생"
      : "E · 목표 / 전장 장치";
    if (this.el("ability-interact").title !== title)
      this.el("ability-interact").title = title;
    this.el("ability-melee").classList.toggle("equipped", state.melee);
  }
  syncSettings(): void {
    for (const key of [
      "sensitivity",
      "masterVolume",
      "sfxVolume",
      "fov",
      "crosshairSize",
    ] as const) {
      (this.el(key) as HTMLInputElement).value = String(this.settings[key]);
      this.el(key + "-out").textContent = String(this.settings[key]);
    }
    (this.el("quality") as HTMLSelectElement).value = this.settings.quality;
    (this.el("autoGraphics") as HTMLInputElement).checked =
      this.settings.autoGraphics;
    (this.el("headBob") as HTMLInputElement).checked = this.settings.headBob;
    this.el("sound").textContent = this.settings.masterVolume > 0 ? "♪" : "∅";
  }
  show(screen: Screen, score = 0, kills = 0, time = 0): void {
    this.screen = screen;
    this.el("endless").hidden = screen !== "victory";
    this.el("menu").hidden = screen !== "start";
    this.el("menu-footer").hidden = screen !== "start";
    this.el("hud").hidden = screen === "start";
    this.el("overlay").hidden = screen === "start" || screen === "playing";
    this.root.classList.toggle("in-game", screen !== "start");
    this.el("resume").hidden = screen !== "pause" && screen !== "shop";
    this.el("shop-items").hidden = screen !== "shop";
    this.el("open-shop").hidden = screen !== "pause";
    if (screen === "shop") this.el("results").textContent = "";
    this.el("settings-panel").hidden = true;
    this.el("controls-panel").hidden = true;
    if (screen === "pause") {
      this.set("overlay-label", "SESSION PAUSED");
      this.set("overlay-title", "Take a breath.");
      this.set("overlay-detail", "Your run is right where you left it.");
      this.el("results").textContent = "";
    }
    if (screen === "victory" || screen === "defeat") {
      this.set(
        "overlay-label",
        screen === "victory" ? "ALL WAVES CLEARED" : "SIGNAL LOST",
      );
      this.set(
        "overlay-title",
        screen === "victory" ? "Relay secured." : "Connection lost.",
      );
      this.set(
        "overlay-detail",
        screen === "victory"
          ? "5개 웨이브 완료! 무장을 유지하고 무한 웨이브에 도전할 수 있어. 무한 점수와 시간은 새로 시작해."
          : "Regroup. Reload. Run it back.",
      );
      this.el("results").textContent =
        `${score.toLocaleString()} POINTS  /  ${kills} ELIMINATIONS  /  ${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;
    }
  }
  hit(head: boolean, kill: boolean): void {
    this.hitActive = true;
    this.hitTime = kill ? 0.24 : head ? 0.21 : 0.14;
    this.el("hitmarker").classList.toggle("critical", head);
    this.el("hitmarker").classList.toggle("confirmed", kill);
    this.el("hitmarker").style.color = kill
      ? "var(--color-accent)"
      : head
        ? "var(--color-accent)"
        : "#fff";
    this.el("hitmarker").style.opacity = "1";
  }
  elimination(message: string): void {
    this.killActive = true;
    this.set("kill-feedback", message);
    this.killTime = 0.85;
    this.el("kill-feedback").style.opacity = "1";
  }
  toast(message: string, duration = 2): void {
    this.toastActive = true;
    this.set("toast", message);
    this.toastTime = duration;
    this.el("toast").style.opacity = "1";
  }
  damage(angle: number, amount: number): void {
    if (!this.damageFeedback.trigger(angle, amount)) return;
    this.el("damage-arrow").style.transform =
      `translate(-50%,-50%) rotate(${this.damageFeedback.angle}rad) translateY(-115px)`;
    this.set("damage-label", `피격 −${Math.ceil(this.damageFeedback.amount)}`);
    this.paintDamage();
  }
  private paintDamage(): void {
    const feedback = this.damageFeedback;
    if (!this.damageActive && feedback.remaining <= 0) return;
    this.damageActive = feedback.remaining > 0;
    this.el("damage-arrow").style.opacity = String(feedback.labelOpacity);
    this.el("damage-flash").style.opacity = String(feedback.opacity);
    this.el("damage-label").style.opacity = String(feedback.labelOpacity);
    this.el("health").classList.toggle("recent-damage", feedback.remaining > 0);
  }
  tick(dt: number): void {
    this.killTime -= dt;
    if (this.killTime <= 0 && this.killActive) {
      this.el("kill-feedback").style.opacity = "0";
      this.killActive = false;
    }
    this.hitTime -= dt;
    this.toastTime -= dt;
    this.damageFeedback.update(dt);
    this.paintDamage();
    if (this.hitTime <= 0 && this.hitActive) {
      this.el("hitmarker").style.opacity = "0";
      this.hitActive = false;
    }
    if (this.toastTime <= 0 && this.toastActive) {
      this.el("toast").style.opacity = "0";
      this.toastActive = false;
    }
  }
  error(message: string): void {
    this.el("error").hidden = false;
    this.el("error").textContent = message;
  }
}
