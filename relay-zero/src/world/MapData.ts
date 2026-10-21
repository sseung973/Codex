export type MapId = "foundry" | "cargo" | "nexus";
export const maps = {
  foundry: {
    name: "주조 공장",
    title: "THE FOUNDRY",
    sector: "07",
    description: "중앙 중계탑 · 양쪽 복도 · 경사로",
    clear: "#253441",
    floor: "#737e87",
    wall: "#566673",
    accent: "#edac58",
    glow: "#8fc3df",
  },
  cargo: {
    name: "화물 터미널",
    title: "CARGO TERMINAL",
    sector: "12",
    description: "엇갈린 컨테이너 · 넓은 측면 우회로",
    clear: "#253441",
    floor: "#737e87",
    wall: "#566673",
    accent: "#edac58",
    glow: "#8fc3df",
  },
  nexus: {
    name: "넥서스 연구소",
    title: "NEXUS LAB",
    sector: "03",
    description: "네 개의 실험 구역 · 중앙 코어 · 교차 사격로",
    clear: "#253441",
    floor: "#737e87",
    wall: "#566673",
    accent: "#edac58",
    glow: "#8fc3df",
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
