import type { Enums } from "@/types/database"

/** 持ち物（家や部屋とは独立して持ち歩く入れ物）の種類 */
export const CARRY_KINDS = ["bag", "wallet", "pouch"] as const satisfies readonly Enums<"location_kind">[]

export function isCarryKind(kind: Enums<"location_kind">) {
  return (CARRY_KINDS as readonly string[]).includes(kind)
}
