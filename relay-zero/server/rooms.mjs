import { randomBytes } from "node:crypto";
const MODES = new Set(["duel", "coop"]);
const MAPS = new Set(["foundry", "cargo", "nexus"]);
const finite = (n, limit = 1000) =>
  typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= limit;
const vector = (v) =>
  Array.isArray(v) && v.length === 3 && v.every((n) => finite(n, 150));
export function validPose(p) {
  return (
    p &&
    vector(p.p) &&
    Math.abs(p.p[0]) <= 21 &&
    Math.abs(p.p[2]) <= 21 &&
    p.p[1] >= -2 &&
    p.p[1] < 15 &&
    finite(p.y) &&
    finite(p.pitch) &&
    typeof p.crouch === "boolean"
  );
}
export class Rooms {
  rooms = new Map();
  peers = new Set();
  constructor(send = (peer, message) => peer.send(JSON.stringify(message))) {
    this.send = send;
  }
  connect(socket) {
    const peer = {
      socket,
      room: null,
      role: "",
      ready: false,
      loaded: false,
      clock: 0,
      count: 0,
    };
    this.peers.add(peer);
    return peer;
  }
  emit(p, m) {
    this.send(p.socket, m);
  }
  broadcast(r, m) {
    for (const p of r.players) this.emit(p, m);
  }
  roster(r) {
    this.broadcast(r, {
      type: "room",
      code: r.code,
      mode: r.mode,
      map: r.map,
      players: r.players.map((p) => ({ role: p.role, ready: p.ready })),
    });
  }
  receive(p, m, now = Date.now()) {
    if (!this.peers.has(p) || !m || typeof m !== "object") return;
    if (now - p.clock >= 1000) {
      p.clock = now;
      p.count = 0;
    }
    if (++p.count > 120) return;
    if (m.type === "ping") {
      this.emit(p, { type: "pong", time: m.time });
      return;
    }
    if (m.type === "create" && !p.room) {
      if (!MODES.has(m.mode) || !MAPS.has(m.map))
        return this.error(p, "게임 설정이 올바르지 않아.");
      if (this.rooms.size >= 100)
        return this.error(p, "서버가 가득 찼어. 잠시 후 다시 시도해줘.");
      let code;
      do {
        code = randomBytes(5).toString("hex").toUpperCase();
      } while (this.rooms.has(code));
      const r = {
        code,
        mode: m.mode,
        map: m.map,
        players: [p],
        active: false,
        begun: false,
        updated: now,
      };
      p.role = "host";
      p.room = r;
      this.rooms.set(code, r);
      this.emit(p, { type: "joined", role: p.role });
      this.roster(r);
      return;
    }
    if (m.type === "join" && !p.room) {
      const r = this.rooms.get(String(m.code).trim().toUpperCase());
      if (!r || r.players.length >= 2 || r.active)
        return this.error(p, "방을 찾을 수 없거나 이미 가득 찼어.");
      p.role = "guest";
      p.room = r;
      r.players.push(p);
      r.updated = now;
      this.emit(p, { type: "joined", role: p.role });
      this.roster(r);
      return;
    }
    const r = p.room;
    if (!r) return;
    r.updated = now;
    if (m.type === "ready" && !r.active) {
      p.ready = m.value === true;
      this.roster(r);
      if (r.players.length === 2 && r.players.every((q) => q.ready)) {
        r.active = true;
        r.begun = false;
        for (const q of r.players) q.loaded = false;
        this.broadcast(r, { type: "start", mode: r.mode, map: r.map });
      }
      return;
    }
    if (m.type === "loaded" && r.active && !r.begun) {
      p.loaded = true;
      if (r.players.every((q) => q.loaded)) {
        r.begun = true;
        this.broadcast(r, { type: "begin" });
      }
      return;
    }
    if (m.type === "leave") {
      this.disconnect(p);
      return;
    }
    if (!r.begun) return;
    let valid = false;
    if (m.type === "pose") valid = validPose(m);
    if (m.type === "shot")
      valid =
        vector(m.o) &&
        vector(m.d) &&
        ["ar7", "p12", "arc"].includes(m.weapon) &&
        finite(m.seq, 1e9) &&
        Number.isInteger(m.seq);
    if (p.role === "host" && m.type === "state")
      valid = typeof m.state === "object" && m.state !== null;
    if (p.role === "host" && m.type === "event")
      valid = ["hit", "damage", "tracer", "end", "respawn"].includes(m.event);
    if (valid)
      for (const q of r.players)
        if (q !== p) this.emit(q, { ...m, from: p.role });
  }
  error(p, message) {
    this.emit(p, { type: "error", message });
  }
  disconnect(p) {
    this.peers.delete(p);
    const r = p.room;
    p.room = null;
    if (!r) return;
    this.rooms.delete(r.code);
    for (const q of r.players)
      if (q !== p) {
        q.room = null;
        q.ready = q.loaded = false;
        this.emit(q, {
          type: "closed",
          message: "친구가 방을 나갔어. 새 방에서 다시 만날 수 있어.",
        });
      }
  }
  sweep(now = Date.now()) {
    for (const r of this.rooms.values())
      if (now - r.updated > 30 * 60 * 1000)
        for (const p of r.players) {
          this.emit(p, {
            type: "closed",
            message: "방의 대기 시간이 만료됐어.",
          });
          this.disconnect(p);
        }
  }
}
