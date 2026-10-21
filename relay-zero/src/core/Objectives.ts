import { Vector3 } from "@babylonjs/core";
export type ObjectiveKind = "eliminate" | "capture" | "activate" | "defend";
export const objectiveForWave = (wave: number): ObjectiveKind =>
  (["eliminate", "capture", "activate", "defend", "eliminate"] as const)[
    wave - 1
  ] ?? "eliminate";
export const objectiveNames: Record<ObjectiveKind, string> = {
  eliminate: "적 전멸",
  capture: "중계기 점령",
  activate: "장치 2개 작동",
  defend: "구역 방어",
};
export class Objectives {
  kind: ObjectiveKind = "eliminate";
  points: Vector3[] = [];
  stage = 0;
  progress = 0;
  done = true;
  contested = false;
  inside = false;
  get point(): Vector3 | undefined {
    return this.points[this.stage];
  }
  get duration(): number {
    return this.kind === "capture" ? 12 : this.kind === "defend" ? 20 : 3;
  }
  get radius(): number {
    return this.kind === "activate" ? 2.2 : 3;
  }
  reset(kind: ObjectiveKind = "eliminate", points: Vector3[] = []): void {
    this.kind = kind;
    this.points = points.map((p) => p.clone());
    this.stage = 0;
    this.progress = 0;
    this.done = kind === "eliminate";
    this.contested = false;
    this.inside = false;
  }
  update(
    dt: number,
    position: Vector3,
    enemies: readonly Vector3[],
    interact: boolean,
    lineClear: boolean,
  ): boolean {
    const point = this.point;
    if (this.done || !point) return false;
    this.inside =
      Vector3.DistanceSquared(position, point) <= this.radius ** 2 && lineClear;
    this.contested = enemies.some(
      (p) => Vector3.DistanceSquared(p, point) < this.radius ** 2,
    );
    const advancing =
      this.inside && !this.contested && (this.kind !== "activate" || interact);
    if (advancing) this.progress = Math.min(this.duration, this.progress + dt);
    else if (this.kind === "activate") this.progress = 0;
    else if (this.kind === "defend")
      this.progress = Math.max(0, this.progress - dt * 2);
    if (this.progress < this.duration) return false;
    if (this.kind === "activate" && this.stage + 1 < this.points.length) {
      this.stage++;
      this.progress = 0;
      return false;
    }
    this.done = true;
    return true;
  }
  get hint(): string {
    if (this.done)
      return this.kind === "eliminate"
        ? "남은 적을 모두 처치해"
        : "목표 완료 · 남은 적을 처치해";
    if (this.contested) return "구역 경합 · 안의 적을 먼저 처리해";
    if (!this.inside)
      return this.kind === "activate"
        ? "표시된 장치로 이동해"
        : "빛나는 원 안으로 이동해";
    return this.kind === "activate"
      ? `E 길게 누르기 · 장치 ${this.stage + 1}/2`
      : this.kind === "defend"
        ? "20초 방어 · 이탈·경합 시 진행 감소"
        : "12초 점령 · 이탈 시 진행 보존";
  }
}
