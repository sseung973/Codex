import { Vector3, Material } from "@babylonjs/core";
import type { Level } from "./Level";
import type { MapId } from "./MapData";
export function buildAdditionalMap(
  level: Level,
  id: MapId,
  materials: {
    dark: Material;
    accent: Material;
    trim: Material;
    light: Material;
  },
): void {
  const { dark, accent, trim, light } = materials;
  const box = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat = accent,
    solid = true,
  ) => level.box(name, new Vector3(x, y, z), new Vector3(w, h, d), mat, solid);
  if (id === "cargo") {
    const rust = level.material("cargo rust red", "#a6533d");
    const sand = level.material("cargo ochre", "#bd9656");
    let index = 0;
    for (const [x, z, w, d] of [
      [-11, -6, 5, 9],
      [-11, 10, 5, 8],
      [11, -7, 5, 6],
      [11, 6, 5, 11],
      [3, 15, 7, 3],
    ]) {
      box(
        "cargo container",
        x,
        1.7,
        z,
        w,
        3.4,
        d,
        [accent, rust, sand][index++ % 3],
      );
      box("container roof", x, 3.44, z, w + 0.12, 0.08, d + 0.12, trim, false);
      for (let k = -2; k <= 2; k++)
        box(
          "container rib",
          x + k * 0.8,
          1.7,
          z - d / 2 - 0.06,
          0.08,
          3.25,
          0.08,
          trim,
          false,
        );
      box(
        "cargo beacon",
        x,
        2.6,
        z - d / 2 - 0.115,
        1.6,
        0.1,
        0.03,
        light,
        false,
      );
    }
    for (const [x, z] of [
      [-4, 5],
      [4, 8],
      [-5, 16],
      [17, 12],
      [-17, -9],
    ])
      box("supply crate", x, 0.7, z, 2.3, 1.4, 2.3, dark);
    // Elevated entry deck, reached by a continuous ramp.
    box("loading deck", 16, 0.55, -17, 6, 1.1, 6, trim);
    const ramp = box("loading ramp", 11, 0.37, -17, 4.1, 0.28, 5.8, trim);
    ramp.rotation.z = Math.atan(1.1 / 4);
    for (const x of [-18, 18]) box("crane leg", x, 5, 8, 0.65, 10, 0.65, trim);
    box("crane crossbeam", 0, 9.8, 8, 37, 0.8, 0.85, accent, false);
    box("crane trolley", -3, 8.9, 8, 2, 1, 1.7, dark, false);
    for (const z of [-12, 0, 12])
      for (const x of [-19, 19])
        box("lane light", x, 0.028, z, 0.09, 0.016, 5, light, false);
  } else {
    for (const [x, z, width, depth] of [
      [-12, -5, 4, 8],
      [10, -3, 8, 4],
      [-11, 10, 6, 4],
      [12, 12, 4, 8],
    ]) {
      box(
        "lab chamber",
        x,
        1.8,
        z,
        width,
        3.6,
        depth,
        level.material("lab porcelain", "#c3d8d5"),
      );
      box(
        "lab canopy",
        x,
        3.68,
        z,
        width + 0.4,
        0.16,
        depth + 0.4,
        trim,
        false,
      );
      box(
        "lab illuminated panel",
        x,
        2,
        z - depth / 2 - 0.035,
        width - 1,
        1.6,
        0.045,
        accent,
        false,
      );
      box(
        "lab status line",
        x,
        3,
        z - depth / 2 - 0.07,
        width - 1,
        0.08,
        0.025,
        light,
        false,
      );
    }
    box("nexus plinth", 0, 0.3, 7, 4.6, 0.6, 4.6, trim);
    box("nexus core", 0, 2.1, 7, 2.1, 3.6, 2.1, accent);
    for (const x of [-1.15, 1.15])
      box("core light", x, 2.2, 7, 0.08, 2.6, 0.13, light, false);
    box("core crown", 0, 4.1, 7, 3.4, 0.25, 3.4, trim, false);
    for (const [x, z] of [
      [-5, 1],
      [5, 1],
      [-5, 15],
      [5, 16],
      [16, -13],
      [-16, -13],
    ])
      box("lab cover", x, 0.65, z, 2.4, 1.3, 1.8, accent);
    for (const x of [-19, 19])
      for (const z of [-5, 5, 15]) {
        box("server column", x, 2, z, 1.5, 4, 2, trim);
        for (let k = 0; k < 4; k++)
          box(
            "server indicator",
            x,
            1 + k * 0.5,
            z - 1.035,
            0.7,
            0.08,
            0.025,
            light,
            false,
          );
      }
    for (const x of [-6, 6]) {
      box("overhead rail", x, 7, 2, 0.25, 0.3, 32, trim, false);
      box("overhead strip", x, 6.82, 2, 0.14, 0.03, 6, light, false);
    }
  }
}
