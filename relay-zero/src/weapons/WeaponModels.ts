import { gameTheme } from "../visual/GameTheme";
import type { WeaponData } from "./WeaponData";
import {
  Scene,
  TransformNode,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Vector3,
} from "@babylonjs/core";
export interface WeaponView {
  root: TransformNode;
  muzzle: Mesh;
}
/** Three independent, stylized models. No overlapping old weapon parts when swapping. */
export class WeaponModels {
  views: WeaponView[] = [];
  constructor(scene: Scene, parent: TransformNode) {
    const material = (name: string, hex: string, glow = false) => {
      const m = new PBRMaterial(name, scene);
      m.albedoColor = Color3.FromHexString(hex);
      m.metallic = name.includes("titanium") ? 0.65 : 0.15;
      m.roughness =
        name === "rubber"
          ? 0.96
          : name === "matte titanium"
            ? 0.7
            : name.includes("titanium")
              ? 0.42
              : 0.78;
      m.emissiveColor = Color3.FromHexString(hex).scale(glow ? 0.6 : 0.035);
      m.freeze();
      return m;
    };
    const graphite = material("ceramic graphite", gameTheme.colors.metal),
      ivory = material("ceramic ivory", gameTheme.colors.steel),
      steel = material("titanium", gameTheme.colors.muted),
      cyan = material("energy cyan", gameTheme.colors.blue, true),
      amber = material("energy amber", gameTheme.colors.amber, true),
      rubber = material("rubber", "#151c23"),
      matte = material("matte titanium", "#465360");
    for (let slot = 0; slot < 3; slot++) {
      const root = new TransformNode(`viewmodel-${slot}`, scene);
      root.parent = parent;
      const box = (
        name: string,
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        mat = graphite,
      ) => {
        const m = MeshBuilder.CreateBox(
          name,
          { width: w, height: h, depth: d },
          scene,
        );
        m.position.set(x, y, z);
        m.parent = root;
        m.material = mat;
        m.isPickable = false;
        m.renderingGroupId = 1;
        return m;
      };
      const cylinder = (
        name: string,
        x: number,
        y: number,
        z: number,
        length: number,
        diameter: number,
        mat = steel,
      ) => {
        const m = MeshBuilder.CreateCylinder(
          name,
          { height: length, diameter, tessellation: 12 },
          scene,
        );
        m.position.set(x, y, z);
        m.rotation.x = Math.PI / 2;
        m.parent = root;
        m.material = mat;
        m.isPickable = false;
        m.renderingGroupId = 1;
        return m;
      };
      let muzzle: Mesh;
      if (slot === 0) {
        box("AR recoil pad", 0, -0.025, -0.26, 0.14, 0.18, 0.045, rubber);
        box("AR lower receiver", 0, -0.065, 0.23, 0.15, 0.09, 0.38, matte);
        for (let i = 0; i < 5; i++) {
          box(
            "AR top rail segment",
            0,
            0.147,
            0.2 + i * 0.065,
            0.12,
            0.018,
            0.025,
            graphite,
          );
          box(
            "AR grip texture",
            0.05,
            -0.13 - i * 0.028,
            0.02,
            0.008,
            0.011,
            0.09,
            rubber,
          );
        }
        box("AR inset panel", 0.094, 0.025, 0.18, 0.008, 0.06, 0.12, matte);
        box(
          "AR identification stripe",
          0.1,
          0.025,
          0.16,
          0.009,
          0.04,
          0.025,
          amber,
        );
        box("AR chassis", 0, 0, 0.28, 0.17, 0.17, 0.61);
        box("AR upper shell", 0, 0.1, 0.27, 0.185, 0.065, 0.57, ivory);
        for (const x of [-0.095, 0.095]) {
          const panel = box(
            "AR angled side",
            x,
            0.01,
            0.27,
            0.035,
            0.13,
            0.44,
            ivory,
          );
          panel.rotation.z = x > 0 ? -0.14 : 0.14;
          box("AR cyan rail", x * 1.22, 0.015, 0.31, 0.012, 0.018, 0.1, cyan);
        }
        box("AR stock", 0, -0.025, -0.14, 0.13, 0.18, 0.23, graphite);
        const grip = box("AR grip", 0, -0.17, 0.02, 0.095, 0.24, 0.13);
        grip.rotation.x = -0.22;
        const mag = box("AR power cell", 0, -0.17, 0.3, 0.1, 0.22, 0.17, steel);
        mag.rotation.x = -0.1;
        box("AR cell status", 0.057, -0.15, 0.3, 0.009, 0.09, 0.07, cyan);
        box("AR front shroud", 0, 0.012, 0.66, 0.145, 0.13, 0.21, ivory);
        for (let i = 0; i < 4; i++)
          for (const x of [-0.079, 0.079])
            box(
              "AR vent",
              x,
              0.012,
              0.585 + i * 0.04,
              0.012,
              0.04,
              0.022,
              graphite,
            );
        cylinder("AR barrel", 0, 0.025, 0.81, 0.17, 0.072);
        muzzle = cylinder("AR muzzle", 0, 0.025, 0.93, 0.1, 0.095, graphite);
        for (const x of [-0.053, 0.053])
          box("AR sight pillar", x, 0.21, 0.08, 0.018, 0.12, 0.035, steel);
        box("AR sight bridge", 0, 0.268, 0.08, 0.122, 0.018, 0.035, ivory);
        box("AR front reticle", 0, 0.223, 0.7, 0.012, 0.055, 0.018, cyan);
      } else if (slot === 1) {
        box("P12 compact slide", 0, 0.045, 0.28, 0.14, 0.145, 0.37, ivory);
        box("P12 lower frame", 0, -0.047, 0.18, 0.12, 0.06, 0.26, graphite);
        const grip = box(
          "P12 grip",
          0,
          -0.185,
          0.12,
          0.115,
          0.25,
          0.15,
          graphite,
        );
        grip.rotation.x = -0.22;
        box("P12 grip plate", 0.062, -0.17, 0.11, 0.014, 0.14, 0.075, steel);
        for (const x of [-0.078, 0.078])
          box("P12 amber strip", x, 0.05, 0.28, 0.014, 0.025, 0.18, amber);
        cylinder("P12 barrel", 0, 0.045, 0.49, 0.11, 0.064, steel);
        muzzle = cylinder(
          "P12 muzzle",
          0,
          0.045,
          0.545,
          0.035,
          0.085,
          graphite,
        );
        for (const x of [-0.04, 0.04])
          box("P12 rear sight", x, 0.195, 0.13, 0.018, 0.07, 0.025, steel);
        box("P12 front sight", 0, 0.211, 0.43, 0.014, 0.04, 0.022, amber);
      } else {
        // Fictional stun baton: short-range robot combat, no blade or graphic effects.
        const handle = cylinder(
          "ARC grip",
          0,
          -0.07,
          0.12,
          0.25,
          0.075,
          graphite,
        );
        handle.rotation.x = 0.32;
        for (let k = 0; k < 4; k++) {
          const ring = cylinder(
            "ARC grip ring",
            0,
            -0.16 + k * 0.045,
            0.09 + k * 0.014,
            0.014,
            0.085,
            steel,
          );
          ring.rotation.x = 0.32;
        }
        const shaft = box("ARC shaft", 0, 0.18, 0.2, 0.085, 0.35, 0.09, steel);
        shaft.rotation.x = 0.32;
        const head = box("ARC head", 0, 0.4, 0.27, 0.14, 0.17, 0.12, ivory);
        head.rotation.x = 0.32;
        for (const x of [-0.077, 0.077])
          box("ARC energy edge", x, 0.4, 0.27, 0.022, 0.145, 0.12, cyan);
        muzzle = box("ARC contact", 0, 0.49, 0.3, 0.07, 0.035, 0.07, cyan);
      }
      if (slot === 0) {
        const scope = cylinder(
          "PRISM optic",
          0,
          0.25,
          0.25,
          0.34,
          0.105,
          steel,
        );
        scope.metadata = { onlyWeapon: "l5" };
        scope.setEnabled(false);
        const cell = box(
          "ANCHOR enlarged cell",
          0,
          -0.21,
          0.31,
          0.18,
          0.26,
          0.19,
          ivory,
        );
        cell.metadata = { onlyWeapon: "r20" };
        cell.setEnabled(false);
        const rail = box(
          "CIRCUIT compact rail",
          0,
          0.16,
          0.29,
          0.12,
          0.05,
          0.24,
          amber,
        );
        rail.metadata = { onlyWeapon: "s24" };
        rail.setEnabled(false);
      }
      this.views.push({ root, muzzle });
      root.setEnabled(slot === 0);
    }
  }
  configure(slot: number, data: WeaponData): void {
    const view = this.views[slot];
    view.root.scaling.set(1, 1, 1);
    if (data.weaponType === "smg") view.root.scaling.set(0.9, 0.85, 0.68);
    if (data.id === "r20") view.root.scaling.set(1.2, 1.12, 1.1);
    if (data.weaponType === "sniper") view.root.scaling.set(0.88, 0.95, 1.45);
    if (data.id === "p6") view.root.scaling.set(1.15, 1.1, 1.25);
    for (const mesh of view.root.getChildMeshes()) {
      if (mesh.metadata?.onlyWeapon) {
        mesh.setEnabled(mesh.metadata.onlyWeapon === data.id);
        continue;
      }
      if (mesh.name.includes("sight") || mesh.name.includes("optic"))
        mesh.setEnabled(false);
    }
  }
  select(slot: number): void {
    this.views.forEach((v, i) => v.root.setEnabled(i === slot));
  }
}
