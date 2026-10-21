import type { WeaponData } from "./WeaponData";

export const attachments = [
  {
    id: "magazine",
    name: "확장 탄창",
    description: "탄창 +50% · 추가 탄약은 재장전으로 충전",
    price: 200,
  },
  {
    id: "stabilizer",
    name: "반동 제어기",
    description: "수직·좌우 반동 28% 감소",
    price: 250,
  },
  {
    id: "loader",
    name: "빠른 재장전",
    description: "재장전 시간 22% 감소",
    price: 200,
  },
] as const;
export type AttachmentId = (typeof attachments)[number]["id"];
export type AttachmentInventory = Map<string, Set<AttachmentId>>;
export function withAttachments(
  base: WeaponData,
  equipped?: ReadonlySet<AttachmentId>,
): WeaponData {
  return {
    ...base,
    magazineSize: equipped?.has("magazine")
      ? Math.ceil(base.magazineSize * 1.5)
      : base.magazineSize,
    verticalRecoil:
      base.verticalRecoil * (equipped?.has("stabilizer") ? 0.72 : 1),
    horizontalRecoil:
      base.horizontalRecoil * (equipped?.has("stabilizer") ? 0.72 : 1),
    reloadTime: base.reloadTime * (equipped?.has("loader") ? 0.78 : 1),
  };
}
