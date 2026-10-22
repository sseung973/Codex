import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { NullEngine, Scene, Vector3 } from "@babylonjs/core";
import { HUD } from "../src/ui/HUD";
import { Game } from "../src/core/Game";
import { OnlineArena } from "../src/multiplayer/OnlineArena";
import { defaults } from "../src/core/Settings";
import { Level } from "../src/world/Level";
import { Navigation } from "../src/ai/Navigation";
import { objectivePoints } from "../src/world/ObjectiveMarker";
import { Player } from "../src/player/Player";
import { Weapon } from "../src/weapons/Weapon";
import { Effects } from "../src/effects/Effects";
import { Objectives } from "../src/core/Objectives";
import { Waves } from "../src/core/Waves";
import { difficulties } from "../src/core/Difficulty";
import { Wallet } from "../src/weapons/Arsenal";
import { mapPoint } from "../src/ui/TacticalMap";
class GeometryLevel extends Level {
  override sign(): void {}
}
function domFixture() {
  const dom = new JSDOM('<div id="ui"></div>', {
    url: "https://relay-zero-arena.sseung973.chatgpt.site/",
  });
  const keys = [
      "window",
      "document",
      "localStorage",
      "navigator",
      "location",
      "Event",
    ] as const,
    old = new Map(
      keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]),
    );
  for (const key of keys)
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      writable: true,
      configurable: true,
    });
  return {
    hud: new HUD({ ...defaults }),
    close: () => {
      dom.window.close();
      for (const key of keys) {
        const descriptor = old.get(key);
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete (globalThis as any)[key];
      }
    },
  };
}
test("tactical HUD uses actual health, ammo, elapsed time, mode scores and available abilities", () => {
  const f = domFixture(),
    engine = new NullEngine(),
    scene = new Scene(engine),
    level = new GeometryLevel(scene);
  level.optimize();
  try {
    const input: any = {
      dx: 0,
      dy: 0,
      wheel: 0,
      down: () => false,
      consume: () => false,
    };
    const player = new Player(scene, input, { ...defaults });
    player.resetAt(level.spawn);
    player.health = 82;
    player.yaw = Math.PI / 2;
    player.dash.cooldown = 1.7;
    const weapon = new Weapon(
      scene,
      player,
      { play: () => {} } as any,
      new Effects(scene),
    );
    weapon.startLoadout("p12", true);
    weapon.mag.ammo = 23;
    weapon.mag.reserve = 50;
    const waves = new Waves();
    waves.index = 3;
    waves.remaining = 8;
    const objectives = new Objectives();
    objectives.reset("capture", [new Vector3(3, 0, 4)]);
    const g: any = Object.create(Game.prototype);
    Object.assign(g, {
      hud: f.hud,
      settings: { ...defaults },
      player,
      weapon,
      waves,
      objectives,
      level,
      equipment: { ammo: 2 },
      enemies: [],
      targets: [],
      wallet: new Wallet(),
      difficulty: difficulties.normal,
      practice: false,
      debug: false,
      score: 1200,
      kills: 7,
      time: 89,
    });
    f.hud.configureArena(level);
    f.hud.show("playing");
    g.updateHUD();
    assert.equal(f.hud.el("health").textContent, "82");
    assert.equal(f.hud.el("ammo").textContent, "23");
    assert.equal(f.hud.el("reserve").textContent, "50");
    assert.equal(f.hud.el("match-time").textContent, "1:29");
    assert.equal(f.hud.el("friendly-score").textContent, "7");
    assert.equal(f.hud.el("opposition-score").textContent, "8");
    assert.equal(f.hud.el("dash-status").textContent, "1.7");
    assert.equal(f.hud.el("emp-status").textContent, "2");
    assert.equal(f.hud.el("ability-emp").hidden, false);
    assert.match(
      f.hud.el("minimap-player").getAttribute("transform")!,
      /rotate\(90.0\)/,
    );
    const online: any = Object.create(OnlineArena.prototype);
    Object.assign(online, {
      game: g,
      client: { role: "host", ping: 42 },
      mode: "coop",
      hp: [82, 0],
      scores: [4, 2],
      remote: { p: [2, 0, -17], y: 0 },
      enemies: new Map(),
      pending: 3,
      wave: 2,
      clock: 89,
      wait: 0,
      revive: 1,
      protect: [0, 0],
      respawn: [0, 0],
      begun: true,
    });
    f.hud.configureArena(level);
    online.paintHUD();
    assert.equal(f.hud.el("friendly-score").textContent, "6");
    assert.equal(f.hud.el("ally-card").hidden, false);
    assert.equal(f.hud.el("ally-health").textContent, "0");
    assert.equal(f.hud.el("ability-emp").hidden, true);
    assert.equal(f.hud.el("ability-interact").hidden, false);
    assert.equal(f.hud.el("interact-status").textContent, "50%");
    assert.equal(
      f.hud.el("minimap-ally").getAttribute("visibility"),
      "visible",
    );
    online.mode = "duel";
    f.hud.configureArena(level);
    online.paintHUD();
    assert.equal(f.hud.el("friendly-score").textContent, "4");
    assert.equal(f.hud.el("opposition-score").textContent, "2");
    assert.equal(f.hud.el("ally-card").hidden, true);
    assert.equal(f.hud.el("ability-interact").hidden, true);
    assert.equal(f.hud.el("minimap-ally").getAttribute("visibility"), "hidden");
    assert.equal(
      f.hud.el("minimap-objective").getAttribute("visibility"),
      "hidden",
    );
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
  } finally {
    scene.dispose();
    engine.dispose();
    f.close();
  }
});
test("minimap bakes distinct real map footprints, updates markers, and throttles updates", () => {
  const f = domFixture(),
    engine = new NullEngine(),
    shapes: string[] = [];
  try {
    assert.deepEqual(mapPoint({ x: 0, z: 0 }), [120, 120]);
    assert.deepEqual(mapPoint({ x: -20, z: 20 }), [20, 20]);
    for (const map of ["foundry", "cargo", "nexus"] as const) {
      const scene = new Scene(engine),
        level = new GeometryLevel(scene, map),
        nav = new Navigation(level);
      level.optimize();
      f.hud.configureArena(level);
      const walls = f.hud.el("minimap-walls");
      assert.ok(walls.children.length > 15);
      shapes.push(walls.innerHTML);
      const state = {
        player: { x: -2, z: -17 },
        yaw: Math.PI / 2,
        objective: { x: 4, z: 8 },
        radius: 3,
        ally: { x: 6, z: 2 },
        allyDown: true,
      };
      f.hud.tacticalMap.update(state, 1000);
      assert.equal(
        f.hud.el("minimap-player").getAttribute("transform"),
        "translate(110.00 205.00) rotate(90.0)",
      );
      assert.equal(
        f.hud.el("minimap-ally").getAttribute("transform"),
        "translate(150.00 110.00)",
      );
      assert.equal(
        f.hud.el("minimap-objective").getAttribute("transform"),
        "translate(140.00 80.00)",
      );
      const first = f.hud.el("minimap-player").getAttribute("transform");
      f.hud.tacticalMap.update({ ...state, yaw: 0 }, 1050);
      assert.equal(f.hud.el("minimap-player").getAttribute("transform"), first);
      f.hud.tacticalMap.update({ ...state, yaw: 0 }, 1100);
      const observer = new (window as any).MutationObserver(() => {});
      observer.observe(f.hud.el("minimap"), {
        subtree: true,
        attributes: true,
        childList: true,
      });
      f.hud.tacticalMap.update({ ...state, yaw: 0 }, 1300);
      assert.equal(
        observer.takeRecords().length,
        0,
        "unchanged markers should not rewrite SVG nodes",
      );
      observer.disconnect();
      scene.dispose();
    }
    assert.equal(new Set(shapes).size, 3);
  } finally {
    engine.dispose();
    f.close();
  }
});
