"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { CARRY_KINDS, isCarryKind } from "@/lib/carry"
import { requireUser } from "@/lib/supabase/server"
import type { Enums } from "@/types/database"

/** 財布・バッグなどを作る。parent_id を指定すると別の持ち物の中に入れる */
export async function createCarry(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim()
  const kind = String(formData.get("kind") ?? "") as Enums<"location_kind">
  const parentId = String(formData.get("parent_id") ?? "") || null
  if (!name || !(CARRY_KINDS as readonly string[]).includes(kind)) return

  const { supabase } = await requireUser()
  if (parentId) {
    // 家や部屋の中には入れない（持ち物は家とは独立して扱う）
    const { data: parent } = await supabase.from("locations").select("kind").eq("id", parentId).single()
    if (!parent || !isCarryKind(parent.kind)) throw new Error("持ち物の中にだけ入れられます")
  }

  const { data, error } = await supabase
    .from("locations")
    .insert({ name, kind, parent_id: parentId })
    .select("id")
    .single()
  if (error) throw new Error("作成できませんでした")

  revalidatePath("/", "layout")
  redirect(`/carry/${data.id}`)
}
