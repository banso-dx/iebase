import type { Metadata } from "next"
import { Box, Folder, House, Plus } from "lucide-react"
import { CarryIcon } from "@/components/carry/carry-icon"
import { LocationExplorer } from "@/components/locations/location-explorer"
import type { TreeNode } from "@/components/plan/folder-tree"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { isCarryKind } from "@/lib/carry"
import { getLocationOptions } from "@/lib/data/items"
import { getLocationTree } from "@/lib/data/locations"
import { LOCATION_KIND_LABELS } from "@/lib/labels"
import { requireUser } from "@/lib/supabase/server"
import type { Enums } from "@/types/database"
import { createLocation } from "./actions"

export const metadata: Metadata = { title: "保管場所" }

export default async function LocationsPage() {
  const { supabase } = await requireUser()
  const [locations, tree, { data: items }] = await Promise.all([
    getLocationOptions(supabase),
    getLocationTree(supabase),
    supabase.from("items").select("id, name, quantity, location_id").eq("status", "owned").order("name"),
  ])

  const itemsAt = new Map<string, TreeNode[]>()
  for (const i of items ?? []) {
    if (!i.location_id) continue
    itemsAt.set(i.location_id, [
      ...(itemsAt.get(i.location_id) ?? []),
      {
        id: `item:${i.id}`,
        name: i.name,
        meta: i.quantity > 1 ? `×${i.quantity}` : undefined,
        href: `/items/${i.id}`,
      },
    ])
  }

  const hrefOf = (l: { id: string; kind: Enums<"location_kind"> }) => {
    if (l.kind === "home") return `/homes/${l.id}`
    if (l.kind === "room" && tree.layoutById.has(l.id)) return `/rooms/${l.id}`
    if (tree.isCarry(l.id)) return `/carry/${l.id}`
    return `/items?location=${l.id}`
  }
  const toNode = (l: { id: string; name: string; kind: Enums<"location_kind"> }): TreeNode => ({
    id: l.id,
    name: l.name,
    meta: `${tree.itemCount(l.id)}`,
    icon: <LocationIcon kind={l.kind} />,
    children: [...tree.childrenOf(l.id).map(toNode), ...(itemsAt.get(l.id) ?? [])],
  })

  // 家 → 持ち物 → その他 の順に並べる
  const roots = tree.childrenOf(null)
  const order = (k: string) => (k === "home" ? 0 : isCarryKind(k as Enums<"location_kind">) ? 1 : 2)
  const nodes = [...roots].sort((a, b) => order(a.kind) - order(b.kind)).map(toNode)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">保管場所</h1>
        <p className="text-sm text-muted-foreground">
          家 › 部屋 › 棚 › 段
          のように、保管場所をフォルダとして管理します。モノはフォルダの中のファイルとして表示されます。
        </p>
      </div>

      <LocationExplorer
        nodes={nodes}
        folders={locations.map((l) => ({
          id: l.id,
          path: l.path,
          kindLabel: LOCATION_KIND_LABELS[l.kind],
          itemCount: tree.itemCount(l.id),
          href: hrefOf(l),
        }))}
      />

      <form
        action={createLocation}
        className="grid max-w-3xl gap-2 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto_auto_auto]"
      >
        <Input name="name" placeholder="フォルダ（場所）の名前" required maxLength={100} />
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
    </div>
  )
}

function LocationIcon({ kind }: { kind: Enums<"location_kind"> }) {
  const className = "size-3.5 shrink-0 text-muted-foreground"
  if (kind === "home") return <House className={className} />
  if (kind === "room") return <Box className={className} />
  if (isCarryKind(kind)) return <CarryIcon kind={kind} className={className} />
  return <Folder className={className} />
}
