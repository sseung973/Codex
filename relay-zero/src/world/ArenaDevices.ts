import { Mesh, Vector3 } from "@babylonjs/core";
import { Health, type DamageInfo } from "../combat/Damage";
import type { Navigation } from "../ai/Navigation";
import type { Level } from "./Level";

export class PowerCell extends Health {
  mesh: Mesh;
  onExplode: (point: Vector3) => void = () => {};
  constructor(level: Level, pos: Vector3, id: string) {
    super(id, 45);
    this.mesh = level.box(
      "explosive power cell",
      pos.add(new Vector3(0, 0.65, 0)),
      new Vector3(0.85, 1.3, 0.85),
      level.material("volatile amber", "#9b6837", "#edac58"),
    );
    this.mesh.metadata.entity = this;
  }
  override receiveDamage(info: DamageInfo): boolean {
    if (this.health <= 0) return false;
    const dead = super.receiveDamage(info);
    if (dead) {
      const point = this.mesh.position.clone();
      this.mesh.setEnabled(false);
      this.onExplode(point);
    }
    return dead;
  }
  reset(): void {
    super.reset();
    this.mesh.setEnabled(true);
  }
}

interface Barrier {
  mesh: Mesh;
  control: Mesh;
  label: string;
  active: number;
  cooldown: number;
}
export class ArenaDevices {
  cells: PowerCell[] = [];
  barriers: Barrier[] = [];
  onBlast: (point: Vector3) => void = () => {};
  onChange: () => void = () => {};
  constructor(
    public level: Level,
    public navigation: Navigation,
    mission: readonly Vector3[],
  ) {
    const used: Vector3[] = [level.spawn, ...mission];
    const place = (desired: Vector3, wide = false): Vector3 | undefined => {
      const candidates: Vector3[] = [];
      for (let z = 1; z < navigation.size - 1; z++)
        for (let x = 1; x < navigation.size - 1; x++) {
          const p = navigation.world(x, z);
          if (
            navigation.blocked.has(z * navigation.size + x) ||
            used.some((q) => Vector3.DistanceSquared(p, q) < 25)
          )
            continue;
          if (
            wide &&
            [-1, 0, 1].some((dx) =>
              [-1, 0, 1].some((dz) =>
                navigation.blocked.has((z + dz) * navigation.size + x + dx),
              ),
            )
          )
            continue;
          candidates.push(p);
        }
      candidates.sort(
        (a, b) =>
          Vector3.DistanceSquared(a, desired) -
          Vector3.DistanceSquared(b, desired),
      );
      const point = candidates[0];
      if (point) used.push(point);
      return point;
    };
    for (const [i, desired] of [
      new Vector3(-6, 0, -10),
      new Vector3(8, 0, -2),
      new Vector3(-2, 0, 16),
    ].entries()) {
      const p = place(desired, true);
      if (!p) continue;
      const cell = new PowerCell(level, p, `power-cell-${i}`);
      cell.onExplode = (point) => {
        this.navigation.rebuild();
        this.onChange();
        this.onBlast(point);
      };
      this.cells.push(cell);
      level.sign(
        "VOLATILE / KEEP CLEAR",
        p.add(new Vector3(0, 1.6, -0.46)),
        2.3,
        0.35,
        "#edac58",
      );
    }
    for (const [i, desired] of [
      new Vector3(-16, 0, -8),
      new Vector3(14, 0, 10),
    ].entries()) {
      const p = place(desired, true);
      if (!p) continue;
      const mesh = level.box(
        i === 0 ? "temporary security door" : "deployable cover",
        p.add(new Vector3(0, i === 0 ? 1.5 : 0.65, 0)),
        new Vector3(3.2, i === 0 ? 3 : 1.3, 0.4),
        level.material("tactical barrier", "#435c70"),
      );
      mesh.setEnabled(false);
      const control = level.box(
        "barrier control",
        p.add(new Vector3(-2.2, 0.45, -0.8)),
        new Vector3(0.38, 0.9, 0.38),
        level.material("barrier switch", "#435c70", "#8fc3df"),
        false,
      );
      level.sign(
        i === 0 ? "E / SECURITY DOOR" : "E / DEPLOY COVER",
        control.position.add(new Vector3(0, 1.1, -0.2)),
        2.4,
        0.4,
        "#8fc3df",
      );
      this.barriers.push({
        mesh,
        control,
        label: i === 0 ? "차단문" : "전개 엄폐물",
        active: 0,
        cooldown: 0,
      });
    }
    navigation.rebuild();
  }
  private nearby(position: Vector3): Barrier | undefined {
    return this.barriers
      .filter(
        (b) =>
          Vector3.DistanceSquared(position, b.control.position) < 10 &&
          this.level.lineClear(position, b.control.position),
      )
      .sort(
        (a, b) =>
          Vector3.DistanceSquared(position, a.control.position) -
          Vector3.DistanceSquared(position, b.control.position),
      )[0];
  }
  hint(position: Vector3): string {
    const b = this.nearby(position);
    return !b
      ? ""
      : b.active > 0
        ? `${b.label} 작동 중 · ${Math.ceil(b.active)}초 후 해제`
        : b.cooldown > 0
          ? `${b.label} 재충전 · ${Math.ceil(b.cooldown)}초`
          : `E · ${b.label} 6초 가동`;
  }
  interact(position: Vector3, occupants: readonly Vector3[]): boolean {
    const b = this.nearby(position);
    if (!b || b.cooldown > 0 || b.active > 0) return false;
    if (
      [position, ...occupants].some(
        (p) =>
          Math.abs(p.x - b.mesh.position.x) < 2.1 &&
          Math.abs(p.z - b.mesh.position.z) < 0.8,
      )
    )
      return false;
    b.active = 6;
    b.mesh.setEnabled(true);
    b.mesh.computeWorldMatrix(true);
    this.navigation.rebuild();
    this.onChange();
    return true;
  }
  update(dt: number): void {
    for (const b of this.barriers) {
      b.cooldown = Math.max(0, b.cooldown - dt);
      if (b.active <= 0) continue;
      b.active = Math.max(0, b.active - dt);
      if (b.active === 0) {
        b.mesh.setEnabled(false);
        b.cooldown = 8;
        this.navigation.rebuild();
        this.onChange();
      }
    }
  }
  reset(): void {
    for (const cell of this.cells) cell.reset();
    for (const b of this.barriers) {
      b.active = b.cooldown = 0;
      b.mesh.setEnabled(false);
    }
    this.navigation.rebuild();
    this.onChange();
  }
}
