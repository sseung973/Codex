export type DifficultyId = "easy" | "normal" | "hard" | "nightmare";
export interface Difficulty {
  id: DifficultyId;
  label: string;
  description: string;
  waves: readonly number[];
  health: number;
  damage: number;
  accuracy: number;
  reaction: number;
  speed: number;
  fireRate: number;
  burstPause: number;
  extraBurst: number;
  eliteFrom: number;
  eliteCount: number;
  recovery: number;
  resupplyMagazines: number;
  rest: number;
  scoreMultiplier: number;
}
export const difficulties: Record<DifficultyId, Difficulty> = {
  easy: {
    id: "easy",
    label: "쉬움",
    description: "여유 있는 전투 · 웨이브마다 체력 +40",
    waves: [3, 5, 7, 9, 11],
    health: 0.9,
    damage: 0.85,
    accuracy: 0.85,
    reaction: 1.2,
    speed: 0.9,
    fireRate: 0.9,
    burstPause: 1.3,
    extraBurst: 0,
    eliteFrom: 5,
    eliteCount: 1,
    recovery: 40,
    resupplyMagazines: 3,
    rest: 10,
    scoreMultiplier: 1,
  },
  normal: {
    id: "normal",
    label: "보통",
    description: "기존보다 빠르고 정확한 적 · 체력 +25",
    waves: [4, 6, 8, 10, 12],
    health: 1,
    damage: 1.3,
    accuracy: 1.25,
    reaction: 0.8,
    speed: 1.12,
    fireRate: 1.15,
    burstPause: 0.9,
    extraBurst: 0,
    eliteFrom: 4,
    eliteCount: 1,
    recovery: 25,
    resupplyMagazines: 3,
    rest: 8,
    scoreMultiplier: 1.25,
  },
  hard: {
    id: "hard",
    label: "어려움",
    description: "빠른 반응과 집중 공격 · 체력 +10",
    waves: [5, 7, 10, 13, 15],
    health: 1.08,
    damage: 1.65,
    accuracy: 1.6,
    reaction: 0.6,
    speed: 1.25,
    fireRate: 1.4,
    burstPause: 0.65,
    extraBurst: 1,
    eliteFrom: 3,
    eliteCount: 2,
    recovery: 10,
    resupplyMagazines: 2,
    rest: 6,
    scoreMultiplier: 1.75,
  },
  nightmare: {
    id: "nightmare",
    label: "악몽",
    description: "최대 18기 · 체력 회복 없음 · 보급 제한",
    waves: [6, 9, 12, 15, 18],
    health: 1.15,
    damage: 2,
    accuracy: 1.9,
    reaction: 0.45,
    speed: 1.4,
    fireRate: 1.65,
    burstPause: 0.45,
    extraBurst: 2,
    eliteFrom: 2,
    eliteCount: 3,
    recovery: 0,
    resupplyMagazines: 1,
    rest: 4,
    scoreMultiplier: 2.5,
  },
};
export function loadDifficulty(): DifficultyId {
  try {
    const id = localStorage.getItem("relay-zero-difficulty");
    return id && Object.hasOwn(difficulties, id)
      ? (id as DifficultyId)
      : "normal";
  } catch {
    return "normal";
  }
}
export function saveDifficulty(id: DifficultyId): void {
  try {
    localStorage.setItem("relay-zero-difficulty", id);
  } catch {
    /* Device storage may be unavailable. */
  }
}
