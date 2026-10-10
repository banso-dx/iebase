import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { EditableTitle } from "@/components/locations/editable-title"
import { RoomEditor, type Furniture, type RoomItem } from "@/components/rooms/room-editor"
import { firstPhotoPath, signPhotoPaths } from "@/lib/data/items"
import { requireUser } from "@/lib/supabase/server"

export async function generateMetadata({ params }: PageProps<"/rooms/[id]">) {
  const { id } = await params
  const { supabase } = await requireUser()
  const { data } = await supabase.from("locations").select("name").eq("id", id).maybeSingle()
  return { title: data?.name ?? "部屋" }
}

export default async function RoomPage({ params }: PageProps<"/rooms/[id]">) {
  const { id } = await params
  const { supabase } = await requireUser()

  const [{ data: locations }, { data: layouts }] = await Promise.all([
    supabase.from("locations").select("id, name, kind, parent_id"),
    supabase.from("location_layouts").select("*"),
  ])
  const room = locations?.find((l) => l.id === id)
  const roomLayout = layouts?.find((l) => l.location_id === id)
  if (!room || !roomLayout) notFound()

  // 各保管場所が、この部屋のどの家具（部屋の直下の場所）に属するかを求める
  const byId = new Map((locations ?? []).map((l) => [l.id, l]))
  const furnitureOf = (locationId: string): string | null => {
    const seen = new Set<string>()
    let cur = byId.get(locationId)
    while (cur && !seen.has(cur.id)) {
      if (cur.parent_id === id) return cur.id
      seen.add(cur.id)
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
    }
    return null
  }
  const inRoom = new Set(
    (locations ?? []).filter((l) => l.id === id || furnitureOf(l.id)).map((l) => l.id)
  )

  const { data: items } = await supabase
    .from("items")
    .select("id, name, quantity, location_id, item_photos(storage_path, sort_order)")
    .eq("status", "owned")
    .in("location_id", [...inRoom])
    .order("name")

  const urls = await signPhotoPaths(
    supabase,
    (items ?? []).flatMap((i) => firstPhotoPath(i.item_photos) ?? [])
  )

  const roomItems: RoomItem[] = (items ?? []).map((i) => {
    const path = firstPhotoPath(i.item_photos)
    const loc = byId.get(i.location_id!)
    return {
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      furnitureId: i.location_id === id ? null : furnitureOf(i.location_id!),
      // 家具の中の引き出しなど、さらに細かい場所名
      subLocation: loc && loc.parent_id !== id && loc.id !== id ? loc.name : null,
      photoUrl: path ? urls.get(path) : undefined,
    }
  })

  const layoutById = new Map((layouts ?? []).map((l) => [l.location_id, l]))
  const children = (locations ?? []).filter((l) => l.parent_id === id)
  const furniture: Furniture[] = children.flatMap((l) => {
    const layout = layoutById.get(l.id)
    return layout ? [{ id: l.id, name: l.name, kind: l.kind, layout }] : []
  })
  const unplaced = children
    .filter((l) => !layoutById.has(l.id))
    .map((l) => ({ id: l.id, name: l.name }))

  // 家 / 部屋 のパンくず（部屋より上の祖先）
  const crumbs: { id: string; name: string; kind: string }[] = []
  for (let cur = room.parent_id ? byId.get(room.parent_id) : undefined; cur && crumbs.length < 10; ) {
    crumbs.unshift(cur)
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }

  return (
    <div className="space-y-4">
      <nav aria-label="パンくず" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href="/homes" className="hover:text-foreground">
          家
        </Link>
        {crumbs.map((c) => (
          <span key={c.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" />
            <Link
              href={c.kind === "home" ? `/homes/${c.id}` : `/items?location=${c.id}`}
              className="hover:text-foreground"
            >
              {c.name}
            </Link>
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <EditableTitle locationId={room.id} name={room.name} />
        <span className="text-sm text-muted-foreground">
          {roomLayout.width_cm / 100}m × {roomLayout.depth_cm / 100}m
        </span>
      </div>
      <RoomEditor
        room={{ id: room.id, name: room.name, layout: roomLayout }}
        furniture={furniture}
        unplaced={unplaced}
        items={roomItems}
      />
    </div>
  )
}
