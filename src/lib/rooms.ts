import type { Enums } from "@/types/database"

export type Layout = {
  width_cm: number
  depth_cm: number
  height_cm: number
  x_cm: number
  z_cm: number
  elevation_cm: number
  rotation_deg: number
  color: string | null
}

/** 種類ごとの家具の初期サイズ（cm）と色 */
export const FURNITURE_PRESETS: Partial<
  Record<Enums<"location_kind">, { width: number; depth: number; height: number; color: string }>
> = {
  closet: { width: 180, depth: 60, height: 200, color: "#c8a27a" },
  shelf: { width: 80, depth: 30, height: 180, color: "#a8b5a2" },
  drawer: { width: 75, depth: 45, height: 100, color: "#d9c2a0" },
  box: { width: 40, depth: 30, height: 30, color: "#9fb4c7" },
  bag: { width: 30, depth: 15, height: 25, color: "#b39ddb" },
  wallet: { width: 20, depth: 10, height: 3, color: "#8d6e63" },
  other: { width: 60, depth: 60, height: 60, color: "#bdbdbd" },
}

export const FURNITURE_KINDS = Object.keys(FURNITURE_PRESETS) as Enums<"location_kind">[]

export const DEFAULT_ROOM = { width: 360, depth: 270, height: 240 }

export function colorFor(kind: Enums<"location_kind">, layout: Pick<Layout, "color">) {
  return layout.color ?? FURNITURE_PRESETS[kind]?.color ?? "#bdbdbd"
}

/** 回転を考慮した、真上から見たときの外接サイズ */
export function footprint(layout: Pick<Layout, "width_cm" | "depth_cm" | "rotation_deg">) {
  const r = (layout.rotation_deg * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  return {
    w: layout.width_cm * c + layout.depth_cm * s,
    d: layout.width_cm * s + layout.depth_cm * c,
  }
}

/** 家具が部屋からはみ出さないよう中心座標を制限する */
export function clampToRoom(
  x: number,
  z: number,
  layout: Pick<Layout, "width_cm" | "depth_cm" | "rotation_deg">,
  room: { width_cm: number; depth_cm: number }
) {
  const { w, d } = footprint(layout)
  const clamp = (v: number, min: number, max: number) =>
    min > max ? (min + max) / 2 : Math.min(Math.max(v, min), max)
  return {
    x: Math.round(clamp(x, w / 2, room.width_cm - w / 2)),
    z: Math.round(clamp(z, d / 2, room.depth_cm - d / 2)),
  }
}
