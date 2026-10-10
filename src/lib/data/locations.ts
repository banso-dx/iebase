import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/types/database"

type Client = SupabaseClient<Database>
type Loc = Pick<Tables<"locations">, "id" | "name" | "kind" | "parent_id">
type LayoutRow = Tables<"location_layouts">

/** 保管場所の木構造と、所有中のモノの点数をまとめて取得する */
export async function getLocationTree(supabase: Client) {
  const [{ data: locations }, { data: layouts }, { data: items }] = await Promise.all([
    supabase.from("locations").select("id, name, kind, parent_id").order("sort_order").order("name"),
    supabase.from("location_layouts").select("*"),
    supabase.from("items").select("location_id, quantity").eq("status", "owned"),
  ])
  return new LocationTree(locations ?? [], layouts ?? [], items ?? [])
}

export class LocationTree {
  readonly byId: Map<string, Loc>
  readonly layoutById: Map<string, LayoutRow>
  private readonly children = new Map<string | null, Loc[]>()
  private readonly directCount = new Map<string, number>()

  constructor(
    readonly locations: Loc[],
    layouts: LayoutRow[],
    items: { location_id: string | null; quantity: number }[]
  ) {
    this.byId = new Map(locations.map((l) => [l.id, l]))
    this.layoutById = new Map(layouts.map((l) => [l.location_id, l]))
    for (const l of locations) {
      // 親が消えている場所は最上位として扱う
      const parent = l.parent_id && this.byId.has(l.parent_id) ? l.parent_id : null
      this.children.set(parent, [...(this.children.get(parent) ?? []), l])
    }
    for (const i of items) {
      if (i.location_id) this.directCount.set(i.location_id, (this.directCount.get(i.location_id) ?? 0) + i.quantity)
    }
  }

  childrenOf(id: string | null) {
    return this.children.get(id) ?? []
  }

  /** 自分を含む子孫すべて */
  descendants(id: string): Loc[] {
    const result: Loc[] = []
    const seen = new Set<string>()
    const walk = (cur: string) => {
      const loc = this.byId.get(cur)
      if (!loc || seen.has(cur)) return
      seen.add(cur)
      result.push(loc)
      this.childrenOf(cur).forEach((c) => walk(c.id))
    }
    walk(id)
    return result
  }

  /** 最上位から自分までの並び */
  ancestors(id: string): Loc[] {
    const chain: Loc[] = []
    const seen = new Set<string>()
    let cur = this.byId.get(id)
    while (cur && !seen.has(cur.id)) {
      chain.unshift(cur)
      seen.add(cur.id)
      cur = cur.parent_id ? this.byId.get(cur.parent_id) : undefined
    }
    return chain
  }

  /** 子孫も含めた所有中のモノの点数 */
  itemCount(id: string) {
    return this.descendants(id).reduce((n, l) => n + (this.directCount.get(l.id) ?? 0), 0)
  }

  /** 部屋が属する家（祖先のうち kind = 'home' のもの） */
  homeOf(id: string) {
    return this.ancestors(id).find((l) => l.kind === "home" && l.id !== id) ?? null
  }
}
