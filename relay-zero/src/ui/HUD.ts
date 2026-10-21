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
  onShop: () => void = () => {};
  onBuy: (id: string) => void = () => {};
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
  damageTime = 0;
  private cache = new Map<string, string>();
  constructor(public settings: Settings) {
    this.root.innerHTML = `
 <div class="vignette"></div><header class="topbar"><a class="wordmark" href="#" aria-label="Relay Zero home"><span class="brand-symbol">R/</span> RELAY ZERO<span class="edition">ARENA</span></a><div class="top-right"><span id="sector-tag" class="sector-tag">SECTOR 07</span><button id="fullscreen" class="icon-button" aria-label="Toggle fullscreen">⛶</button><button id="sound" class="icon-button" aria-label="Toggle sound">♪</button></div></header>
 <main id="menu" class="menu"><div class="menu-copy"><div class="eyebrow"><span></span> COMBAT SIMULATION / TRAINING DIVISION</div><h1>RELAY<br><em>ZERO</em><span class="title-period">.</span></h1><p class="tagline">훈련은 끝났다.<br>이제 중계기를 지켜라.</p><div class="mission"><span id="mission-number" class="mission-number">07</span><div><b id="map-title">THE FOUNDRY</b><p>Five waves. One relay. No backup.</p></div></div><div class="menu-actions"><label for="map-choice" class="difficulty-label">전장 선택</label><select id="map-choice" class="difficulty-select"><option value="foundry">주조 공장</option><option value="cargo">화물 터미널</option><option value="nexus">넥서스 연구소</option></select><p id="map-detail" class="difficulty-detail"></p><label class="difficulty-label" for="difficulty">난이도</label><select id="difficulty" class="difficulty-select"><option value="easy">쉬움</option><option value="normal">보통</option><option value="hard">어려움</option><option value="nightmare">악몽</option></select><p id="difficulty-detail" class="difficulty-detail"></p><p id="personal-best" class="difficulty-detail"></p><label for="starter-pistol" class="difficulty-label">시작 피스톨</label><select id="starter-pistol" class="difficulty-select"></select><button id="play" class="primary">게임 시작 <span>↗</span></button><button id="practice" class="secondary">사격 연습장 <span>⌖</span></button><div class="minor-actions"><button id="settings">SETTINGS</button><span>/</span><button id="controls">CONTROLS</button></div></div><p class="desktop-note">DESKTOP EXPERIENCE · KEYBOARD + MOUSE</p></div><aside class="arena-caption"><span class="caption-line"></span><div>RELAY STATION <b id="map-caption">07 / FOUNDRY</b></div><span class="coordinates">TRAINING FACILITY / AUTHORIZED ACCESS</span></aside></main>
 <section id="overlay" class="overlay" hidden><div class="dialog"><p class="eyebrow" id="overlay-label">SESSION PAUSED</p><h2 id="overlay-title">Take a breath.</h2><p id="overlay-detail">Your run is right where you left it.</p><p id="run-difficulty"></p><div id="results"></div><div id="shop-items" hidden></div><button id="open-shop" class="secondary">B · 무기 상점 (웨이브 사이)</button><button id="resume" class="primary">게임으로 돌아가기 <span>↗</span></button><button id="restart" class="secondary">다시 시작</button><button id="exit" class="secondary">메인 화면으로 나가기</button><button id="pause-settings" class="text-button">SETTINGS</button></div></section>
 <section id="settings-panel" class="overlay" hidden><div class="dialog settings-dialog"><div class="panel-heading"><h2>Settings</h2><button id="close-settings" class="icon-button" aria-label="Close settings">✕</button></div><label for="sensitivity">Mouse sensitivity <output id="sensitivity-out"></output><input id="sensitivity" type="range" min="0.15" max="3" step="0.05"></label><label for="masterVolume">Master volume <output id="masterVolume-out"></output><input id="masterVolume" type="range" min="0" max="1" step="0.05"></label><label for="sfxVolume">Effects volume <output id="sfxVolume-out"></output><input id="sfxVolume" type="range" min="0" max="1" step="0.05"></label><label for="fov">Field of view <output id="fov-out"></output><input id="fov" type="range" min="70" max="110" step="1"></label><label for="crosshairSize">Crosshair size <output id="crosshairSize-out"></output><input id="crosshairSize" type="range" min="0.5" max="2" step="0.1"></label><label class="inline">Graphics quality<select id="quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label class="inline">Head bob<input id="headBob" type="checkbox"></label><p class="settings-note">Saved automatically on this device.</p></div></section>
 <section id="controls-panel" class="overlay" hidden><div class="dialog"><div class="panel-heading"><h2>Controls</h2><button id="close-controls" class="icon-button" aria-label="Close controls">✕</button></div><dl class="controls-list"><dt>Move</dt><dd>W A S D</dd><dt>Look</dt><dd>MOUSE</dd><dt>Fire / Aim</dt><dd>LMB / RMB</dd><dt>Sprint / Jump</dt><dd>SHIFT / SPACE</dd><dt>Crouch</dt><dd>CTRL / C</dd><dt>Reload</dt><dd>R</dd><dt>Switch weapon</dt><dd>1 / 2 / 3 / WHEEL</dd><dt>무기 상점</dt><dd>B · 웨이브 사이</dd><dt>장치 작동</dt><dd>E 길게 누르기</dd><dt>Pause</dt><dd>ESC</dd></dl><p class="settings-note">경량 돌격형: 빠른 접근 · 방패 방어형: 방패 파괴 또는 측면 공격 · 수리팩 지원형: 주변 적 수리</p><p class="settings-note">게임 시작을 누르면 마우스가 게임에 고정돼.<br>ESC를 누르면 일시정지·나가기 메뉴가 열려.</p></div></section>
 <div id="hud" hidden><div id="boss-panel" hidden><span>COMMAND UNIT · SECTOR GUARDIAN</span><b id="boss-state">지휘 로봇 · 공격을 대비해</b><div class="boss-track"><i id="boss-fill"></i></div></div><div class="mission-stack"><div class="objective"><span id="wave-label">WAVE 01 / 05</span><b id="objective">HOLD THE RELAY</b><div class="wave-bars"><i></i><i></i><i></i><i></i><i></i></div><small id="enemies">3 SENTINELS REMAINING</small></div><div id="mission-status" hidden><span id="mission-arrow">↑</span><div><b id="mission-hint"></b><small id="mission-distance"></small><div class="mission-track"><i id="mission-fill"></i></div></div></div></div><div class="score"><span>SCORE</span><b id="score">00000</b><small id="coins">0 COINS · B 상점</small></div><div id="ads-reticle" hidden aria-hidden="true">${sightMarkup()}</div><div id="crosshair"><i></i><i></i><i></i><i></i><b></b></div><div id="hitmarker">╳</div><div id="damage-arrow">▲</div><div id="damage-flash"></div><div id="toast"></div><div id="kill-feedback"></div><div class="health"><div class="hud-label">+ &nbsp; INTEGRITY</div><div class="health-value"><b id="health">100</b><span>/ 100</span></div><div class="health-track"><i id="health-fill"></i></div></div><div class="weapon-hud"><div id="weapon-name" class="hud-label">AR-7 VANGUARD</div><div class="ammo"><b id="ammo">30</b><span>/ <span id="reserve">180</span></span></div><div class="weapon-slots"><span id="slot1">1 &nbsp; ASSAULT RIFLE</span><span id="slot2">2 &nbsp; SIDEARM</span><span id="slot3">3 &nbsp; 충격봉</span></div></div><div class="bottom-hint"><span id="reload-label">R &nbsp; RELOAD</span><span>ESC &nbsp; 일시정지 / 나가기</span></div><div id="reload-bar"><i></i></div></div><pre id="debug" hidden></pre><div id="error" role="status" hidden></div><footer id="menu-footer"><span>RELAY ZERO <b>01.0</b></span><span>STAY MOVING. MAKE EVERY SHOT COUNT.</span><span id="graphics-status">WEBGL / READY</span></footer>`;
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
    };
    showMap();
    mapSelect.onchange = () => {
      this.selectedMap = mapSelect.value as MapId;
      saveMap(this.selectedMap);
      showMap();
      this.refreshRecord();
      this.onMap(this.selectedMap);
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
    this.el("play").onclick = () => this.onPlay();
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
    (this.el("headBob") as HTMLInputElement).onchange = (e) => {
      settings.headBob = (e.target as HTMLInputElement).checked;
      saveSettings(settings);
      this.onSettings();
    };
    this.syncSettings();
    this.refreshRecord();
  }
  shop(wallet: Wallet, equipped: string): void {
    this.show("shop");
    this.set("overlay-label", `${wallet.coins} COINS / ARMORY`);
    this.set("overlay-title", "다음 무기를 골라.");
    this.set("overlay-detail", "보유 무기는 무료 교체 · 상점에서는 시간 정지");
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
  }
  refreshRecord(): void {
    const best = new Records().get(this.selectedMap, this.selectedDifficulty);
    this.set(
      "personal-best",
      `목표전 최고 ${best.score.toLocaleString()}점 · 최단 클리어 ${best.clearTime === null ? "—" : clock(best.clearTime)}`,
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
    return document.getElementById(id)!;
  }
  set(id: string, value: string): void {
    if (this.cache.get(id) !== value) {
      this.el(id).textContent = value;
      this.cache.set(id, value);
    }
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
    (this.el("headBob") as HTMLInputElement).checked = this.settings.headBob;
    this.el("sound").textContent = this.settings.masterVolume > 0 ? "♪" : "∅";
  }
  show(screen: Screen, score = 0, kills = 0, time = 0): void {
    this.screen = screen;
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
          ? "모든 웨이브를 완료했어."
          : "Regroup. Reload. Run it back.",
      );
      this.el("results").textContent =
        `${score.toLocaleString()} POINTS  /  ${kills} ELIMINATIONS  /  ${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;
    }
  }
  hit(head: boolean, kill: boolean): void {
    this.hitTime = kill ? .24 : head ? .21 : .14;
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
    this.set("kill-feedback", message);
    this.killTime = 0.85;
    this.el("kill-feedback").style.opacity = "1";
  }
  toast(message: string, duration = 2): void {
    this.set("toast", message);
    this.toastTime = duration;
    this.el("toast").style.opacity = "1";
  }
  damage(angle: number): void {
    this.damageTime = 0.65;
    this.el("damage-arrow").style.transform =
      `translate(-50%,-50%) rotate(${angle}rad) translateY(-150px)`;
    this.el("damage-arrow").style.opacity = "1";
    this.el("damage-flash").style.opacity = ".22";
  }
  tick(dt: number): void {
    this.killTime -= dt;
    if (this.killTime <= 0) this.el("kill-feedback").style.opacity = "0";
    this.hitTime -= dt;
    this.toastTime -= dt;
    this.damageTime -= dt;
    if (this.hitTime <= 0) this.el("hitmarker").style.opacity = "0";
    if (this.toastTime <= 0) this.el("toast").style.opacity = "0";
    if (this.damageTime <= 0) {
      this.el("damage-arrow").style.opacity = "0";
      this.el("damage-flash").style.opacity = "0";
    }
  }
  error(message: string): void {
    this.el("error").hidden = false;
    this.el("error").textContent = message;
  }
}
