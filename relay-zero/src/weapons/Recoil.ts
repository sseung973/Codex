import type { WeaponData } from "./WeaponData";
// Stylized game response, with a repeatable sweep rather than random camera shake.
const sweep = [0, 0.2, 0.35, 0.5, 0.6, 0.4, 0.1, -0.3, -0.6, -0.7, -0.4, 0.1];
export function recoilImpulse(
  data: WeaponData,
  shot: number,
  ads: boolean,
  crouched: boolean,
  moving: boolean,
  airborne: boolean,
): { pitch: number; yaw: number } {
  const strength =
    (ads ? data.adsRecoilMultiplier : 1) *
    (crouched ? 0.75 : 1) *
    (airborne ? 1.3 : moving ? 1.15 : 1);
  return {
    pitch:
      data.verticalRecoil *
      (1 + Math.min(Math.max(shot - 1, 0), 12) * 0.045) *
      strength,
    yaw:
      sweep[Math.max(0, shot - 1) % sweep.length] *
      data.horizontalRecoil *
      strength,
  };
}
