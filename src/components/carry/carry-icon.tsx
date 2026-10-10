import { Briefcase, Package, ShoppingBag, Wallet, type LucideProps } from "lucide-react"
import type { Enums } from "@/types/database"

export function CarryIcon({ kind, ...props }: { kind: Enums<"location_kind"> } & LucideProps) {
  if (kind === "wallet") return <Wallet {...props} />
  if (kind === "bag") return <Briefcase {...props} />
  if (kind === "pouch") return <ShoppingBag {...props} />
  return <Package {...props} />
}
