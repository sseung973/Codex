import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../Assets/RelayZero/Plugins/WebGL/RelayRoomSocket.jslib", import.meta.url), "utf8");

function bridge() {
  const sockets = [], timers = new Map(), memory = new Map();
  let serial = 1;
  class Socket {
    constructor(url) { this.url = url; this.readyState = 0; this.sent = []; sockets.push(this); }
    send(value) { if (this.readyState !== 1) throw Error("Not open"); this.sent.push(value); }
    close() { this.readyState = 3; this.onclose?.(); }
    open() { this.readyState = 1; this.onopen?.(); }
    receive(value) { this.onmessage?.({ data: value }); }
  }
  const context = vm.createContext({
    LibraryManager: { library: {} }, mergeInto: Object.assign,
    WebSocket: Socket, UTF8ToString: String,
    lengthBytesUTF8: value => Buffer.byteLength(value, "utf8"),
    stringToUTF8: (value, pointer, capacity) => { assert(Buffer.byteLength(value) + 1 <= capacity); memory.set(pointer, value); },
    setTimeout: (callback, delay) => { const id = serial++; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id)
  });
  vm.runInContext(source, context);
  const api = context.LibraryManager.library;
  context.RelayRoomSockets = api.$RelayRoomSockets;
  function poll(id) {
    const size = api.RelaySocketSize(id);
    if (!size) return null;
    assert.equal(api.RelaySocketRead(id, 1, size - 1), 0, "short buffer must retain its packet");
    const count = api.RelaySocketRead(id, 1, size);
    assert.equal(count, size - 1);
    return JSON.parse(memory.get(1));
  }
  return { api, sockets, timers, poll };
}

test("Web transport sends create/join only after open, preserves Unicode and close lifecycle", () => {
  const { api, sockets, timers, poll } = bridge();
  const id = api.RelaySocketOpen("wss://example.test/rooms", '{"type":"create"}');
  assert.equal(api.RelaySocketState(id), 0);
  assert.equal(sockets[0].sent.length, 0);
  sockets[0].open();
  assert.equal(timers.size, 0);
  assert.equal(api.RelaySocketState(id), 1);
  assert.equal(sockets[0].sent[0], '{"type":"create"}');
  sockets[0].receive(JSON.stringify({ type: "error", message: "친구와 협동 · ✓" }));
  assert.equal(poll(id).message, "친구와 협동 · ✓");
  api.RelaySocketSend(id, '{"type":"ready","value":true}');
  assert.equal(sockets[0].sent.length, 2);
  api.RelaySocketClose(id);
  assert.equal(api.RelaySocketState(id), 0);
  assert.equal(api.RelaySocketSize(id), 0);
  assert.equal(sockets[0].readyState, 3);
});

test("Closed sockets and late callbacks cannot contaminate another room", () => {
  const { api, sockets, poll } = bridge();
  const old = api.RelaySocketOpen("wss://example.test/rooms", "create");
  const callback = sockets[0].onmessage;
  const lateError = sockets[0].onerror;
  api.RelaySocketClose(old);
  const next = api.RelaySocketOpen("wss://example.test/rooms", "join");
  callback({ data: '{"type":"state"}' });
  lateError();
  assert.equal(poll(old), null);
  assert.equal(poll(next), null);
  sockets[1].open();
  assert.equal(sockets[1].sent[0], "join");
  sockets[1].onerror();
  sockets[1].onclose();
  assert.equal(poll(next).type, "closed");
  assert.equal(poll(next), null, "only one terminal failure is emitted");
});

test("A final result received before close is delivered before the close event", () => {
  const { api, sockets, poll } = bridge();
  const id = api.RelaySocketOpen("wss://example.test/rooms", "create");
  sockets[0].open();
  sockets[0].receive('{"type":"event","event":"end","won":true}');
  sockets[0].close();
  assert.equal(poll(id).event, "end");
  assert.equal(poll(id).type, "closed");
  assert.equal(poll(id), null);
});

test("Every WebGL native import has an exported JavaScript entry point", () => {
  const { api } = bridge();
  const csharp = readFileSync(new URL("../Assets/RelayZero/Scripts/RoomSocket.Web.cs", import.meta.url), "utf8");
  const imports = [...csharp.matchAll(/extern\s+\w+\s+(RelaySocket\w+)\(/g)].map(match => match[1]);
  assert.equal(imports.length, 6);
  for (const name of imports) assert.equal(typeof api[name], "function", name);
});

test("Cold server timeout, invalid URLs, binary packets and queue limits produce bounded failures", () => {
  for (const mode of ["timeout", "url", "binary", "queue", "size"]) {
    const { api, sockets, timers, poll } = bridge();
    const id = api.RelaySocketOpen(mode === "url" ? "https://example.test" : "wss://example.test/rooms", "create");
    if (mode === "timeout") {
      const timer = [...timers.values()][0];
      assert.equal(timer.delay, 75000);
      timer.callback();
    } else if (mode !== "url") {
      sockets[0].open();
      if (mode === "binary") sockets[0].receive(new Uint8Array(2));
      if (mode === "queue") for (let n = 0; n < 129; n++) sockets[0].receive('{}');
      if (mode === "size") sockets[0].receive("가".repeat(90000));
    }
    assert.equal(api.RelaySocketState(id), 0, mode);
    assert.equal(poll(id).type, "closed", mode);
    assert.equal(poll(id), null, mode);
    api.RelaySocketClose(id);
    assert.equal(timers.size, 0, mode);
  }
});
