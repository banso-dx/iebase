import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, Plus } from "lucide-react"
import { CarryForm } from "@/components/carry/carry-form"
import { CarryIcon } from "@/components/carry/carry-icon"
import { ItemCard } from "@/components/app/item-card"
import { EditableTitle } from "@/components/locations/editable-title"
import { buttonVariants } from "@/components/ui/button"
import { ITEM_LIST_SELECT, firstPhotoPath, signPhotoPaths } from "@/lib/data/items"
import { getLocationTree } from "@/lib/data/locations"
import { LOCATION_KIND_LABELS } from "@/lib/labels"
import { requireUser } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: PageProps<"/carry/[id]">) {
  const { id } = await params
  const { supabase } = await requireUser()
  const { data } = await supabase.from("locations").select("name").eq("id", id).maybeSingle()
  return { title: data?.name ?? "持ち物" }
}

export default async function CarryDetailPage({ params }: PageProps<"/carry/[id]">) {
  const { id } = await params
  const { supabase } = await requireUser()
  const tree = await getLocationTree(supabase)

  const carry = tree.byId.get(id)
  if (!carry || !tree.isCarry(id)) notFound()

  const { data: items } = await supabase
    .from("items")
    .select(ITEM_LIST_SELECT)
    .eq("location_id", id)
    .eq("status", "owned")
    .order("name")
  const urls = await signPhotoPaths(
    supabase,
    (items ?? []).flatMap((i) => firstPhotoPath(i.item_photos) ?? [])
  )

  const crumbs = tree.ancestors(id).slice(0, -1)
  const inner = tree.childrenOf(id)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav aria-label="パンくず" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href="/carry" className="hover:text-foreground">
          持ち物
        </Link>
        {crumbs.map((c) => (
          <span key={c.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" />
            <Link href={`/carry/${c.id}`} className="hover:text-foreground">
              {c.name}
            </Link>
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CarryIcon kind={carry.kind} className="size-5" />
        </span>
        <EditableTitle locationId={carry.id} name={carry.name} />
        <span className="text-sm text-muted-foreground">モノ {tree.itemCount(id)}点</span>
      </div>

      {inner.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">中に入っているもの</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {inner.map((c) => (
              <li key={c.id}>
                <Link href={`/carry/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <CarryIcon kind={c.kind} className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {LOCATION_KIND_LABELS[c.kind]}・{tree.itemCount(c.id)}点
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">中身</h2>
          <Link href={`/items/new?location=${id}`} className={cn(buttonVariants({ size: "sm" }))}>
            <Plus />
            ここにモノを登録
          </Link>
        </div>
        <div className="space-y-2">
          {(items ?? []).map((i) => {
            const path = firstPhotoPath(i.item_photos)
            return <ItemCard key={i.id} item={{ ...i, photoUrl: path ? urls.get(path) : undefined }} />
          })}
          {items?.length === 0 && (
            <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              まだ何も登録されていません
            </p>
          )}
        </div>
      </section>

      <CarryForm parentId={id} title="中にポーチや財布を入れる" />
    </div>
  )
}
