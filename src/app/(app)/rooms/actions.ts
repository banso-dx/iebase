"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  COMPARTMENT_PRESETS,
  DEFAULT_ROOM,
  FURNITURE_PRESETS,
  splitEvenly,
  type CompartmentPreset,
  footprint,
  nextRoomPosition,
  type Layout,
} from "@/lib/rooms"
import { getRoomRects } from "@/lib/data/locations"
import { requireUser } from "@/lib/supabase/server"
import type { Enums } from "@/types/database"

const cm = (fd: FormData, key: string, fallback: number) => {
  const n = Math.round(Number(fd.get(key)))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** 家の中に部屋を作る。既存の部屋（location_id）を指定した場合はその部屋に寸法を付けて家に移す */
export async function createRoom(formData: FormData) {
  const { supabase } = await requireUser()
  const homeId = String(formData.get("home_id") ?? "") || null

  let roomId = String(formData.get("location_id") ?? "")
  if (roomId) {
    await supabase.from("locations").update({ parent_id: homeId }).eq("id", roomId)
  } else {
    const name = String(formData.get("name") ?? "").trim()
    if (!name) return
    const { data, error } = await supabase
      .from("locations")
      .insert({ name, kind: "room", parent_id: homeId })
      .select("id")
      .single()
    if (error) throw new Error("部屋を作成できませんでした")
    roomId = data.id
  }

  const size = {
    width_cm: cm(formData, "width_cm", DEFAULT_ROOM.width),
    depth_cm: cm(formData, "depth_cm", DEFAULT_ROOM.depth),
    height_cm: cm(formData, "height_cm", DEFAULT_ROOM.height),
  }
  const position = homeId
    ? nextRoomPosition(await getRoomRects(supabase, homeId, roomId), size)
    : { x_cm: 0, z_cm: 0 }
  const { error } = await supabase
    .from("location_layouts")
    .upsert({ location_id: roomId, ...size, ...position })
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


// ---------------------------------------------------------------
// 家具の中の段・引き出し（正面図）
// ---------------------------------------------------------------

async function getFurnitureLayout(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  furnitureId: string
) {
  const { data } = await supabase
    .from("location_layouts")
    .select("width_cm, depth_cm, height_cm")
    .eq("location_id", furnitureId)
    .single()
  if (!data) throw new Error("家具が見つかりません")
  return data
}

/** 家具を等分した段を作る（「3段に分割」など） */
export async function addCompartments(furnitureId: string, preset: CompartmentPreset) {
  const { supabase } = await requireUser()
  const furniture = await getFurnitureLayout(supabase, furnitureId)
  const { kind, names } = COMPARTMENT_PRESETS[preset]

  const { data: created, error } = await supabase
    .from("locations")
    .insert(names.map((name, i) => ({ name, kind, parent_id: furnitureId, sort_order: i })))
    .select("id, sort_order")
  if (error || !created) throw new Error("段を作成できませんでした")

  const layouts = splitEvenly(furniture, names.length)
  const { error: layoutError } = await supabase.from("location_layouts").insert(
    created.map((c) => ({ location_id: c.id, ...layouts[c.sort_order] }))
  )
  if (layoutError) throw new Error("段を作成できませんでした")
  revalidatePath("/", "layout")
}

/** 段を1つ追加する（既存の場所を配置する場合は locationId を渡す） */
export async function addCompartment(
  furnitureId: string,
  input: { name: string; kind: Enums<"location_kind"> } | { locationId: string }
) {
  const { supabase } = await requireUser()
  const furniture = await getFurnitureLayout(supabase, furnitureId)

  let locationId: string
  if ("locationId" in input) {
    locationId = input.locationId
  } else {
    const name = input.name.trim()
    if (!name) return
    const { data, error } = await supabase
      .from("locations")
      .insert({ name, kind: input.kind, parent_id: furnitureId })
      .select("id")
      .single()
    if (error) throw new Error("追加できませんでした")
    locationId = data.id
  }

  // 家具の下から 1/4 の高さで、幅いっぱいに置く（後から正面図で調整する）
  const height = Math.max(1, Math.round(furniture.height_cm / 4))
  const { error } = await supabase.from("location_layouts").upsert({
    location_id: locationId,
    x_cm: Math.round(furniture.width_cm / 2),
    z_cm: Math.round(furniture.depth_cm / 2),
    width_cm: furniture.width_cm,
    depth_cm: furniture.depth_cm,
    height_cm: height,
    elevation_cm: 0,
  })
  if (error) throw new Error("追加できませんでした")
  revalidatePath("/", "layout")
}
