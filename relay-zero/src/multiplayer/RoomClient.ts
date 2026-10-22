import type { MapId } from "../world/MapData";
export type OnlineMode = "duel" | "coop";
export type Role = "host" | "guest";
export class RoomClient {
  socket?: WebSocket;
  role: Role = "host";
  code = "";
  mode: OnlineMode = "duel";
  map: MapId = "foundry";
  ping = 0;
  onMessage: (message: any) => void = () => {};
  onStatus: (message: string) => void = () => {};
  private heartbeat?: ReturnType<typeof setInterval>;
  private timeout?: ReturnType<typeof setTimeout>;
  private generation = 0;
  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
  connect(
    action:
      | { type: "create"; mode: OnlineMode; map: MapId }
      | { type: "join"; code: string },
  ): void {
    this.close();
    const generation = ++this.generation;
    const url =
      import.meta.env.VITE_ROOMS_URL ||
      "wss://relay-zero-rooms.onrender.com/rooms";
    if (!url) {
      this.onStatus(
        "온라인 서버가 아직 준비되지 않았어. 잠시 후 다시 시도해줘.",
      );
      return;
    }
    this.onStatus("서버에 연결 중… 처음 연결은 1분 정도 걸릴 수 있어.");
    const ws = (this.socket = new WebSocket(url));
    this.timeout = setTimeout(() => {
      if (generation === this.generation) {
        this.close();
        this.onStatus("서버 응답이 늦어지고 있어. 다시 연결해줘.");
      }
    }, 75000);
    ws.onopen = () => {
      if (generation !== this.generation) return;
      clearTimeout(this.timeout);
      this.send(action);
      this.heartbeat = setInterval(
        () => this.send({ type: "ping", time: Date.now() }),
        5000,
      );
    };
    ws.onmessage = ({ data }) => {
      if (generation !== this.generation) return;
      try {
        const m = JSON.parse(data);
        if (m.type === "pong") {
          this.ping = Math.max(0, Date.now() - m.time);
          return;
        }
        if (m.type === "joined") this.role = m.role;
        if (m.type === "room") {
          this.code = m.code;
          this.mode = m.mode;
          this.map = m.map;
        }
        if (m.type === "error") this.onStatus(m.message);
        this.onMessage(m);
      } catch {
        this.onStatus("서버 응답을 읽을 수 없어. 다시 접속해줘.");
      }
    };
    ws.onclose = () => {
      if (generation !== this.generation) return;
      clearInterval(this.heartbeat);
      clearTimeout(this.timeout);
      this.onStatus("서버 연결이 끊겼어. 방에 다시 접속해줘.");
      this.onMessage({ type: "closed", message: "서버 연결이 끊겼어." });
    };
    ws.onerror = () =>
      this.onStatus("온라인 서버에 연결하지 못했어. 잠시 후 다시 시도해줘.");
  }
  send(message: object): void {
    if (this.connected && this.socket!.bufferedAmount < 262144)
      this.socket!.send(JSON.stringify(message));
  }
  close(): void {
    ++this.generation;
    clearInterval(this.heartbeat);
    clearTimeout(this.timeout);
    if (this.connected) this.send({ type: "leave" });
    this.socket?.close();
    this.socket = undefined;
    this.code = "";
  }
}
