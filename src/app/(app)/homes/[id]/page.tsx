import Link from "next/link"
import { notFound } from "next/navigation"
import { Box, ChevronLeft, ChevronRight, MapPin } from "lucide-react"
import { EditableTitle } from "@/components/locations/editable-title"
import { RoomForm } from "@/components/rooms/room-form"
import { getLocationTree } from "@/lib/data/locations"
import { LOCATION_KIND_LABELS } from "@/lib/labels"
import { requireUser } from "@/lib/supabase/server"

export async function generateMetadata({ params }: PageProps<"/homes/[id]">) {
  const { id } = await params
  const { supabase } = await requireUser()
  const { data } = await supabase.from("locations").select("name").eq("id", id).maybeSingle()
  return { title: data?.name ?? "家" }
}

export default async function HomePage({ params }: PageProps<"/homes/[id]">) {
  const { id } = await params
  const { supabase } = await requireUser()
  const tree = await getLocationTree(supabase)

  const home = tree.byId.get(id)
  if (!home || home.kind !== "home") notFound()

  const children = tree.childrenOf(id)
  const rooms = children.filter((c) => c.kind === "room" && tree.layoutById.has(c.id))
  const roomsWithoutLayout = children.filter((c) => c.kind === "room" && !tree.layoutById.has(c.id))
  // 玄関の靴箱など、部屋に属さず家の直下にある場所
  const others = children.filter((c) => c.kind !== "room")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/homes" className="text-muted-foreground hover:text-foreground" aria-label="家の一覧へ">
          <ChevronLeft className="size-5" />
        </Link>
        <EditableTitle locationId={home.id} name={home.name} />
        <span className="text-sm text-muted-foreground">モノ {tree.itemCount(id)}点</span>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">部屋</h2>
        {rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ部屋がありません。下のフォームから追加しましょう。</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => {
              const layout = tree.layoutById.get(r.id)!
              const furniture = tree.childrenOf(r.id).filter((c) => tree.layoutById.has(c.id))
              return (
                <li key={r.id}>
                  <Link
                    href={`/rooms/${r.id}`}
                    className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
                  >
                    <span className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Box className="size-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {layout.width_cm / 100}m × {layout.depth_cm / 100}m・家具 {furniture.length}・モノ{" "}
                        {tree.itemCount(r.id)}点
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {others.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">部屋以外の場所</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {others.map((o) => (
              <li key={o.id}>
                <Link href={`/items?location=${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <MapPin className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{o.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {LOCATION_KIND_LABELS[o.kind]}・{tree.itemCount(o.id)}点
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="max-w-xl">
        <RoomForm homeId={id} candidates={roomsWithoutLayout} />
      </div>
    </div>
  )
}
