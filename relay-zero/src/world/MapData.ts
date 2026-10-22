export type MapId = "foundry" | "cargo" | "nexus";
export const maps = {
  foundry: {
    name: "주조 공장",
    title: "THE FOUNDRY",
    sector: "07",
    description: "용광로 주조 시설 · 좁은 측면 통로 · 중앙 중계탑",
    clear: "#332a29",
    floor: "#66605b",
    wall: "#554845",
    accent: "#d27739",
    glow: "#ffb34e",
  },
  cargo: {
    name: "화물 터미널",
    title: "CARGO TERMINAL",
    sector: "12",
    description: "노을빛 야적장 · 컨테이너 미로 · 긴 저격 사격로",
    clear: "#b9c7ce",
    floor: "#767d80",
    wall: "#536779",
    accent: "#427e8b",
    glow: "#ffcf7b",
  },
  nexus: {
    name: "넥서스 연구소",
    title: "NEXUS LAB",
    sector: "03",
    description: "백색 연구 시설 · 청록 코어 · 비대칭 실험 구역",
    clear: "#859da7",
    floor: "#b2bfc3",
    wall: "#c6d4d6",
    accent: "#3b7d8a",
    glow: "#8affdf",
  },
} as const;
export function loadMap(): MapId {
  try {
    const v = localStorage.getItem("relay-zero-map");
    return v && Object.hasOwn(maps, v) ? (v as MapId) : "foundry";
  } catch {
    return "foundry";
  }
}
export function saveMap(id: MapId): void {
  try {
    localStorage.setItem("relay-zero-map", id);
  } catch {
    /* Storage is optional. */
  }
}
