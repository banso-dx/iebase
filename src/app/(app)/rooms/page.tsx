import type { Metadata } from "next"
import Link from "next/link"
import { Box, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { DEFAULT_ROOM } from "@/lib/rooms"
import { requireUser } from "@/lib/supabase/server"
import { createRoom } from "./actions"

export const metadata: Metadata = { title: "ルーム" }

export default async function RoomsPage() {
  const { supabase } = await requireUser()
  const [{ data: locations }, { data: layouts }] = await Promise.all([
    supabase.from("locations").select("id, name, kind, parent_id").order("name"),
    supabase.from("location_layouts").select("location_id, width_cm, depth_cm"),
  ])

  const layoutById = new Map((layouts ?? []).map((l) => [l.location_id, l]))
  const rooms = (locations ?? []).filter((l) => l.kind === "room" && layoutById.has(l.id))
  // 寸法未設定の「部屋」は 3D 化の候補として出す
  const candidates = (locations ?? []).filter((l) => l.kind === "room" && !layoutById.has(l.id))
  const furnitureCount = (roomId: string) =>
    (locations ?? []).filter((l) => l.parent_id === roomId && layoutById.has(l.id)).length

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">ルーム</h1>
        <p className="text-sm text-muted-foreground">
          部屋を3Dで再現して、どこに何があるかを見える化します。
        </p>
      </div>

      {rooms.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => {
            const l = layoutById.get(r.id)!
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
                      {l.width_cm / 100}m × {l.depth_cm / 100}m・家具 {furnitureCount(r.id)}点
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <form action={createRoom} className="max-w-xl space-y-4 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">部屋を作る</h2>
        {candidates.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="location_id">登録済みの部屋を使う</Label>
            <NativeSelect id="location_id" name="location_id" defaultValue="">
              <option value="">新しく作る</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="name">部屋の名前</Label>
          <Input id="name" name="name" placeholder="例：寝室" maxLength={100} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["width_cm", "幅", DEFAULT_ROOM.width],
              ["depth_cm", "奥行き", DEFAULT_ROOM.depth],
              ["height_cm", "天井高", DEFAULT_ROOM.height],
            ] as const
          ).map(([name, label, value]) => (
            <div key={name} className="space-y-1.5">
              <Label htmlFor={name}>{label}（cm）</Label>
              <Input id={name} name={name} type="number" min={50} defaultValue={value} />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">6畳はおよそ 360 × 270 cm です。</p>
        <Button type="submit">
          <Plus />
          作成して配置する
        </Button>
      </form>
    </div>
  )
}
