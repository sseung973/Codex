// Exercise a real WebSocket service with two independent clients; no browser required.
import WebSocket from "ws";
import assert from "node:assert/strict";
const url = process.env.SMOKE_URL || "ws://127.0.0.1:3001/rooms";
const agent = process.env.SMOKE_PROXY
  ? new (
      await import(process.env.SMOKE_PROXY_AGENT_MODULE || "https-proxy-agent")
    ).HttpsProxyAgent(process.env.SMOKE_PROXY)
  : undefined;
const sockets = [];
async function connect() {
  const ws = new WebSocket(url, {
    origin: process.env.SMOKE_ORIGIN || "http://localhost:5173",
    agent,
  });
  sockets.push(ws);
  const inbox = [];
  ws.on("message", (data) => inbox.push(JSON.parse(data.toString())));
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  return { ws, inbox };
}
async function message(peer, type, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const index = peer.inbox.findIndex((m) => m.type === type);
    if (index >= 0) return peer.inbox.splice(index, 1)[0];
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for " + type);
}
const send = (p, m) => p.ws.send(JSON.stringify(m));
try {
  for (const mode of ["duel", "coop"]) {
    const host = await connect(),
      guest = await connect();
    send(host, {
      type: "create",
      mode,
      map: mode === "duel" ? "cargo" : "nexus",
    });
    const room = await message(host, "room");
    assert.match(room.code, /^[A-F0-9]{10}$/);
    send(guest, { type: "join", code: room.code });
    assert.equal((await message(guest, "joined")).role, "guest");
    send(host, { type: "ready", value: true });
    send(guest, { type: "ready", value: true });
    await message(host, "start");
    await message(guest, "start");
    send(host, { type: "loaded" });
    send(guest, { type: "loaded" });
    await message(host, "begin");
    await message(guest, "begin");
    send(guest, {
      type: "pose",
      p: [1, 0, 18],
      y: 3.14,
      pitch: 0,
      crouch: false,
    });
    assert.equal((await message(host, "pose")).from, "guest");
    send(guest, {
      type: "shot",
      o: [1, 1.65, 18],
      d: [0, 0, -1],
      weapon: "ar7",
      seq: 1,
    });
    assert.equal((await message(host, "shot")).weapon, "ar7");
    send(host, { type: "state", state: { hp: [100, 74], scores: [1, 0] } });
    assert.deepEqual((await message(guest, "state")).state.hp, [100, 74]);
    send(host, {
      type: "event",
      event: "damage",
      origin: [0, 1, 0],
      amount: 26,
    });
    assert.equal((await message(guest, "event")).amount, 26);
    send(host, { type: "leave" });
    await message(guest, "closed");
    host.ws.close();
    guest.ws.close();
    console.log(
      `${mode}: create, join, ready, begin, movement, shot, shared health, damage and disconnect PASS`,
    );
  }
} finally {
  for (const ws of sockets) ws.close();
}
