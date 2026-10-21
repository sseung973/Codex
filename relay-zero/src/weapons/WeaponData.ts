export interface WeaponData {
  id: string;
  name: string;
  weaponType: "rifle" | "pistol" | "smg" | "sniper" | "melee";
  damage: number;
  headshotMultiplier: number;
  fireRate: number;
  range: number;
  magazineSize: number;
  reserveAmmo: number;
  reloadTime: number;
  automatic: boolean;
  baseSpread: number;
  movementSpread: number;
  airSpread: number;
  adsSpread: number;
  verticalRecoil: number;
  horizontalRecoil: number;
  recoilRecovery: number;
  recoilRandomness: number;
  adsRecoilMultiplier: number;
  cameraKick: number;
  muzzleFlash: boolean;
  fireSound: string;
  reloadSound: string;
  dryFireSound: string;
  weaponModel: string;
}
export const rifle: WeaponData = {
  id: "ar7",
  name: "AR-7 VANGUARD",
  weaponType: "rifle",
  damage: 26,
  headshotMultiplier: 2.4,
  fireRate: 10,
  range: 100,
  magazineSize: 30,
  reserveAmmo: 180,
  reloadTime: 1.85,
  automatic: true,
  baseSpread: 0.0015,
  movementSpread: 0.01,
  airSpread: 0.026,
  adsSpread: 0.0007,
  verticalRecoil: 0.014,
  horizontalRecoil: 0.004,
  recoilRecovery: 6,
  recoilRandomness: 0.0015,
  adsRecoilMultiplier: 0.6,
  cameraKick: 0.045,
  muzzleFlash: true,
  fireSound: "fire",
  reloadSound: "reload",
  dryFireSound: "dry",
  weaponModel: "primitive:ar7",
};
export const pistol: WeaponData = {
  ...rifle,
  id: "p12",
  name: "P-12 SIDEARM",
  weaponType: "pistol",
  damage: 38,
  fireRate: 4,
  magazineSize: 12,
  reserveAmmo: 72,
  reloadTime: 1.3,
  automatic: false,
  verticalRecoil: 0.018,
  baseSpread: 0.002,
};
export const baton: WeaponData = {
  ...rifle,
  id: "arc",
  name: "ARC-3 충격봉",
  weaponType: "melee",
  damage: 110,
  headshotMultiplier: 1,
  fireRate: 1.5,
  range: 3.5,
  magazineSize: 0,
  reserveAmmo: 0,
  reloadTime: 1,
  automatic: false,
  baseSpread: 0,
  movementSpread: 0,
  airSpread: 0,
  adsSpread: 0,
  verticalRecoil: 0,
  horizontalRecoil: 0,
  cameraKick: 0,
  muzzleFlash: false,
  weaponModel: "primitive:arc3",
};
export class Magazine {
  ammo: number;
  reserve: number;
  reloadRemaining = 0;
  get reloadDuration(): number {
    return this.data.reloadTime;
  }
  constructor(public data: WeaponData) {
    this.ammo = data.magazineSize;
    this.reserve = data.reserveAmmo;
  }
  reload(): boolean {
    if (
      this.reloadRemaining > 0 ||
      this.ammo === this.data.magazineSize ||
      this.reserve === 0
    )
      return false;
    this.reloadRemaining = this.reloadDuration;
    return true;
  }
  update(dt: number): boolean {
    if (this.reloadRemaining <= 0) return false;
    this.reloadRemaining -= dt;
    if (this.reloadRemaining > 0) return false;
    this.reloadRemaining = 0;
    const n = Math.min(this.data.magazineSize - this.ammo, this.reserve);
    this.ammo += n;
    this.reserve -= n;
    return true;
  }
  reset(): void {
    this.ammo = this.data.magazineSize;
    this.reserve = this.data.reserveAmmo;
    this.reloadRemaining = 0;
  }
}
