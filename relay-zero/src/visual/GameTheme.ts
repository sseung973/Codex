import { Color3, PBRMaterial, Scene } from "@babylonjs/core";
export const gameTheme = {
  colors: {
    background: "#111a24",
    panel: "#17232f",
    concrete: "#737e87",
    wall: "#566673",
    metal: "#28343f",
    steel: "#728697",
    paint: "#435c70",
    ivory: "#d9dfe1",
    amber: "#edac58",
    blue: "#8fc3df",
    danger: "#e56561",
    muted: "#9baab8",
    rubber: "#171e24",
    glass: "#354a59",
  },
  lighting: {
    ambient: 0.82,
    key: 1.65,
    fog: 0.0045,
    bloom: 0.045,
    exposure: 1.08,
    contrast: 1.06,
  },
};
export const materialProfiles = {
  concrete: { metallic: 0, roughness: 0.94 },
  metal: { metallic: 0.55, roughness: 0.57 },
  paint: { metallic: 0.22, roughness: 0.73 },
  polymer: { metallic: 0, roughness: 0.83 },
  rubber: { metallic: 0, roughness: 0.98 },
  glass: { metallic: 0.15, roughness: 0.28 },
  floor: { metallic: 0.08, roughness: 0.82 },
} as const;
export type SurfaceKind = keyof typeof materialProfiles;
export function surface(
  scene: Scene,
  name: string,
  hex: string,
  emission?: string,
  kind?: SurfaceKind,
): PBRMaterial {
  const m = new PBRMaterial(name, scene);
  m.albedoColor = Color3.FromHexString(hex);
  const profile = materialProfiles[kind ?? (
    /rubber/.test(name) ? "rubber" : /glass|screen/.test(name) ? "glass" :
    /floor/.test(name) ? "floor" : /concrete|wall|ceramic/.test(name) ? "concrete" :
    /paint/.test(name) ? "paint" : /metal|trim|steel/.test(name) ? "metal" : "polymer"
  )];
  m.metallic = profile.metallic;
  m.roughness = profile.roughness;
  if (emission) {
    m.emissiveColor = Color3.FromHexString(emission).scale(0.55);
    m.unlit = true;
  }
  m.freeze();
  return m;
}
export function applyTheme(): void {
  const c = gameTheme.colors;
  for (const [name, value] of Object.entries({
    bg: c.background,
    panel: c.panel,
    primary: c.blue,
    accent: c.amber,
    danger: c.danger,
    text: c.ivory,
    muted: c.muted,
  }))
    document.documentElement.style.setProperty(`--color-${name}`, value);
}
