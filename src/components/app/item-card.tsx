import Link from "next/link"
import { Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ExpiryBadge } from "@/components/app/expiry-badge"
import { ITEM_STATUS_LABELS, formatYen } from "@/lib/labels"
import type { Enums } from "@/types/database"

export type ItemCardData = {
  id: string
  name: string
  brand: string | null
  status: Enums<"item_status">
  quantity: number
  purchase_price: number | null
  expires_at: string | null
  categories: { name: string } | null
  locations: { name: string } | null
  photoUrl?: string
}

export function ItemCard({ item }: { item: ItemCardData }) {
  return (
    <Link
      href={`/items/${item.id}`}
      className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
    >
      <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 署名付きURLのため next/image を使わない
          <img src={item.photoUrl} alt="" className="size-full object-cover" />
        ) : (
          <Package className="size-6 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{item.name}</p>
          {item.quantity > 1 && (
            <span className="shrink-0 text-xs text-muted-foreground">×{item.quantity}</span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {[item.brand, item.categories?.name, item.locations?.name].filter(Boolean).join("・") ||
            "未分類"}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.status !== "owned" && (
            <Badge variant="secondary">{ITEM_STATUS_LABELS[item.status]}</Badge>
          )}
          {item.expires_at && item.status === "owned" && <ExpiryBadge date={item.expires_at} />}
        </div>
      </div>
      {item.purchase_price != null && (
        <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {formatYen(item.purchase_price)}
        </p>
      )}
    </Link>
  )
}
