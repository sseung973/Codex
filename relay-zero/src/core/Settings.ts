export interface Settings {
  sensitivity: number;
  masterVolume: number;
  sfxVolume: number;
  fov: number;
  quality: "low" | "medium" | "high";
  autoGraphics: boolean;
  headBob: boolean;
  crosshairSize: number;
}
export const defaults: Settings = {
  sensitivity: 1,
  masterVolume: 0.65,
  sfxVolume: 0.8,
  fov: 90,
  quality: "medium",
  autoGraphics: true,
  headBob: true,
  crosshairSize: 1,
};
export function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem("relay-zero-settings") || "{}");
    const out = { ...defaults };
    for (const k of [
      "sensitivity",
      "masterVolume",
      "sfxVolume",
      "fov",
      "crosshairSize",
    ] as const)
      if (typeof s[k] === "number" && Number.isFinite(s[k])) out[k] = s[k];
    out.sensitivity = Math.max(0.15, Math.min(3, out.sensitivity));
    out.fov = Math.max(70, Math.min(110, out.fov));
    out.masterVolume = Math.max(0, Math.min(1, out.masterVolume));
    out.sfxVolume = Math.max(0, Math.min(1, out.sfxVolume));
    out.crosshairSize = Math.max(0.5, Math.min(2, out.crosshairSize));
    if (["low", "medium", "high"].includes(s.quality)) out.quality = s.quality;
    if (typeof s.autoGraphics === "boolean") out.autoGraphics = s.autoGraphics;
    if (typeof s.headBob === "boolean") out.headBob = s.headBob;
    return out;
  } catch {
    return { ...defaults };
  }
}
export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem("relay-zero-settings", JSON.stringify(s));
  } catch {
    /* Storage may be disabled in private browsing. */
  }
}
export const movement = {
  walkSpeed: 5.4,
  sprintSpeed: 8.2,
  crouchSpeed: 2.6,
  jumpForce: 8,
  gravity: 23,
  groundAcceleration: 44,
  airAcceleration: 10,
  friction: 34,
  stepHeight: 0.36,
  maxSlope: Math.PI / 3,
};
export const damp = (a: number, b: number, speed: number, dt: number): number =>
  a + (b - a) * (1 - Math.exp(-speed * dt));
