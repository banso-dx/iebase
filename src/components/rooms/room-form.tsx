import { Plus } from "lucide-react"
import { createRoom } from "@/app/(app)/rooms/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { DEFAULT_ROOM } from "@/lib/rooms"

/** 家の中に部屋を作る。candidates は寸法未設定の既存の部屋 */
export function RoomForm({
  homeId,
  candidates,
}: {
  homeId: string
  candidates: { id: string; name: string }[]
}) {
  return (
    <form action={createRoom} className="space-y-4 rounded-xl border bg-card p-4">
      <input type="hidden" name="home_id" value={homeId} />
      <h2 className="font-semibold">部屋を追加</h2>
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
  )
}
