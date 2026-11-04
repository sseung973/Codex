mergeInto(LibraryManager.library, {
  $RelayRoomSockets__deps: ["$lengthBytesUTF8"],
  $RelayRoomSockets: {
    next: 1,
    entries: {},
    fail: function (id, message, discard) {
      var entry = RelayRoomSockets.entries[id];
      if (!entry || entry.terminal) return;
      entry.terminal = true;
      clearTimeout(entry.timer);
      if (discard) entry.queue.length = 0;
      if (entry.queue.length >= 128) entry.queue.shift();
      var text = JSON.stringify({ type: "closed", message: message });
      entry.queue.push({ text: text, size: lengthBytesUTF8(text) + 1 });
      if (entry.socket) {
        try { entry.socket.close(); } catch (_) {}
      }
    }
  },

  RelaySocketOpen__deps: ["$RelayRoomSockets", "$UTF8ToString", "$lengthBytesUTF8"],
  RelaySocketOpen: function (urlPointer, actionPointer) {
    var url = UTF8ToString(urlPointer), action = UTF8ToString(actionPointer);
    var id = RelayRoomSockets.next++;
    var entry = { socket: null, queue: [], terminal: false, timer: null };
    RelayRoomSockets.entries[id] = entry;
    try {
      if (!/^wss?:\/\//i.test(url)) throw new Error("WebSocket URL must use ws or wss");
      var socket = new WebSocket(url);
      entry.socket = socket;
      entry.timer = setTimeout(function () {
        RelayRoomSockets.fail(id, "Render connection timed out. Try again.");
      }, 75000);
      socket.onopen = function () {
        if (RelayRoomSockets.entries[id] !== entry || entry.terminal) return;
        clearTimeout(entry.timer);
        try { socket.send(action); }
        catch (_) { RelayRoomSockets.fail(id, "Unable to enter room."); }
      };
      socket.onmessage = function (event) {
        if (RelayRoomSockets.entries[id] !== entry || entry.terminal) return;
        if (typeof event.data !== "string") {
          RelayRoomSockets.fail(id, "Unsupported room packet.");
          return;
        }
        var size = lengthBytesUTF8(event.data) + 1;
        if (size > 262145 || entry.queue.length >= 128) {
          RelayRoomSockets.fail(id, "Room receive limit exceeded.", true);
          return;
        }
        entry.queue.push({ text: event.data, size: size });
      };
      socket.onerror = function () {
        RelayRoomSockets.fail(id, "Unable to connect to the room server.");
      };
      socket.onclose = function () {
        RelayRoomSockets.fail(id, "Room server connection closed.");
      };
    } catch (error) {
      RelayRoomSockets.fail(id, String(error.message || error));
    }
    return id;
  },

  RelaySocketState__deps: ["$RelayRoomSockets"],
  RelaySocketState: function (id) {
    var entry = RelayRoomSockets.entries[id];
    return entry && !entry.terminal && entry.socket && entry.socket.readyState === 1 ? 1 : 0;
  },

  RelaySocketSize__deps: ["$RelayRoomSockets"],
  RelaySocketSize: function (id) {
    var entry = RelayRoomSockets.entries[id];
    return entry && entry.queue.length ? entry.queue[0].size : 0;
  },

  RelaySocketRead__deps: ["$RelayRoomSockets", "$stringToUTF8"],
  RelaySocketRead: function (id, buffer, capacity) {
    var entry = RelayRoomSockets.entries[id];
    if (!entry || !entry.queue.length || entry.queue[0].size > capacity) return 0;
    var item = entry.queue.shift();
    stringToUTF8(item.text, buffer, capacity);
    return item.size - 1;
  },

  RelaySocketSend__deps: ["$RelayRoomSockets", "$UTF8ToString", "$lengthBytesUTF8"],
  RelaySocketSend: function (id, pointer) {
    var entry = RelayRoomSockets.entries[id];
    if (!entry || entry.terminal || !entry.socket || entry.socket.readyState !== 1) return;
    var json = UTF8ToString(pointer);
    if (lengthBytesUTF8(json) > 262144) return;
    try { entry.socket.send(json); }
    catch (_) { RelayRoomSockets.fail(id, "Unable to send room packet."); }
  },

  RelaySocketClose__deps: ["$RelayRoomSockets"],
  RelaySocketClose: function (id) {
    var entry = RelayRoomSockets.entries[id];
    if (!entry) return;
    delete RelayRoomSockets.entries[id];
    clearTimeout(entry.timer);
    if (entry.socket) {
      entry.socket.onopen = entry.socket.onmessage = entry.socket.onerror = entry.socket.onclose = null;
      try { entry.socket.close(); } catch (_) {}
    }
    entry.queue.length = 0;
  }
});
