import { Badge } from "@/components/ui/badge"
import { daysUntil } from "@/lib/labels"

export function ExpiryBadge({ date }: { date: string }) {
  const days = daysUntil(date)
  if (days < 0) return <Badge variant="destructive">期限切れ</Badge>
  if (days === 0) return <Badge variant="destructive">今日まで</Badge>
  if (days <= 30) return <Badge variant="outline">あと{days}日</Badge>
  return null
}
