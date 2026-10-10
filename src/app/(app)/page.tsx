import Link from "next/link"
import { ArrowRight, PackageOpen } from "lucide-react"
import { ItemCard, type ItemCardData } from "@/components/app/item-card"
import { buttonVariants } from "@/components/ui/button"
import { ITEM_LIST_SELECT, firstPhotoPath, signPhotoPaths } from "@/lib/data/items"
import { formatYen } from "@/lib/labels"
import { requireUser } from "@/lib/supabase/server"

const EXPIRY_WINDOW_DAYS = 30

export default async function HomePage() {
  const { supabase } = await requireUser()

  const soon = new Date()
  soon.setDate(soon.getDate() + EXPIRY_WINDOW_DAYS)
  const soonDate = soon.toISOString().slice(0, 10)

  const [owned, expiring, recent] = await Promise.all([
    supabase.from("items").select("quantity, purchase_price").eq("status", "owned"),
    supabase
      .from("items")
      .select(ITEM_LIST_SELECT)
      .eq("status", "owned")
      .not("expires_at", "is", null)
      .lte("expires_at", soonDate)
      .order("expires_at")
      .limit(10),
    supabase.from("items").select(ITEM_LIST_SELECT).order("created_at", { ascending: false }).limit(5),
  ])

  const ownedRows = owned.data ?? []
  const totalCount = ownedRows.reduce((sum, r) => sum + r.quantity, 0)
  const totalValue = ownedRows.reduce((sum, r) => sum + (r.purchase_price ?? 0) * r.quantity, 0)

  const lists = [...(expiring.data ?? []), ...(recent.data ?? [])]
  const urls = await signPhotoPaths(
    supabase,
    lists.flatMap((i) => firstPhotoPath(i.item_photos) ?? [])
  )
  const toCard = (i: (typeof lists)[number]): ItemCardData => {
    const path = firstPhotoPath(i.item_photos)
    return { ...i, photoUrl: path ? urls.get(path) : undefined }
  }

  if (ownedRows.length === 0 && lists.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <PackageOpen className="size-12 text-muted-foreground" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">まずは身近なモノから登録してみましょう</h1>
          <p className="text-sm text-muted-foreground">
            財布の中身、クローゼットの服、棚の上の家電など。
          </p>
        </div>
        <Link href="/items/new" className={buttonVariants()}>
          最初のモノを登録する
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3">
        <Stat label="所有しているモノ" value={`${totalCount.toLocaleString()}点`} />
        <Stat label="購入金額の合計" value={formatYen(totalValue)} />
      </section>

      {(expiring.data?.length ?? 0) > 0 && (
        <Section title={`期限が近いモノ（${EXPIRY_WINDOW_DAYS}日以内）`}>
          {expiring.data!.map((i) => (
            <ItemCard key={i.id} item={toCard(i)} />
          ))}
        </Section>
      )}

      <Section title="最近登録したモノ" href="/items">
        {(recent.data ?? []).map((i) => (
          <ItemCard key={i.id} item={toCard(i)} />
        ))}
      </Section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function Section({
  title,
  href,
  children,
}: {
  title: string
  href?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {href && (
          <Link href={href} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            すべて見る
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
