import type { Metadata } from "next"
import { ItemForm } from "@/components/items/item-form"
import { getCategories, getLocationOptions } from "@/lib/data/items"
import { requireUser } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "モノを登録" }

export default async function NewItemPage({ searchParams }: PageProps<"/items/new">) {
  const { location } = await searchParams
  const { supabase, user } = await requireUser()
  const [categories, locations] = await Promise.all([
    getCategories(supabase),
    getLocationOptions(supabase),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">モノを登録</h1>
      <ItemForm
        userId={user.id}
        defaultLocationId={typeof location === "string" ? location : undefined}
        categories={categories.map((c) => ({ id: c.id, label: c.name }))}
        locations={locations.map((l) => ({ id: l.id, label: l.path }))}
      />
    </div>
  )
}
