const svg = (body: string, view = "0 0 32 32") =>
  `<svg viewBox="${view}" aria-hidden="true" focusable="false">${body}</svg>`;
export const icons = {
  dash: svg(
    '<path d="m8 16 8-9 8 9M8 25l8-9 8 9" fill="none" stroke="currentColor" stroke-width="4"/>',
  ),
  emp: svg(
    '<path d="m18 2-3 9-8-4 4 8-9 3 9 3-4 8 8-4 3 7 3-10 9-3-9-3 4-9-8 4Z" fill="currentColor"/><circle cx="17" cy="17" r="4" fill="#152732"/>',
  ),
  interact: svg(
    '<path d="M4 10h12V5l12 11-12 11v-5H4v-5h13l-4-4H4Z" fill="currentColor"/>',
  ),
  baton: svg(
    '<path d="m23 2 7 7-16 17-5-5Z" fill="currentColor"/><path d="m11 19 5 5-7 7-5-5Z" fill="currentColor"/><path d="M8 17 18 27" stroke="currentColor" stroke-width="3"/>',
  ),
  rifle: svg(
    '<path d="m3 11 5-3 20 1 3 3h11v4H31l-3 5-6-1-2 7h-5l2-8H9L4 25H0l3-10Z" fill="currentColor"/><path d="M14 4h12v4H14Z" fill="currentColor"/>',
    "0 0 44 32",
  ),
  pistol: svg(
    '<path d="M5 7h25v8H19l-4 15H6l4-15H4Z" fill="currentColor"/><path d="M20 16h7v6h-9" fill="none" stroke="currentColor" stroke-width="2"/>',
  ),
};
export const operative = svg(
  '<path d="M0 112V88l26-17h44l26 17v24Z" fill="#425666"/><path d="m19 89 19-13h20l19 13 8 23H11Z" fill="#203543"/><path d="M38 69h20v19H38Z" fill="#b4c3c8"/><path d="m26 25 17-15 25 6 8 18-7 33-21 16-22-17-5-25Z" fill="#7f979f"/><path d="m27 32 38-8 7 14-7 15H29l-7-12Z" fill="#172d3b"/><path d="m29 35 34-6 6 8-7 8H30l-5-7Z" fill="#b5f6e0"/><path d="m29 54 18-6 17 5 1 16-18 12-19-15Z" fill="#344b5c"/><path d="m42 57 6-5 6 5v12H42Z" fill="#a7b5b4"/><path d="m28 24 13-13 7 3-9 15Zm35-8 7 4 5 14-8-1Z" fill="#d7b887"/><path d="m31 94 11-6h13l11 6-7 18H38Z" fill="#132936"/><path d="M41 96h14v4H41Z" fill="#b4f0db"/>',
  "0 0 96 112",
);
export const robot = svg(
  '<path d="m8 6 8-4 8 4 4 11-5 11H9L4 17Z" fill="#526571"/><path d="M8 11h16v10H8Z" fill="#172735"/><path d="M9 13h5v4H9Zm9 0h5v4h-5Z" fill="currentColor"/><path d="M11 23h10v3H11Z" fill="#d8e4e2"/>',
);
function ability(
  id: string,
  icon: string,
  title: string,
  key: string,
  value: string,
  extra = "",
) {
  return `<div id="ability-${id}" class="ability ${extra}" title="${title} · ${key}"><div class="ability-icon">${icon}</div><b id="${id}-status" class="ability-value">${value}</b><span class="ability-name">${title}</span><kbd>${key}</kbd><i class="ability-track"></i></div>`;
}
export function combatMarkup(reticle: string): string {
  return `
<div id="hud" hidden>
 <section id="radar" class="tactical-radar" aria-label="전장 미니맵"><div class="radar-disc"><svg id="minimap" viewBox="0 0 240 240" role="img" aria-label="내 위치, 협동 친구와 현재 목표"><circle cx="120" cy="120" r="119" fill="#142432aa"/><g id="minimap-walls"></g><g id="minimap-devices"></g><g id="minimap-objective" visibility="hidden"><circle r="15" fill="#f3bf5b24" stroke="#f3ce83" stroke-width="1.5" stroke-dasharray="3 3"/><path d="m0-5 5 5-5 5-5-5Z" fill="#ffe2a4"/></g><g id="minimap-ally" visibility="hidden"><path d="m0-5 5 5-5 5-5-5Z" fill="#a5eed4" stroke="#152c35" stroke-width="1.4"/></g><g id="minimap-player"><path d="M0 0-11-24 11-24Z" fill="#c9ffdf25"/><path d="m0-7 5 12-5-3-5 3Z" fill="#f6fff7" stroke="#173b41" stroke-width="1.5"/></g></svg><span class="radar-north">N</span></div><span id="radar-map">THE FOUNDRY</span><small>YOU <i></i> <span id="radar-legend">OBJECTIVE ◇</span></small></section>
 <section class="match-strip" aria-label="현재 전투 진행"><div class="team-wing friendly-wing"><div class="team-tally"><b id="friendly-score">0</b><small id="friendly-caption">ELIMS</small></div><div class="team-portrait local-portrait" title="나">${operative}<i></i></div><div id="ally-card" class="team-portrait ally-portrait" hidden title="협동 친구">${operative}<i id="ally-health-fill"></i><span id="ally-health">100</span></div><div class="wave-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div><div class="match-core"><span id="wave-label">WAVE 01 / 05</span><b id="match-time">0:00</b><strong id="objective">적 전멸</strong></div><div class="team-wing hostile-wing"><div id="enemy-roster" class="enemy-roster">${Array.from({ length: 5 }, (_, i) => `<div id="enemy-card-${i}" class="enemy-portrait" hidden>${robot}</div>`).join("")}<span id="enemy-overflow"></span></div><div id="rival-card" class="team-portrait rival-portrait" hidden title="친구 상대">${operative}</div><div class="team-tally"><b id="opposition-score">0</b><small id="opposition-caption">HOSTILES</small></div></div></section>
 <div class="mission-stack"><small id="enemies">CONTACT INBOUND</small><div id="mission-status" hidden><span id="mission-arrow">↑</span><div><b id="mission-hint"></b><small id="mission-distance"></small><div class="mission-track"><i id="mission-fill"></i></div></div></div></div>
 <div class="score"><span>SESSION SCORE</span><b id="score">00000</b><small id="coins">0 COINS · B 상점</small></div>
 <div id="boss-panel" hidden><span>COMMAND UNIT / GUARDIAN</span><b id="boss-state"></b><div class="boss-track"><i id="boss-fill"></i></div></div>
 <div id="ads-reticle" hidden aria-hidden="true">${reticle}</div><div id="crosshair"><i></i><i></i><i></i><i></i><b></b></div><div id="hitmarker">╳</div><div id="damage-arrow" aria-hidden="true">▲</div><div id="damage-flash" aria-hidden="true"></div><div id="damage-label" aria-live="off"></div><div id="toast"></div><div id="kill-feedback"></div>
 <section class="health" aria-label="플레이어 체력"><div class="operator-badge">${operative}<span>R / 01</span></div><div class="vitals"><span class="hud-label">OPERATOR / INTEGRITY</span><div class="health-value"><b id="health">100</b><span>/ 100</span></div><div class="health-track"><i id="health-fill"></i></div><span class="vital-ticks">I &nbsp; I &nbsp; I &nbsp; I &nbsp; I</span></div></section>
 <section class="weapon-hud" aria-label="현재 무기 탄약"><div id="weapon-name" class="hud-label">P-12 SIDEARM</div><div class="ammo"><b id="ammo">12</b><span class="ammo-marks" aria-hidden="true"><i></i><i></i><i></i></span><span>/ <span id="reserve">72</span></span></div><small id="reload-label">R · RELOAD</small><div id="reload-bar"><i id="reload-fill"></i></div></section>
 <aside class="weapon-slots weapon-rail" aria-label="보유 무기"><div id="loadout-primary" class="loadout-row" data-slot="0"><span class="rail-icon">${icons.rifle}</span><span id="slot1">주무기 미구매</span><kbd>1</kbd></div><div class="loadout-row" data-slot="1"><span class="rail-icon">${icons.pistol}</span><span id="slot2">P-12 SIDEARM</span><kbd>2</kbd></div><div class="loadout-row" data-slot="2"><span class="rail-icon">${icons.baton}</span><span id="slot3">ARC-3 충격봉</span><kbd>3</kbd></div></aside>
 <section id="tactical-hud" aria-label="능력과 장비">${ability("dash", icons.dash, "대시", "ALT", "준비")}${ability("emp", icons.emp, "EMP", "G", "2")}${ability("interact", icons.interact, "상호작용", "E", "")}${ability("melee", icons.baton, "충격봉", "3", "", "signature-ability")}<small id="device-hint"></small></section>
 <div class="bottom-hint"><span id="combat-mode">RELAY ZERO</span><span>ESC · 메뉴</span></div>
</div>`;
}
