import { Mesh, Material, Vector3 } from "@babylonjs/core";
import type { Level } from "../world/Level";
import { buildFacilityProps } from "./FacilityProps";
import { maps } from "../world/MapData";
import { gameTheme } from "./GameTheme";
/** Visual-only dressing: existing collision meshes, spawn positions and navigation are untouched. */
export function buildEnvironmentDetails(level: Level): void {
  const theme = maps[level.mapId];
  const c = {
    ...gameTheme.colors,
    amber: theme.accent,
    blue: theme.glow,
    concrete: theme.wall,
    paint: theme.accent,
    ivory: level.mapId === "nexus" ? "#e4eeeb" : gameTheme.colors.ivory,
  };
  const dark = level.material("detail metal", c.metal),
    steel = level.material("detail steel", c.steel),
    amber = level.material("safety paint", c.amber),
    white = level.material("ceramic panel", c.ivory),
    blue = level.material("entry emission", c.blue, c.blue),
    red = level.material("wayfinding emission", c.amber, c.amber);
  const groups = new Map<Material, Mesh[]>();
  const box = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: Material,
  ) => {
    const m = level.box(
      name,
      new Vector3(x, y, z),
      new Vector3(w, h, d),
      mat,
      false,
    );
    const list = groups.get(mat) ?? [];
    list.push(m);
    groups.set(mat, list);
    return m;
  };
  if (level.mapId !== "cargo") buildFacilityProps(level, box);
  const concrete = level.material("wall panel concrete", c.concrete);
  const paint = level.material("structural painted metal", c.paint);
  for (const x of [-9.5, 9.5]) {
    for (const z of [-12, -6, 0, 12, 18]) {
      box("floor lane module", x, 0.006, z, 3.3, 0.008, 5.25, paint);
      for (const edge of [-1, 1])
        // Clear the transverse floor seam: near-coplanar strips flickered at their crossings.
        box(
          "lane boundary",
          x + edge * 1.72,
          0.041,
          z,
          0.024,
          0.013,
          5.5,
          white,
        );
    }
  }
  // Preparation zone remains clear; markings sit directly on the floor.
  for (const x of [-5, 5]) {
    box("spawn boundary", x, 0.039, -16, 0.07, 0.012, 9, blue);
    box("forward route", x, 0.039, -9.8, 0.075, 0.012, 1.9, amber);
  }
  for (const x of [-13.5, 13.5]) {
    box("side corridor outer edge", x, 0.018, 7, 0.055, 0.02, 25, white);
    for (const z of [-2, 3, 8, 13])
      box("side route chevron", x, 0.044, z, 0.65, 0.012, 0.055, amber);
  }
  // Recessed panel rhythm stays attached to the enclosing walls.
  for (const x of level.mapId === "cargo" ? [] : [-21.43, 21.43]) {
    for (const z of [-17, -7, 3, 13]) {
      box("wall concrete panel", x, 2.25, z, 0.04, 3.8, 7.7, concrete);
      box("wall base skirting", x, 0.25, z, 0.08, 0.32, 8, dark);
      for (const dz of [-4.1, 4.1])
        box("blue structural upright", x, 4.4, z + dz, 0.13, 8.4, 0.32, paint);
    }
  }
  for (const x of level.mapId === "cargo" ? [] : [-16, -8, 0, 8, 16]) {
    box("rear concrete panel", x, 3.2, 21.44, 7.55, 5.6, 0.035, concrete);
    box("upper service fascia", x, 7.45, 21.38, 7.55, 0.7, 0.06, paint);
  }
  // Light ceiling cassettes: open central slots retain directional illumination.
  for (const x of level.mapId === "cargo" ? [] : [-16, -8, 8, 16])
    for (const z of [-15, -3, 9, 19])
      box("ceiling cassette", x, 10.6, z, 6.8, 0.16, 8.3, concrete);
  // Existing cores get a recessed vertical amber panel rather than a new obstruction.
  const core = level.solids.find((m) =>
    /^(relay core|nexus core)$/.test(m.name),
  );
  if (core) {
    const b = core.getBoundingInfo().boundingBox.extendSize;
    const p = core.position;
    for (const side of [-1, 1]) {
      const z = p.z + side * (b.z + 0.045);
      box(
        "core recessed channel",
        p.x,
        p.y,
        z,
        b.x * 1.1,
        b.y * 1.65,
        0.06,
        dark,
      );
      for (const dx of [-0.2, 0.2])
        box(
          "core amber filament",
          p.x + dx,
          p.y + 0.25,
          z + side * 0.04,
          0.075,
          b.y * 1.2,
          0.035,
          red,
        );
      box(
        "core identification plate",
        p.x,
        p.y - b.y * 0.65,
        z + side * 0.045,
        b.x * 0.7,
        0.32,
        0.045,
        white,
      );
    }
  }
  // Wall-mounted systems sit inside the existing perimeter, above playable head height.
  for (const x of level.mapId === "cargo" ? [] : [-21.42, 21.42])
    for (const z of [-17, -7, 3, 13]) {
      box("wall service panel", x, 4.9, z, 0.08, 2.2, 5.4, dark);
      for (let i = 0; i < 5; i++)
        box(
          "vent fin",
          x + (x < 0 ? 0.07 : -0.07),
          4.4 + i * 0.22,
          z,
          0.06,
          0.065,
          2.5,
          steel,
        );
      box(
        "service light",
        x + (x < 0 ? 0.08 : -0.08),
        6.13,
        z,
        0.07,
        0.06,
        3.4,
        z > 8 ? red : blue,
      );
    }
  // Overhead structural rhythm and distant skyline, not additional movement obstacles.
  for (const z of level.mapId === "cargo" ? [] : [-16, -4, 8, 19]) {
    box("overhead truss", 0, 9.3, z, 43, 0.28, 0.3, dark);
    for (const x of [-14, 0, 14]) {
      box("hanging luminaire", x, 9.07, z, 4, 0.15, 0.75, steel);
      box("luminaire diffuser", x, 8.97, z, 3.6, 0.025, 0.52, white);
    }
  }
  for (const x of [-28, 28])
    for (let i = 0; i < 4; i++)
      box("outer facility", x, 5 + i, -8 + i * 12, 6, 10 + i * 2, 7, dark);
  // Entry portal dressing is attached to the existing back wall.
  for (const x of [-4.2, 4.2])
    box("entry jamb", x, 2.5, -21.35, 0.24, 5, 0.16, steel);
  box("entry lintel", 0, 5.05, -21.35, 8.6, 0.25, 0.16, steel);
  box("entry light", 0, 4.8, -21.23, 7.7, 0.05, 0.04, blue);
  for (const x of [-2.8, 2.8])
    for (let i = 0; i < 6; i++)
      box(
        "entry lane dash",
        x,
        0.049,
        -19 + i * 0.65,
        0.12,
        0.015,
        0.32,
        white,
      );
  // Surface trim attached to existing cover; never creates a new collider.
  for (const solid of level.solids) {
    if (!/cover|crate|container/.test(solid.name)) continue;
    const b = solid.getBoundingInfo().boundingBox.extendSize,
      p = solid.position;
    box(
      "cover safety band",
      p.x,
      p.y + b.y * 0.65,
      p.z - b.z - 0.022,
      b.x * 1.7,
      0.075,
      0.025,
      amber,
    );
    for (const sign of [-1, 1])
      box(
        "cover corner plate",
        p.x + sign * b.x * 0.83,
        p.y,
        p.z - b.z - 0.04,
        0.07,
        b.y * 1.65,
        0.035,
        steel,
      );
  }
  // A lightweight antenna identifies the existing relay, or the cargo gantry.
  const centerZ = level.mapId === "cargo" ? 8 : level.mapId === "nexus" ? 7 : 6;
  const base =
    level.mapId === "cargo" ? 10.3 : level.mapId === "nexus" ? 4.35 : 5.65;
  box("relay antenna", 0, base + 1.4, centerZ, 0.12, 2.8, 0.12, steel);
  box("relay amber beacon", 0, base + 2.82, centerZ, 0.28, 0.18, 0.28, amber);
  for (const y of [base + 0.4, base + 0.9])
    box("antenna crossbar", 0, y, centerZ, 2, 0.07, 0.07, dark);
  // Outboard rail and treads illustrate the existing raised deck, leaving ramp access open.
  const deckX =
    level.mapId === "cargo" ? 16 : level.mapId === "foundry" ? -16 : 0;
  if (deckX) {
    for (let i = 0; i < 6; i++)
      box("deck tread", deckX - 2.7 + i, 1.112, -17, 0.045, 0.015, 5.6, white);
    for (const z of [-19.85, -14.15]) {
      box("deck perimeter rail", deckX, 1.8, z, 5.7, 0.07, 0.07, steel);
      for (const x of [deckX - 2.7, deckX + 2.7])
        box("rail post", x, 1.45, z, 0.07, 0.7, 0.07, steel);
    }
  }
  // Each sector has its own distant silhouette and wayfinding, without new collision.
  // The existing six material batches absorb these pieces before the final merge.
  if (level.mapId === "cargo") {
    // Loading bay: stacked portal frames echo the existing crane and containers.
    for (const z of [-8, 4, 16]) {
      for (const x of [-18.5, 18.5]) {
        box("loading portal upright", x, 6.4, z, 0.34, 4.6, 0.5, steel);
        box(
          "loading portal lamp",
          x + (x < 0 ? 0.2 : -0.2),
          6.7,
          z,
          0.04,
          0.1,
          0.35,
          amber,
        );
      }
      box("loading portal crossmember", 0, 8.7, z, 37.3, 0.3, 0.5, dark);
    }
    for (const x of [-12, 12]) {
      box("loading dock fascia", x, 5.4, 20.9, 8.2, 0.7, 0.12, paint);
      box("loading dock identifier", x, 5.35, 20.8, 2.8, 0.09, 0.04, white);
    }
  } else if (level.mapId === "nexus") {
    // Lab: four observation bays and cool repeated instrument strips.
    for (const [x, z, depth] of [
      [-12, -5, 8],
      [10, -3, 4],
      [-11, 10, 4],
      [12, 12, 8],
    ]) {
      const front = z - depth / 2 - 0.1;
      box("lab observation window", x, 2.2, front, 3, 0.85, 0.045, dark);
      box(
        "lab observation glass",
        x,
        2.2,
        front - 0.03,
        2.72,
        0.63,
        0.018,
        steel,
      );
      box(
        "lab observation header",
        x,
        2.68,
        front - 0.02,
        3.2,
        0.08,
        0.04,
        blue,
      );
      for (const side of [-1, 1])
        box(
          "lab window bracket",
          x + side * 1.55,
          2.2,
          front - 0.025,
          0.09,
          1.06,
          0.055,
          white,
        );
    }
    for (const x of [-16, 0, 16])
      box("lab ceiling index", x, 8.83, 18, 3.5, 0.075, 0.26, blue);
  } else {
    // Foundry: upper gallery heat baffles and amber service guides.
    for (const x of [-12, 12])
      for (const z of [3.3, 7.4, 11.5]) {
        const face = x + (x < 0 ? 3.65 : -3.65);
        box("foundry baffle", face, 2.6, z, 0.09, 2.4, 1.55, dark);
        box(
          "foundry heat slot",
          face + (x < 0 ? 0.055 : -0.055),
          2.25,
          z,
          0.02,
          0.09,
          1.05,
          amber,
        );
      }
    for (const x of [-14.5, 14.5])
      box("foundry gallery label", x, 5.32, 8, 0.18, 0.08, 10.5, white);
  }
  level.sign(
    "RELAY / TRAINING SYSTEMS",
    new Vector3(-14, 7.15, 21.38),
    10,
    0.65,
    c.ivory,
  );
  level.sign(
    "ENTRY  /  01",
    new Vector3(0, 3.8, -21.25),
    6,
    0.75,
    c.blue,
    false,
    Math.PI,
  );
  level.sign("LIVE SIMULATION", new Vector3(14, 7.15, 21.37), 8, 0.65, c.amber);
  if (level.mapId === "foundry") {
    const heat = level.material("furnace glow", "#ff8a32", "#ff631f");
    for (const x of [-12, 12]) {
      box("furnace face", x, 2.6, 0.28, 5.6, 2.4, 0.12, dark);
      for (let i = 0; i < 7; i++)
        box(
          "furnace slit",
          x - 2.1 + i * 0.7,
          2.6,
          0.19,
          0.22,
          1.9,
          0.04,
          heat,
        );
      for (const z of [3, 10, 16]) {
        box("exhaust stack", x, 7, z, 1.4, 4.2, 1.4, dark);
        box("exhaust band", x, 8.8, z, 1.55, 0.22, 1.55, amber);
      }
    }
    level.sign(
      "SMELTING / 1400°",
      new Vector3(-12, 4.2, 0.15),
      5.5,
      0.6,
      theme.glow,
    );
  } else if (level.mapId === "cargo") {
    for (const x of [-29, 29])
      for (let i = 0; i < 5; i++) {
        box(
          "distant cargo stack",
          x,
          2 + (i % 2) * 2,
          -18 + i * 9,
          5.5,
          4,
          7,
          i % 2 ? amber : paint,
        );
      }
    for (const x of [-18, 0, 18]) {
      box("yard floodlight pole", x, 7.6, 21, 0.2, 7, 0.2, steel);
      box("yard floodlight", x, 11.1, 21, 2.5, 0.25, 0.6, white);
    }
    level.sign(
      "PORT 12 / LOADING",
      new Vector3(0, 3.4, 21.35),
      13,
      1.2,
      c.ivory,
    );
  } else {
    for (const x of [-4, 4])
      for (const z of [-11, 1, 14]) {
        box("lab ceiling ring", x, 7.8, z, 6, 0.13, 0.3, blue);
      }
    level.sign(
      "NEXUS / BIO SYSTEMS",
      new Vector3(0, 6.6, 21.32),
      14,
      1,
      c.blue,
    );
  }
  // Merge static decorative meshes by material, with no decorative shadow casters.
  for (const [material, meshes] of groups) {
    for (const m of meshes) m.computeWorldMatrix(true);
    const merged = Mesh.MergeMeshes(
      meshes,
      true,
      true,
      undefined,
      false,
      false,
    );
    if (merged) {
      merged.name = "facility details " + material.name;
      merged.parent = level.root;
      merged.material = material;
      merged.isPickable = false;
      merged.checkCollisions = false;
      merged.receiveShadows = true;
      merged.metadata = { visualOnly: true };
      merged.freezeWorldMatrix();
    }
  }
}
