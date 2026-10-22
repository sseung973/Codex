import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { HUD } from "../src/ui/HUD";
import { OnlineArena } from "../src/multiplayer/OnlineArena";
import { defaults } from "../src/core/Settings";
test("mode/map cards, room invitations and ready controls work through the DOM", () => {
  const dom = new JSDOM('<div id="ui"></div>', {
    url: "https://relay-zero-arena.sseung973.chatgpt.site/?room=ABCDEF1234",
  });
  const globals = [
    "window",
    "document",
    "localStorage",
    "navigator",
    "location",
    "Event",
  ] as const;
  const previous = new Map(
    globals.map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const key of globals)
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      configurable: true,
      writable: true,
    });
  try {
    const hud = new HUD({ ...defaults });
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
    let map = "";
    hud.onMap = (id) => {
      map = id;
    };
    document
      .querySelector<HTMLButtonElement>('button[data-map="cargo"]')!
      .click();
    assert.equal(map, "cargo");
    assert.equal(hud.selectedMap, "cargo");
    assert.equal(
      document
        .querySelector('button[data-map="cargo"]')!
        .getAttribute("aria-pressed"),
      "true",
    );
    let mode = "";
    hud.onOnline = (id) => {
      mode = id;
    };
    document.querySelector<HTMLButtonElement>('[data-mode="coop"]')!.click();
    assert.equal(hud.el("solo-options").hidden, true);
    hud.el("play").click();
    assert.equal(mode, "coop");
    const game: any = { hud };
    const arena = new OnlineArena(game);
    assert.equal(arena.lobby.hidden, false);
    assert.equal(
      (document.getElementById("room-code-input") as HTMLInputElement).value,
      "ABCDEF1234",
    );
    const sent: any[] = [];
    arena.client.connect = (m: any) => {
      sent.push(m);
    };
    arena.client.send = (m: any) => {
      sent.push(m);
    };
    document.getElementById("join-room")!.click();
    assert.deepEqual(sent.pop(), { type: "join", code: "ABCDEF1234" });
    arena.open("coop");
    document.getElementById("create-room")!.click();
    assert.deepEqual(sent.pop(), {
      type: "create",
      mode: "coop",
      map: "cargo",
    });
    arena.client.onMessage({
      type: "room",
      mode: "coop",
      map: "cargo",
      code: "ABCDEF1234",
      players: [{ role: "host", ready: false }],
    });
    assert.equal(document.getElementById("room-connected")!.hidden, false);
    assert.match(document.getElementById("room-roster")!.textContent!, /친구/);
    document.getElementById("room-ready")!.click();
    assert.deepEqual(sent.pop(), { type: "ready", value: true });
    arena.client.onMessage({ type: "closed", message: "친구 연결 종료" });
    assert.equal(document.getElementById("room-actions")!.hidden, false);
    assert.equal(
      document.getElementById("online-status")!.textContent,
      "친구 연결 종료",
    );
    hud.el("play").click();
    assert.equal(mode, "coop");
    document.querySelector<HTMLButtonElement>('[data-mode="solo"]')!.click();
    assert.equal(hud.el("solo-options").hidden, false);
    const observer = new dom.window.MutationObserver(() => {});
    observer.observe(hud.root, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    hud.hit(false, false);
    hud.toast("test");
    hud.elimination("test");
    hud.damage(0, 10);
    hud.tick(5);
    hud.style("health-fill", "width", "100%");
    observer.takeRecords();
    for (let frame = 0; frame < 120; frame++) {
      hud.tick(1 / 60);
      hud.style("health-fill", "width", "100%");
    }
    assert.equal(
      observer.takeRecords().length,
      0,
      "idle HUD must not rewrite expired feedback each frame",
    );
    observer.disconnect();
    const allIds = [...document.querySelectorAll("[id]")].map((e) => e.id);
    assert.equal(new Set(allIds).size, allIds.length);
  } finally {
    dom.window.close();
    for (const key of globals) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as any)[key];
    }
  }
});
