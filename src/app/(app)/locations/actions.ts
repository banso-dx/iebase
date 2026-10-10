"use server"

import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/supabase/server"
import type { Enums } from "@/types/database"

export async function createLocation(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return

  const parentId = String(formData.get("parent_id") ?? "") || null
  const kind = (String(formData.get("kind") ?? "") || "other") as Enums<"location_kind">

  const { supabase } = await requireUser()
  await supabase.from("locations").insert({ name, kind, parent_id: parentId })
  revalidatePath("/locations")
}

/** 子の場所は親を失い（トップレベルに移動）、中のモノは「場所未設定」になる */
export async function deleteLocation(locationId: string) {
  const { supabase } = await requireUser()
  await supabase.from("locations").delete().eq("id", locationId)
  revalidatePath("/", "layout")
}

export async function renameLocation(locationId: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 100) throw new Error("名前は1〜100文字で入力してください")

  const { supabase } = await requireUser()
  const { error } = await supabase.from("locations").update({ name: trimmed }).eq("id", locationId)
  if (error) throw new Error("名前を変更できませんでした")
  revalidatePath("/", "layout")
}
