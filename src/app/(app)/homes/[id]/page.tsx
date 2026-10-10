import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { HomeEditor } from "@/components/homes/home-editor"
import { EditableTitle } from "@/components/locations/editable-title"
import { getLocationTree } from "@/lib/data/locations"
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link href="/homes" className="text-muted-foreground hover:text-foreground" aria-label="家の一覧へ">
          <ChevronLeft className="size-5" />
        </Link>
        <EditableTitle locationId={home.id} name={home.name} />
      </div>
      <HomeEditor
        homeId={id}
        rooms={rooms.map((r) => ({
          id: r.id,
          name: r.name,
          layout: tree.layoutById.get(r.id)!,
          itemCount: tree.itemCount(r.id),
          furniture: tree.childrenOf(r.id).flatMap((f) => {
            const layout = tree.layoutById.get(f.id)
            return layout ? [{ id: f.id, kind: f.kind, layout }] : []
          }),
        }))}
        candidates={children
          .filter((c) => c.kind === "room" && !tree.layoutById.has(c.id))
          .map((c) => ({ id: c.id, name: c.name }))}
        others={children
          .filter((c) => c.kind !== "room")
          .map((c) => ({ id: c.id, name: c.name, kind: c.kind, itemCount: tree.itemCount(c.id) }))}
      />
    </div>
  )
}
