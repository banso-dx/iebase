import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"
import { DeleteLocationButton } from "@/components/locations/delete-location-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { getLocationOptions } from "@/lib/data/items"
import { LOCATION_KIND_LABELS } from "@/lib/labels"
import { requireUser } from "@/lib/supabase/server"
import { createLocation } from "./actions"

export const metadata: Metadata = { title: "保管場所" }

export default async function LocationsPage() {
  const { supabase } = await requireUser()
  const [locations, { data: counts }] = await Promise.all([
    getLocationOptions(supabase),
    supabase.from("items").select("location_id").eq("status", "owned").not("location_id", "is", null),
  ])

  const countByLocation = new Map<string, number>()
  for (const { location_id } of counts ?? []) {
    countByLocation.set(location_id!, (countByLocation.get(location_id!) ?? 0) + 1)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">保管場所</h1>
        <p className="text-sm text-muted-foreground">
          「家 / 寝室 / クローゼット」のように、場所の中に場所を作れます。財布やバッグも場所として登録できます。
        </p>
      </div>

      <form action={createLocation} className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto_auto_auto]">
        <Input name="name" placeholder="場所の名前（例：寝室のクローゼット）" required maxLength={100} />
        <NativeSelect name="kind" defaultValue="other" aria-label="種類">
          {Object.entries(LOCATION_KIND_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="parent_id" defaultValue="" aria-label="親の場所">
          <option value="">（最上位）</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.path} の中
            </option>
          ))}
        </NativeSelect>
        <Button type="submit">
          <Plus />
          追加
        </Button>
      </form>

      <ul className="divide-y rounded-xl border bg-card">
        {locations.map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-4 py-3">
            <Link href={`/items?location=${l.id}`} className="min-w-0 flex-1 hover:underline">
              <p className="truncate text-sm font-medium">{l.path}</p>
              <p className="text-xs text-muted-foreground">
                {LOCATION_KIND_LABELS[l.kind]}・{countByLocation.get(l.id) ?? 0}点
              </p>
            </Link>
            <DeleteLocationButton locationId={l.id} name={l.name} />
          </li>
        ))}
        {locations.length === 0 && (
          <li className="px-4 py-12 text-center text-sm text-muted-foreground">
            まだ保管場所がありません
          </li>
        )}
      </ul>
    </div>
  )
}
