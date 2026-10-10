import type { SupabaseClient } from "@supabase/supabase-js"
import { isCarryKind } from "@/lib/carry"
import type { Database, Tables } from "@/types/database"

type Client = SupabaseClient<Database>

export const ITEM_LIST_SELECT =
  "id, name, brand, status, quantity, purchase_price, purchased_at, expires_at, categories(name), locations(name), item_photos(storage_path, sort_order)" as const

export const PHOTO_BUCKET = "item-photos"

/** 非公開バケットの写真に署名付き URL を付与する（1 時間有効） */
export async function signPhotoPaths(supabase: Client, paths: string[]) {
  if (paths.length === 0) return new Map<string, string>()
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60)
  return new Map(
    (data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : []))
  )
}

export function firstPhotoPath(photos: Pick<Tables<"item_photos">, "storage_path" | "sort_order">[]) {
  return [...photos].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path
}

/** 保管場所を「家 / 寝室 / クローゼット」形式のパス付きで返す。group は家側か持ち物か */
export async function getLocationOptions(supabase: Client) {
  const { data } = await supabase
    .from("locations")
    .select("id, name, kind, parent_id, sort_order")
    .order("sort_order")
    .order("name")
  const locations = data ?? []
  const byId = new Map(locations.map((l) => [l.id, l]))

  const pathOf = (id: string, seen = new Set<string>()): string => {
    const loc = byId.get(id)
    if (!loc) return ""
    if (!loc.parent_id || seen.has(id)) return loc.name
    seen.add(id)
    return `${pathOf(loc.parent_id, seen)} / ${loc.name}`
  }

  const isCarry = (id: string, seen = new Set<string>()): boolean => {
    const loc = byId.get(id)
    if (!loc || seen.has(id)) return false
    seen.add(id)
    return isCarryKind(loc.kind) || (loc.parent_id ? isCarry(loc.parent_id, seen) : false)
  }

  return locations
    .map((l) => ({ ...l, path: pathOf(l.id), group: isCarry(l.id) ? ("carry" as const) : ("home" as const) }))
    .sort((a, b) => a.path.localeCompare(b.path, "ja"))
}

export async function getCategories(supabase: Client) {
  const { data } = await supabase.from("categories").select("id, name, slug").order("sort_order")
  return data ?? []
}
