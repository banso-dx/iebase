"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getRoomRects } from "@/lib/data/locations"
import { nextRoomPosition } from "@/lib/rooms"
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

  // 寸法のある部屋は、家の既存の部屋の右隣に置く
  const { data: layout } = await supabase
    .from("location_layouts")
    .select("width_cm, depth_cm")
    .eq("location_id", roomId)
    .maybeSingle()
  if (layout) {
    const position = nextRoomPosition(await getRoomRects(supabase, homeId, roomId), layout)
    await supabase.from("location_layouts").update(position).eq("location_id", roomId)
  }
  revalidatePath("/", "layout")
}

/** 間取りの「自動で並べる」など、複数の部屋の位置をまとめて保存する */
export async function saveRoomPositions(positions: { id: string; x_cm: number; z_cm: number }[]) {
  const { supabase } = await requireUser()
  const results = await Promise.all(
    positions.map(({ id, x_cm, z_cm }) =>
      supabase.from("location_layouts").update({ x_cm, z_cm }).eq("location_id", id)
    )
  )
  if (results.some((r) => r.error)) throw new Error("配置を保存できませんでした")
  revalidatePath("/homes", "layout")
}
