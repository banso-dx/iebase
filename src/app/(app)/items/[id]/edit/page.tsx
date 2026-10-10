import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ItemForm } from "@/components/items/item-form"
import { getCategories, getLocationOptions, signPhotoPaths } from "@/lib/data/items"
import { requireUser } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "モノを編集" }

export default async function EditItemPage({ params }: PageProps<"/items/[id]/edit">) {
  const { id } = await params
  const { supabase, user } = await requireUser()

  const [{ data: item }, { data: photos }, categories, locations] = await Promise.all([
    supabase.from("items").select("*").eq("id", id).maybeSingle(),
    supabase.from("item_photos").select("id, storage_path").eq("item_id", id).order("sort_order"),
    getCategories(supabase),
    getLocationOptions(supabase),
  ])
  if (!item) notFound()

  const urls = await signPhotoPaths(supabase, (photos ?? []).map((p) => p.storage_path))

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">モノを編集</h1>
      <ItemForm
        userId={user.id}
        item={item}
        photos={(photos ?? []).map((p) => ({ ...p, url: urls.get(p.storage_path) }))}
        categories={categories.map((c) => ({ id: c.id, label: c.name }))}
        locations={locations.map((l) => ({ id: l.id, label: l.path }))}
      />
    </div>
  )
}
