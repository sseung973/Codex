import test from "node:test";
import assert from "node:assert/strict";
import { DamageFeedback } from "../src/ui/DamageFeedback";
import { HUD } from "../src/ui/HUD";
import { Game } from "../src/core/Game";
import { Health } from "../src/combat/Damage";
import { Vector3 } from "@babylonjs/core";
import { RunStats } from "../src/core/RunStats";

test("real hits immediately show a bounded pulse, direction and actual damage; misses never activate it", () => {
  const feedback = new DamageFeedback();
  for (const amount of [0, -1, NaN, Infinity])
    assert.equal(feedback.trigger(0, amount), false);
  assert.equal(feedback.opacity, 0);
  assert.equal(feedback.trigger(Math.PI / 2, 12), true);
  assert.equal(feedback.angle, Math.PI / 2);
  assert.equal(feedback.amount, 12);
  assert.ok(feedback.opacity >= 0.5 && feedback.opacity <= 0.8);
  const immediate = feedback.opacity;
  feedback.update(0.4);
  assert.ok(feedback.opacity < immediate && feedback.opacity > 0);
  feedback.update(0.5);
  assert.equal(feedback.opacity, 0);
  assert.equal(feedback.labelOpacity, 0);
});

test("burst hits accumulate HP loss and refresh the cue; later hits start a new number", () => {
  const feedback = new DamageFeedback();
  feedback.trigger(0, 8);
  feedback.update(0.1);
  feedback.trigger(Math.PI, 6);
  assert.equal(feedback.amount, 14);
  assert.equal(feedback.angle, Math.PI);
  feedback.update(0.5);
  feedback.trigger(-Math.PI / 2, 5);
  assert.equal(feedback.amount, 5);
  for (let i = 0; i < 100; i++) feedback.trigger(0, 10);
  assert.ok(feedback.opacity <= 0.8);
  const before = feedback.remaining;
  feedback.update(0);
  assert.equal(feedback.remaining, before, "pause preserves the cue");
  feedback.update(10);
  assert.equal(feedback.remaining, 0);
  assert.equal(feedback.amount, 0);
});

test("HUD immediately paints the damage label and border, fades all cues and clears on restart", () => {
  const nodes = new Map<string, any>();
  const element = (id: string) => {
    if (!nodes.has(id))
      nodes.set(id, {
        style: {},
        textContent: "",
        classList: { toggle: () => {} },
      });
    return nodes.get(id);
  };
  const hud = Object.create(HUD.prototype) as HUD;
  Object.assign(hud, {
    damageFeedback: new DamageFeedback(),
    cache: new Map(),
    el: element,
    hitTime: 0,
    toastTime: 0,
    killTime: 0,
  });
  hud.damage(Math.PI / 2, 17);
  assert.equal(element("damage-label").textContent, "피격 −17");
  assert.equal(element("damage-label").style.opacity, "1");
  assert.ok(Number(element("damage-flash").style.opacity) > 0.5);
  assert.ok(
    element("damage-arrow").style.transform.includes(String(Math.PI / 2)),
  );
  hud.tick(0.9);
  assert.equal(element("damage-label").style.opacity, "0");
  assert.equal(element("damage-flash").style.opacity, "0");
  hud.damage(0, 3);
  hud.damageTime = 0;
  hud.tick(0);
  assert.equal(element("damage-arrow").style.opacity, "0");
  assert.equal(element("damage-label").style.opacity, "0");
});

test("explosive damage reports actual HP lost rather than overkill damage, from the correct direction", () => {
  const player = new Health("player", 100) as Health & {
    feet: Vector3;
    camera: { position: Vector3 };
    yaw: number;
  };
  player.health = 9;
  player.feet = Vector3.Zero();
  player.camera = { position: new Vector3(0, 1.65, 0) };
  player.yaw = 0;
  const hits: { angle: number; amount: number }[] = [];
  const game = Object.create(Game.prototype) as any;
  Object.assign(game, {
    player,
    finished: false,
    resolvingBlast: true,
    stats: new RunStats(),
    hud: {
      damage: (angle: number, amount: number) => hits.push({ angle, amount }),
    },
  });
  game.hurtPlayer(40, new Vector3(5, 0, 0));
  assert.equal(hits.length, 1);
  assert.equal(hits[0].amount, 9);
  assert.equal(hits[0].angle, Math.PI / 2);
  game.hurtPlayer(20, new Vector3(5, 0, 0));
  assert.equal(hits.length, 1, "a dead player receives no new cue");
});
