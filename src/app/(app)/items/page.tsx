import type { Metadata } from "next"
import { Search } from "lucide-react"
import { ItemCard } from "@/components/app/item-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import {
  ITEM_LIST_SELECT,
  firstPhotoPath,
  getCategories,
  getLocationOptions,
  signPhotoPaths,
} from "@/lib/data/items"
import { ITEM_STATUS_LABELS } from "@/lib/labels"
import { requireUser } from "@/lib/supabase/server"
import type { Enums } from "@/types/database"

export const metadata: Metadata = { title: "モノ一覧" }

const param = (v: string | string[] | undefined) => (typeof v === "string" ? v : "")

export default async function ItemsPage({ searchParams }: PageProps<"/items">) {
  const sp = await searchParams
  const q = param(sp.q).trim()
  const category = param(sp.category)
  const location = param(sp.location)
  // 既定は所有中のみ。"all" で全件
  const status = param(sp.status) || "owned"

  const { supabase } = await requireUser()

  let query = supabase.from("items").select(ITEM_LIST_SELECT).order("created_at", { ascending: false })
  // PostgREST の or 構文と LIKE のワイルドカードを壊す文字は除去する
  const keyword = q.replace(/[%_\\,()"]/g, " ").trim()
  if (keyword) {
    query = query.or(`name.ilike.%${keyword}%,brand.ilike.%${keyword}%,notes.ilike.%${keyword}%`)
  }
  if (category) query = query.eq("category_id", Number(category))
  if (location) query = query.eq("location_id", location)
  if (status !== "all") query = query.eq("status", status as Enums<"item_status">)

  const [{ data: items }, categories, locations] = await Promise.all([
    query.limit(200),
    getCategories(supabase),
    getLocationOptions(supabase),
  ])

  const urls = await signPhotoPaths(
    supabase,
    (items ?? []).flatMap((i) => firstPhotoPath(i.item_photos) ?? [])
  )

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">モノ一覧</h1>

      <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="名前・ブランド・メモで検索" className="pl-8" />
        </div>
        <NativeSelect name="category" defaultValue={category} aria-label="カテゴリ">
          <option value="">すべてのカテゴリ</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="location" defaultValue={location} aria-label="保管場所">
          <option value="">すべての場所</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.path}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={status} aria-label="状態">
          {Object.entries(ITEM_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          <option value="all">すべての状態</option>
        </NativeSelect>
        <Button type="submit" variant="secondary">
          絞り込む
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">{items?.length ?? 0}件</p>

      <div className="space-y-2">
        {(items ?? []).map((i) => {
          const path = firstPhotoPath(i.item_photos)
          return <ItemCard key={i.id} item={{ ...i, photoUrl: path ? urls.get(path) : undefined }} />
        })}
        {items?.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">該当するモノがありません</p>
        )}
      </div>
    </div>
  )
}
