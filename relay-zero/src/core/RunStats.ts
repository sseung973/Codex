import type { MapId } from "../world/MapData";
import type { DifficultyId } from "./Difficulty";
export class RunStats {
  shots = 0;
  hits = 0;
  heads = 0;
  blocked = 0;
  damage = 0;
  get accuracy(): number {
    return this.shots ? (this.hits / this.shots) * 100 : 0;
  }
  get headRatio(): number {
    return this.hits ? (this.heads / this.hits) * 100 : 0;
  }
}
export interface PersonalBest {
  score: number;
  clearTime: number | null;
}
type StoragePort = Pick<Storage, "getItem" | "setItem">;
export class Records {
  constructor(private storage: () => StoragePort = () => localStorage) {}
  key(map: MapId, difficulty: DifficultyId): string {
    return `relay-records-v4:${map}:${difficulty}`;
  }
  get(map: MapId, difficulty: DifficultyId): PersonalBest {
    try {
      const value: unknown = JSON.parse(
        this.storage().getItem(this.key(map, difficulty)) || "null",
      );
      if (
        value &&
        typeof value === "object" &&
        "score" in value &&
        "clearTime" in value &&
        typeof value.score === "number" &&
        Number.isFinite(value.score) &&
        value.score >= 0 &&
        (value.clearTime === null ||
          (typeof value.clearTime === "number" &&
            Number.isFinite(value.clearTime) &&
            value.clearTime >= 0))
      )
        return { score: value.score, clearTime: value.clearTime };
    } catch {
      /* Storage may be disabled. */
    }
    return { score: 0, clearTime: null };
  }
  save(
    map: MapId,
    difficulty: DifficultyId,
    score: number,
    time: number,
    victory: boolean,
  ): {
    best: PersonalBest;
    saved: boolean;
    newScore: boolean;
    newTime: boolean;
  } {
    const old = this.get(map, difficulty);
    const newScore = score > old.score;
    const newTime = victory && (old.clearTime === null || time < old.clearTime);
    const best = {
      score: Math.max(old.score, score),
      clearTime: newTime ? time : old.clearTime,
    };
    try {
      this.storage().setItem(this.key(map, difficulty), JSON.stringify(best));
      return { best, saved: true, newScore, newTime };
    } catch {
      return { best, saved: false, newScore, newTime };
    }
  }
}
export const clock = (time: number): string =>
  `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;

export class EndlessRecords {
  constructor(private storage: () => StoragePort = () => localStorage) {}
  key(map: MapId, difficulty: DifficultyId): string {
    return `relay-endless-v1:${map}:${difficulty}`;
  }
  get(map: MapId, difficulty: DifficultyId): { score: number; wave: number } {
    try {
      const v = JSON.parse(
        this.storage().getItem(this.key(map, difficulty)) || "null",
      );
      if (
        v &&
        Number.isFinite(v.score) &&
        v.score >= 0 &&
        Number.isInteger(v.wave) &&
        v.wave >= 6
      )
        return { score: v.score, wave: v.wave };
    } catch {
      /* Optional browser storage. */
    }
    return { score: 0, wave: 0 };
  }
  save(
    map: MapId,
    difficulty: DifficultyId,
    score: number,
    wave: number,
  ): { best: { score: number; wave: number }; saved: boolean } {
    const old = this.get(map, difficulty);
    const best = {
      score: Math.max(old.score, score),
      wave: Math.max(old.wave, wave, 6),
    };
    try {
      this.storage().setItem(this.key(map, difficulty), JSON.stringify(best));
      return { best, saved: true };
    } catch {
      return { best, saved: false };
    }
  }
}
