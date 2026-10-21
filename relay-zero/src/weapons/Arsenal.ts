import {
  attachments,
  type AttachmentId,
  type AttachmentInventory,
} from "./Attachments";
import { rifle, pistol, WeaponData } from "./WeaponData";
export const heavyPistol: WeaponData = {
  ...pistol,
  id: "p6",
  name: "P-6 IMPACT",
  damage: 62,
  magazineSize: 6,
  reserveAmmo: 60,
  fireRate: 2.2,
  reloadTime: 1.65,
  verticalRecoil: 0.028,
};
export const smg: WeaponData = {
  ...rifle,
  id: "s24",
  name: "S-24 CIRCUIT",
  weaponType: "smg",
  damage: 19,
  fireRate: 14,
  magazineSize: 24,
  reserveAmmo: 216,
  reloadTime: 1.4,
  range: 55,
  verticalRecoil: 0.009,
  baseSpread: 0.004,
};
export const heavyRifle: WeaponData = {
  ...rifle,
  id: "r20",
  name: "R-20 ANCHOR",
  damage: 40,
  fireRate: 6.5,
  magazineSize: 20,
  reserveAmmo: 140,
  verticalRecoil: 0.021,
  reloadTime: 2.1,
};
export const sniper: WeaponData = {
  ...rifle,
  id: "l5",
  name: "L-5 PRISM",
  weaponType: "sniper",
  damage: 125,
  fireRate: 1,
  magazineSize: 5,
  reserveAmmo: 45,
  automatic: false,
  range: 140,
  baseSpread: 0.017,
  adsSpread: 0,
  verticalRecoil: 0.038,
  reloadTime: 2.4,
};
export const starters = [pistol, heavyPistol];
export const catalog = [
  { data: smg, price: 300, role: "SMG · 빠른 연사 / 근거리" },
  { data: rifle, price: 600, role: "돌격소총 · 균형형" },
  { data: heavyRifle, price: 850, role: "중형 소총 · 높은 단발 피해" },
  { data: sniper, price: 1000, role: "저격총 · 정밀 조준 / 느린 사격" },
];
export class Wallet {
  coins = 0;
  upgrades: AttachmentInventory = new Map();
  owned = new Set<string>();
  reset(): void {
    this.coins = 0;
    this.upgrades.clear();
    this.owned.clear();
  }
  buyAttachment(weaponId: string, id: AttachmentId): boolean {
    const item = attachments.find((a) => a.id === id);
    if (
      !item ||
      ![...starters, ...catalog.map((i) => i.data)].some(
        (w) => w.id === weaponId,
      )
    )
      return false;
    if (!this.owned.has(weaponId) && !starters.some((w) => w.id === weaponId))
      return false;
    const equipped = this.upgrades.get(weaponId) ?? new Set<AttachmentId>();
    if (equipped.has(id) || equipped.size >= 2 || this.coins < item.price)
      return false;
    this.coins -= item.price;
    equipped.add(id);
    this.upgrades.set(weaponId, equipped);
    return true;
  }
  reward(elite: boolean, head: boolean): number {
    const amount = (elite ? 150 : 100) + (head ? 25 : 0);
    this.coins += amount;
    return amount;
  }
  buy(id: string): boolean {
    const item = catalog.find((i) => i.data.id === id);
    if (!item) return false;
    if (this.owned.has(id)) return true;
    if (this.coins < item.price) return false;
    this.coins -= item.price;
    this.owned.add(id);
    return true;
  }
}
