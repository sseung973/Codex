import { Material, Mesh } from "@babylonjs/core";
import type { Level } from "../world/Level";
import { maps } from "../world/MapData";
import { gameTheme } from "./GameTheme";

export type DetailBox = (
  name: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  mat: Material,
) => Mesh;

/** Surface-mounted prop kits. Every kit uses an existing solid as its backing. */
export function buildFacilityProps(level: Level, box: DetailBox): void {
  const theme = maps[level.mapId];
  const c = {
    ...gameTheme.colors,
    amber: theme.accent,
    blue: theme.glow,
    concrete: theme.wall,
    paint: theme.accent,
    ivory: level.mapId === "nexus" ? "#e4eeeb" : gameTheme.colors.ivory,
  };
  const shell = level.material("prop painted metal", c.concrete);
  const frame = level.material("detail metal", c.metal);
  const trim = level.material("detail steel", c.steel);
  const rubber = level.material("prop rubber", c.rubber);
  const screen = level.material("console glass", c.glass);
  const amber = level.material("safety paint", c.amber);
  const white = level.material("ceramic panel", c.ivory);
  // Consoles are inset into the front wall, not placed across a walkable lane.
  for (const x of [-7, 7]) {
    const z = -21.38;
    box("console housing", x, 1.12, z, 1.25, 1.9, 0.12, frame);
    box("console face", x, 0.85, z + 0.09, 1.08, 1.22, 0.06, shell);
    box("console screen surround", x, 1.68, z + 0.09, 1.08, 0.63, 0.06, trim);
    box("console glass", x, 1.68, z + 0.13, 0.94, 0.49, 0.025, screen);
    for (let row = 0; row < 3; row++)
      box(
        "console readout",
        x - 0.15,
        1.8 - row * 0.12,
        z + 0.148,
        0.5 - row * 0.09,
        0.017,
        0.008,
        white,
      );
    box("console input rail", x, 1.27, z + 0.16, 0.95, 0.1, 0.08, rubber);
    box(
      "console amber key",
      x + 0.32,
      1.27,
      z + 0.206,
      0.13,
      0.035,
      0.012,
      amber,
    );
    for (let row = 0; row < 4; row++)
      box(
        "console cooling slot",
        x,
        0.48 + row * 0.07,
        z + 0.126,
        0.65,
        0.018,
        0.012,
        frame,
      );
  }
  for (const solid of level.solids) {
    const p = solid.position;
    const b = solid.getBoundingInfo().boundingBox.extendSize;
    if (/cover|crate/.test(solid.name) && !/cap|strap/.test(solid.name)) {
      // A pale inset, recessed handle, latches and corner caps establish a supply-case family.
      for (const side of [-1, 1]) {
        const z = p.z + side * (b.z + 0.018);
        box("case inset", p.x, p.y, z, b.x * 1.5, b.y * 1.45, 0.025, shell);
        box(
          "case grip recess",
          p.x,
          p.y + b.y * 0.43,
          z + side * 0.02,
          Math.min(0.7, b.x),
          0.16,
          0.025,
          rubber,
        );
        box(
          "case handle",
          p.x,
          p.y + b.y * 0.47,
          z + side * 0.036,
          Math.min(0.48, b.x * 0.75),
          0.045,
          0.025,
          trim,
        );
        for (const sx of [-1, 1]) {
          box(
            "case latch",
            p.x + sx * b.x * 0.8,
            p.y + b.y * 0.55,
            z + side * 0.022,
            0.13,
            0.23,
            0.04,
            frame,
          );
          box(
            "case foot bumper",
            p.x + sx * b.x * 0.78,
            p.y - b.y * 0.77,
            z,
            0.23,
            b.y * 0.3,
            0.07,
            rubber,
          );
        }
      }
    }
    if (/gallery$|lab chamber|server column/.test(solid.name)) {
      const z = p.z - b.z - 0.025;
      const width = Math.min(1.35, b.x * 1.5);
      box("power service cabinet", p.x, 1.3, z, width, 2.3, 0.035, frame);
      box(
        "power cabinet panel",
        p.x,
        1.3,
        z - 0.027,
        width * 0.85,
        2.08,
        0.025,
        shell,
      );
      box(
        "generator vent recess",
        p.x,
        1.82,
        z - 0.045,
        width * 0.66,
        0.63,
        0.018,
        rubber,
      );
      for (let i = 0; i < 5; i++)
        box(
          "generator vent blade",
          p.x,
          1.57 + i * 0.11,
          z - 0.06,
          width * 0.61,
          0.035,
          0.024,
          trim,
        );
      box(
        "generator service stripe",
        p.x,
        1.22,
        z - 0.046,
        width * 0.75,
        0.055,
        0.017,
        amber,
      );
      box(
        "generator base",
        p.x,
        0.32,
        z - 0.05,
        width * 0.7,
        0.13,
        0.025,
        rubber,
      );
    }
  }
}
