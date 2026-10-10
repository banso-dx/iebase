"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireUser } from "@/lib/supabase/server"

export async function createHome(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return

  const { supabase } = await requireUser()
  const { data, error } = await supabase
    .from("locations")
    .insert({ name, kind: "home" })
    .select("id")
    .single()
  if (error) throw new Error("家を作成できませんでした")

  revalidatePath("/", "layout")
  redirect(`/homes/${data.id}`)
}

/** 家に属していない部屋を家の中に移す */
export async function moveRoomToHome(formData: FormData) {
  const roomId = String(formData.get("room_id") ?? "")
  const homeId = String(formData.get("home_id") ?? "")
  if (!roomId || !homeId) return

  const { supabase } = await requireUser()
  await supabase.from("locations").update({ parent_id: homeId }).eq("id", roomId).eq("kind", "room")
  revalidatePath("/", "layout")
}
