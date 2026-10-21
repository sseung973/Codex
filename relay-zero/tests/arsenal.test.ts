import test from "node:test";
import assert from "node:assert/strict";
import { Wallet, catalog, starters, smg, sniper } from "../src/weapons/Arsenal";
import { Weapon } from "../src/weapons/Weapon";
import { NullEngine, Scene, Vector3, MeshBuilder } from "@babylonjs/core";
import { Player } from "../src/player/Player";
import { PlayerInput } from "../src/player/PlayerInput";
import { defaults } from "../src/core/Settings";
import { Effects } from "../src/effects/Effects";
import { Audio } from "../src/audio/Audio";
import { Target } from "../src/ai/Target";
import { meleeHit } from "../src/weapons/Melee";
import { baton } from "../src/weapons/WeaponData";
test("wallet validates purchases, rewards kills, prevents double charges and resets per run", () => {
  const wallet = new Wallet();
  assert.equal(wallet.buy("s24"), false);
  assert.equal(wallet.buy("unknown"), false);
  for (let i = 0; i < 3; i++) wallet.reward(false, false);
  assert.equal(wallet.buy("s24"), true);
  assert.equal(wallet.coins, 0);
  assert.equal(wallet.buy("s24"), true);
  assert.equal(wallet.coins, 0);
  assert.equal(wallet.reward(true, true), 175);
  wallet.reset();
  assert.equal(wallet.coins, 0);
  assert.equal(wallet.owned.size, 0);
  assert.equal(starters.length, 2);
  assert.equal(new Set(catalog.map((i) => i.data.id)).size, catalog.length);
});
test("pistol-only start locks primary, purchase equips new weapon and ownership retains ammo", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine),
    input = {
      dx: 0,
      dy: 0,
      wheel: 0,
      fire: false,
      firePressed: false,
      ads: false,
      down: () => false,
      consume: () => false,
    } as unknown as PlayerInput;
  const player = new Player(scene, input, { ...defaults }),
    w = new Weapon(
      scene,
      player,
      { play: () => {} } as unknown as Audio,
      new Effects(scene),
    );
  w.startLoadout("p6");
  assert.equal(w.data.id, "p6");
  w.switchTo(0);
  assert.equal(w.slot, 1);
  w.switchTo(2);
  assert.equal(w.melee, true);
  w.equipPrimary(smg);
  assert.equal(w.data.id, "s24");
  w.mag.ammo = 7;
  w.equipPrimary(sniper);
  assert.equal(w.data.weaponType, "sniper");
  w.equipPrimary(smg);
  assert.equal(w.mag.ammo, 7);
  w.startLoadout("p12");
  assert.equal(w.primaryOwned, false);
  assert.equal(w.data.id, "p12");
  assert.equal(w.inventory.size, 0);
  scene.dispose();
  engine.dispose();
});
test("wider melee reaches off-center targets at 3m but respects walls", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  new Target(scene, new Vector3(1.3, 0, 2.7));
  for (const m of scene.meshes) m.computeWorldMatrix(true);
  const origin = new Vector3(0, 1.65, 0);
  assert.ok(meleeHit(scene, origin, Vector3.Forward(), baton.range));
  assert.equal(baton.damage, 110);
  const wall = MeshBuilder.CreateBox(
    "wall",
    { width: 6, height: 4, depth: 0.3 },
    scene,
  );
  wall.position.set(0, 2, 1);
  wall.metadata = { world: true };
  wall.computeWorldMatrix(true);
  assert.equal(meleeHit(scene, origin, Vector3.Forward(), baton.range), null);
  scene.dispose();
  engine.dispose();
});
