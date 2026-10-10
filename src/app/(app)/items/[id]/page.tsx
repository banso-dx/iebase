import Link from "next/link"
import { notFound } from "next/navigation"
import { Package, Pencil } from "lucide-react"
import { DeleteItemButton } from "@/components/items/delete-item-button"
import { ExpiryBadge } from "@/components/app/expiry-badge"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { getLocationOptions, signPhotoPaths } from "@/lib/data/items"
import {
  ITEM_CONDITION_LABELS,
  ITEM_STATUS_LABELS,
  PURCHASE_CHANNEL_LABELS,
  formatDate,
  formatYen,
} from "@/lib/labels"
import { requireUser } from "@/lib/supabase/server"

export async function generateMetadata({ params }: PageProps<"/items/[id]">) {
  const { id } = await params
  const { supabase } = await requireUser()
  const { data } = await supabase.from("items").select("name").eq("id", id).maybeSingle()
  return { title: data?.name ?? "モノ" }
}

export default async function ItemDetailPage({ params }: PageProps<"/items/[id]">) {
  const { id } = await params
  const { supabase } = await requireUser()

  const [{ data: item }, locations] = await Promise.all([
    supabase
      .from("items")
      .select("*, categories(name), item_photos(id, storage_path, sort_order)")
      .eq("id", id)
      .maybeSingle(),
    getLocationOptions(supabase),
  ])
  if (!item) notFound()

  const photos = [...item.item_photos].sort((a, b) => a.sort_order - b.sort_order)
  const urls = await signPhotoPaths(supabase, photos.map((p) => p.storage_path))
  const locationPath = locations.find((l) => l.id === item.location_id)?.path

  const rows: [string, React.ReactNode][] = [
    ["カテゴリ", item.categories?.name],
    ["保管場所", locationPath],
    ["ブランド・メーカー", item.brand],
    ["型番", item.model_number],
    ["色", item.color],
    ["サイズ", item.size],
    ["数量", item.quantity],
    ["状態", item.condition && ITEM_CONDITION_LABELS[item.condition]],
    ["JANコード", item.jan_code],
    ["購入日", item.purchased_at && formatDate(item.purchased_at)],
    ["購入金額", item.purchase_price != null && formatYen(item.purchase_price)],
    ["購入場所", item.purchase_store],
    ["購入方法", item.purchase_channel && PURCHASE_CHANNEL_LABELS[item.purchase_channel]],
    [
      "使用・消費期限",
      item.expires_at && (
        <span className="inline-flex items-center gap-2">
          {formatDate(item.expires_at)}
          <ExpiryBadge date={item.expires_at} />
        </span>
      ),
    ],
    ["保証期限", item.warranty_until && formatDate(item.warranty_until)],
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex gap-2 overflow-x-auto">
        {photos.length > 0 ? (
          photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element -- 署名付きURLのため next/image を使わない
            <img
              key={p.id}
              src={urls.get(p.storage_path)}
              alt=""
              className="size-48 shrink-0 rounded-xl bg-muted object-cover"
            />
          ))
        ) : (
          <div className="flex size-48 items-center justify-center rounded-xl bg-muted">
            <Package className="size-10 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{item.name}</h1>
          <Badge variant={item.status === "owned" ? "secondary" : "outline"}>
            {ITEM_STATUS_LABELS[item.status]}
          </Badge>
        </div>
        <Link href={`/items/${item.id}/edit`} className={buttonVariants({ variant: "outline" })}>
          <Pencil />
          編集
        </Link>
      </div>

      <dl className="divide-y rounded-xl border bg-card">
        {rows
          .filter(([, v]) => v != null && v !== false && v !== "")
          .map(([label, value]) => (
            <div key={label} className="grid grid-cols-[8rem_1fr] gap-4 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>

      {item.notes && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">メモ</h2>
          <p className="text-sm whitespace-pre-wrap">{item.notes}</p>
        </section>
      )}

      <DeleteItemButton itemId={item.id} />
    </div>
  )
}
