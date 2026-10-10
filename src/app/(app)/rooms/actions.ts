"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { DEFAULT_ROOM, FURNITURE_PRESETS, footprint, type Layout } from "@/lib/rooms"
import { requireUser } from "@/lib/supabase/server"
import type { Enums } from "@/types/database"

const cm = (fd: FormData, key: string, fallback: number) => {
  const n = Math.round(Number(fd.get(key)))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** 部屋を作る。既存の場所（location_id）を指定した場合はその場所に寸法を付ける */
export async function createRoom(formData: FormData) {
  const { supabase } = await requireUser()

  let roomId = String(formData.get("location_id") ?? "")
  if (!roomId) {
    const name = String(formData.get("name") ?? "").trim()
    if (!name) return
    const { data, error } = await supabase
      .from("locations")
      .insert({ name, kind: "room" })
      .select("id")
      .single()
    if (error) throw new Error("部屋を作成できませんでした")
    roomId = data.id
  }

  const { error } = await supabase.from("location_layouts").upsert({
    location_id: roomId,
    width_cm: cm(formData, "width_cm", DEFAULT_ROOM.width),
    depth_cm: cm(formData, "depth_cm", DEFAULT_ROOM.depth),
    height_cm: cm(formData, "height_cm", DEFAULT_ROOM.height),
  })
  if (error) throw new Error("部屋を作成できませんでした")

  revalidatePath("/", "layout")
  redirect(`/rooms/${roomId}`)
}

/** 新しい家具（＝部屋の子の保管場所）を作り、部屋の中央に置く */
export async function addFurniture(
  roomId: string,
  input: { name: string; kind: Enums<"location_kind"> }
) {
  const { supabase } = await requireUser()
  const name = input.name.trim()
  if (!name) return

  const { data: room } = await supabase
    .from("location_layouts")
    .select("width_cm, depth_cm")
    .eq("location_id", roomId)
    .single()
  if (!room) throw new Error("部屋が見つかりません")

  const { data: loc, error } = await supabase
    .from("locations")
    .insert({ name, kind: input.kind, parent_id: roomId })
    .select("id")
    .single()
  if (error) throw new Error("家具を追加できませんでした")

  await placeInFreeSpot(supabase, roomId, loc.id, input.kind, room)
  revalidatePath("/", "layout")
}

/** 部屋の中にあるが未配置の保管場所を配置する */
export async function placeLocation(roomId: string, locationId: string) {
  const { supabase } = await requireUser()
  const [{ data: room }, { data: loc }] = await Promise.all([
    supabase.from("location_layouts").select("width_cm, depth_cm").eq("location_id", roomId).single(),
    supabase.from("locations").select("kind").eq("id", locationId).eq("parent_id", roomId).single(),
  ])
  if (!room || !loc) throw new Error("配置できませんでした")

  await placeInFreeSpot(supabase, roomId, locationId, loc.kind, room)
  revalidatePath("/", "layout")
}

/** 奥の壁沿いに左から詰めて置く。空きがなければ部屋の中央に置く */
async function placeInFreeSpot(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  roomId: string,
  locationId: string,
  kind: Enums<"location_kind">,
  room: { width_cm: number; depth_cm: number }
) {
  const preset = FURNITURE_PRESETS[kind] ?? FURNITURE_PRESETS.other!

  const { data: siblings } = await supabase
    .from("locations")
    .select("location_layouts(width_cm, depth_cm, x_cm, z_cm, rotation_deg)")
    .eq("parent_id", roomId)
  const occupied = (siblings ?? []).flatMap((s) => (s.location_layouts ? [s.location_layouts] : []))
  const overlaps = (x: number, z: number) =>
    occupied.some((o) => {
      const f = footprint(o)
      return (
        Math.abs(o.x_cm - x) < (f.w + preset.width) / 2 &&
        Math.abs(o.z_cm - z) < (f.d + preset.depth) / 2
      )
    })

  const z = preset.depth / 2
  let x = Math.round(room.width_cm / 2)
  let zPos = Math.round(room.depth_cm / 2)
  for (let left = 0; left + preset.width <= room.width_cm; left += 10) {
    if (!overlaps(left + preset.width / 2, z)) {
      x = Math.round(left + preset.width / 2)
      zPos = Math.round(z)
      break
    }
  }

  const { error } = await supabase.from("location_layouts").insert({
    location_id: locationId,
    width_cm: preset.width,
    depth_cm: preset.depth,
    height_cm: preset.height,
    x_cm: x,
    z_cm: zPos,
  })
  if (error) throw new Error("配置できませんでした")
}

/** ドラッグ中に頻繁に呼ばれるため再検証はしない（画面側は手元の状態で表示している） */
export async function updateLayout(locationId: string, patch: Partial<Layout>) {
  const { supabase } = await requireUser()
  const { error } = await supabase.from("location_layouts").update(patch).eq("location_id", locationId)
  if (error) throw new Error("保存できませんでした")
}

/** 3D 上から外すだけで、保管場所とモノはそのまま残る */
export async function removeFromLayout(locationId: string) {
  const { supabase } = await requireUser()
  await supabase.from("location_layouts").delete().eq("location_id", locationId)
  revalidatePath("/rooms", "layout")
}
