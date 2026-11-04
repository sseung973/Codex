import { maps, type MapId } from "../world/MapData";
import { difficulties } from "../core/Difficulty";

/** Same sections and 1280×720 composition as the native Unity menu. */
export function unityMenu(map: MapId): string {
  return `<main id="menu" class="menu unity-menu">
    <div class="unity-intro"><p class="eyebrow">COMBAT SIMULATION / TRAINING DIVISION</p>
      <h1>RELAY<br>ZERO</h1><p class="tagline">돌파하고. 점령하고. 살아남아.</p>
      <p class="unity-description">피스톨로 시작하는 다섯 번의 전투.<br>친구와는 1vs1 결투 또는 2인 협동으로.</p>
      <p class="unity-controls">WASD 이동 · 마우스 조준 · ALT 대시<br>E 작동 · G EMP · B 상점 · ESC 메뉴</p>
      <p class="unity-caption">ORIGINAL ARENAS & ARSENAL</p>
      <span id="map-caption" hidden></span><span id="mission-number" hidden></span>
    </div>
    <div class="menu-copy unity-setup"><div class="menu-actions">
      <div class="section-label"><label for="map-choice">01 / 전장 선택</label></div>
      <div class="map-grid" role="group" aria-label="전장 선택">${Object.entries(
        maps,
      )
        .map(
          ([id, m]) =>
            `<button class="map-card map-${id}" data-map="${id}" aria-pressed="${id === map}"><span class="map-card-copy"><b>${m.name}</b></span></button>`,
        )
        .join("")}</div>
      <select id="map-choice" hidden aria-label="전장 선택">${Object.entries(
        maps,
      )
        .map(([id, m]) => `<option value="${id}">${m.name}</option>`)
        .join("")}</select>
      <div class="map-summary"><b id="map-title"></b><span id="map-detail"></span></div>
      <div id="solo-options">
        <div class="section-label"><label for="difficulty">02 / 난이도</label></div>
        <div class="unity-difficulties" role="group" aria-label="난이도">${Object.entries(
          difficulties,
        )
          .map(
            ([id, d]) =>
              `<button data-difficulty="${id}" aria-pressed="false">${d.label}</button>`,
          )
          .join("")}</div>
        <select id="difficulty" hidden aria-label="난이도">${Object.entries(
          difficulties,
        )
          .map(([id, d]) => `<option value="${id}">${d.label}</option>`)
          .join("")}</select>
        <p id="difficulty-detail" class="difficulty-detail"></p>
        <div class="section-label"><label for="starter-pistol">03 / 시작 피스톨</label></div>
        <div class="unity-pistols" role="group" aria-label="시작 피스톨"><button data-pistol="p12" aria-pressed="true">P-12 SIDEARM / 12발</button><button data-pistol="p6" aria-pressed="false">P-6 IMPACT / 6발</button></div>
        <select id="starter-pistol" hidden aria-label="시작 피스톨"></select>
      </div>
      <p id="unity-selection"></p><p id="mode-detail" hidden class="difficulty-detail"></p>
      <button id="play" class="primary">게임 시작 <span>→</span></button>
      <div class="unity-friends"><button id="unity-duel" class="secondary">친구와 1vs1</button><button id="unity-coop" class="secondary">2인 협동</button><button id="practice" class="secondary">사격 연습장</button></div>
      <div class="unity-bottom"><button id="settings" class="secondary">설정</button><button id="controls" class="text-button">조작법</button><p id="personal-best" class="difficulty-detail"></p></div>
      <p class="desktop-note">PC · 키보드와 마우스</p>
      <div class="mode-grid" hidden><button data-mode="solo">싱글 작전</button><button data-mode="duel">친구 1vs1</button><button data-mode="coop">2인 협동</button></div>
    </div></div>
  </main>`;
}
