import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, House, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { getLocationTree } from "@/lib/data/locations"
import { requireUser } from "@/lib/supabase/server"
import { createHome, moveRoomToHome } from "./actions"

export const metadata: Metadata = { title: "家" }

export default async function HomesPage() {
  const { supabase } = await requireUser()
  const tree = await getLocationTree(supabase)

  const homes = tree.locations.filter((l) => l.kind === "home")
  const orphanRooms = tree.locations.filter((l) => l.kind === "room" && !tree.homeOf(l.id))

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">家</h1>
        <p className="text-sm text-muted-foreground">
          家 → 部屋 → 棚やクローゼット の順にたどって、どこに何があるかを確認できます。
        </p>
      </div>

      {homes.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {homes.map((h) => {
            const rooms = tree.childrenOf(h.id).filter((c) => c.kind === "room")
            return (
              <li key={h.id}>
                <Link
                  href={`/homes/${h.id}`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
                >
                  <span className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <House className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{h.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      部屋 {rooms.length}・モノ {tree.itemCount(h.id)}点
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <form action={createHome} className="flex max-w-xl gap-2 rounded-xl border bg-card p-4">
        <Input name="name" placeholder="家の名前（例：自宅、実家）" required maxLength={100} />
        <Button type="submit">
          <Plus />
          家を作る
        </Button>
      </form>

      {orphanRooms.length > 0 && (
        <section className="max-w-xl space-y-3 rounded-xl border border-dashed p-4">
          <div className="space-y-1">
            <h2 className="font-semibold">家に属していない部屋</h2>
            <p className="text-xs text-muted-foreground">
              {homes.length > 0 ? "どの家の部屋か選んでください。" : "先に家を作ると、部屋を移せます。"}
            </p>
          </div>
          <ul className="space-y-2">
            {orphanRooms.map((r) => (
              <li key={r.id}>
                <form action={moveRoomToHome} className="flex items-center gap-2">
                  <input type="hidden" name="room_id" value={r.id} />
                  <span className="flex-1 truncate text-sm">{r.name}</span>
                  {homes.length > 0 && (
                    <>
                      <NativeSelect name="home_id" aria-label={`${r.name}を移す家`} required defaultValue="">
                        <option value="" disabled>
                          家を選択
                        </option>
                        {homes.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                      </NativeSelect>
                      <Button type="submit" variant="outline" size="sm">
                        移す
                      </Button>
                    </>
                  )}
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
