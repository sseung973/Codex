import test from "node:test";
import assert from "node:assert/strict";
import {
  NullEngine,
  Scene,
  MeshBuilder,
  Vector3,
  Ray,
  VertexBuffer,
} from "@babylonjs/core";
import { JSDOM } from "jsdom";
import { softenActor } from "../src/visual/SoftMesh";
import { Level } from "../src/world/Level";
import { Navigation } from "../src/ai/Navigation";
import { practiceSpawns } from "../src/world/PracticeSpawns";
import { Target } from "../src/ai/Target";
import { difficulties } from "../src/core/Difficulty";
import { HUD } from "../src/ui/HUD";
import { defaults } from "../src/core/Settings";
import { Weapon } from "../src/weapons/Weapon";
import { Player } from "../src/player/Player";
import { Effects } from "../src/effects/Effects";
import { smg } from "../src/weapons/Arsenal";

class GeometryLevel extends Level {
  override sign(): void {}
}

test("Unity bevels round only rendered corners, retain precise hits and share GPU geometry", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  try {
    const source = MeshBuilder.CreateBox("original hit box", {}, scene);
    const original = Array.from(
      source.getVerticesData(VertexBuffer.PositionKind)!,
    );
    const visual = softenActor(source, 0.06)!;
    assert.equal(source.isVisible, false);
    assert.equal(visual.isPickable, false);
    assert.equal(visual.checkCollisions, false);
    assert.deepEqual(
      Array.from(source.getVerticesData(VertexBuffer.PositionKind)!),
      original,
    );
    assert.ok(visual.getTotalVertices() > source.getTotalVertices());
    const second = MeshBuilder.CreateBox("another hit box", {}, scene);
    const other = softenActor(second, 0.06)!;
    assert.equal(
      other.geometry,
      visual.geometry,
      "instances reuse the rounded GPU buffers",
    );
    const positions = visual.getVerticesData(VertexBuffer.PositionKind)!,
      normals = visual.getVerticesData(VertexBuffer.NormalKind)!,
      indices = visual.getIndices()!;
    assert.ok(positions.every(Number.isFinite));
    for (let a = 0; a < 3; a++) {
      const axis = positions.filter((_, i) => i % 3 === a);
      assert.ok(Math.abs(Math.min(...axis) + 0.5) < 1e-5);
      assert.ok(Math.abs(Math.max(...axis) - 0.5) < 1e-5);
    }
    for (let i = 0; i < normals.length; i += 3)
      assert.ok(Math.abs(Vector3.FromArray(normals, i).length() - 1) < 1e-5);
    for (let i = 0; i < indices.length; i += 3) {
      const a = Vector3.FromArray(positions, indices[i] * 3),
        b = Vector3.FromArray(positions, indices[i + 1] * 3),
        c = Vector3.FromArray(positions, indices[i + 2] * 3);
      const face = Vector3.Cross(b.subtract(a), c.subtract(a));
      assert.ok(face.lengthSquared() > 1e-12);
      assert.ok(
        Vector3.Dot(face, Vector3.FromArray(normals, indices[i] * 3)) < 0,
        "Babylon front-face winding is retained",
      );
    }
    source.computeWorldMatrix(true);
    visual.computeWorldMatrix(true);
    const ray = new Ray(new Vector3(0.49, 0.49, -2), Vector3.Forward(), 5);
    assert.equal(
      scene.pickWithRay(ray, (m) => m === source)?.hit,
      true,
      "original hit bounds include the corner",
    );
    assert.equal(
      scene.pickWithRay(ray, (m) => m === visual)?.hit,
      false,
      "rendered corner is genuinely rounded",
    );
    source.dispose();
    second.dispose();
    assert.equal(scene.meshes.length, 0);
  } finally {
    scene.dispose();
    engine.dispose();
  }
});

for (const map of ["foundry", "cargo", "nexus"] as const)
  test(`${map}: Unity-style practice robots use unobstructed reachable cells`, () => {
    const engine = new NullEngine(),
      scene = new Scene(engine),
      level = new GeometryLevel(scene, map),
      nav = new Navigation(level);
    try {
      const positions = practiceSpawns(nav, level.spawn);
      assert.equal(positions.length, 3);
      for (const p of positions) {
        const [x, z] = nav.cellOf(p);
        assert.equal(nav.blocked.has(z * nav.size + x), false);
        assert.ok(nav.route(level.spawn, p).length > 0);
        assert.ok(Vector3.DistanceSquared(p, level.spawn) >= 64);
        const target = new Target(scene, p, level, nav, difficulties.normal);
        assert.ok(
          target.meshes.length > 2,
          "full robot replaces the old two-box dummy",
        );
        assert.equal(target.maxHealth, 85);
        assert.ok(target.meshes.some((m) => m.metadata?.head));
        assert.ok(target.meshes.every((m) => m.metadata?.entity === target));
        target.dispose();
      }
    } finally {
      level.dispose();
      scene.dispose();
      engine.dispose();
    }
  });

test("Unity menu selections, direct friend buttons and canvas scale use real state", () => {
  const dom = new JSDOM('<div id="ui"></div>', {
    url: "https://relay-zero-arena.sseung973.chatgpt.site/",
  });
  const keys = [
    "window",
    "document",
    "navigator",
    "localStorage",
    "location",
    "Event",
  ] as const;
  const old = new Map(
    keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]),
  );
  for (const k of keys)
    Object.defineProperty(globalThis, k, {
      value: (dom.window as any)[k],
      configurable: true,
      writable: true,
    });
  try {
    const hud = new HUD({ ...defaults });
    assert.ok(document.querySelector("#menu.unity-menu .unity-intro"));
    assert.ok(document.querySelector(".unity-setup"));
    (document.querySelector('[data-difficulty="hard"]') as HTMLElement).click();
    assert.equal(hud.selectedDifficulty, "hard");
    assert.equal(
      document
        .querySelector('[data-difficulty="hard"]')
        ?.getAttribute("aria-pressed"),
      "true",
    );
    (document.querySelector('[data-pistol="p6"]') as HTMLElement).click();
    assert.equal(hud.selectedPistol, "p6");
    assert.match(hud.el("unity-selection").textContent!, /P6/);
    const modes: string[] = [];
    hud.onOnline = (mode) => modes.push(mode);
    hud.el("unity-duel").click();
    hud.el("unity-coop").click();
    assert.deepEqual(modes, ["duel", "coop"]);
    Object.defineProperty(window, "innerWidth", {
      value: 1920,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 1080,
      configurable: true,
    });
    window.dispatchEvent(new Event("resize"));
    assert.equal(hud.root.style.getPropertyValue("--unity-ui-scale"), "1.5");
  } finally {
    dom.window.close();
    for (const k of keys) {
      const d = old.get(k);
      if (d) Object.defineProperty(globalThis, k, d);
      else delete (globalThis as any)[k];
    }
  }
});

test("Replacing an equipped primary cancels the outgoing reload and preserves ammunition", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  try {
    const player = new Player(
      scene,
      { dx: 0, dy: 0, down: () => false, consume: () => false } as any,
      { ...defaults },
    );
    const weapon = new Weapon(
      scene,
      player,
      { play() {} } as any,
      new Effects(scene),
    );
    weapon.startLoadout("p12", true);
    const old = weapon.mag;
    old.ammo = 8;
    old.reload();
    weapon.equipPrimary(smg);
    assert.equal(old.reloadRemaining, 0);
    assert.equal(old.ammo, 8);
    assert.equal(weapon.inventory.get(old.data.id), old);
  } finally {
    scene.dispose();
    engine.dispose();
  }
});
