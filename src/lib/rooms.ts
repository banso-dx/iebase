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

/** 種類ごとの家具の初期サイズ（cm）と色。財布・バッグなどの持ち物は家具として置かない */
export const FURNITURE_PRESETS: Partial<
  Record<Enums<"location_kind">, { width: number; depth: number; height: number; color: string }>
> = {
  closet: { width: 180, depth: 60, height: 200, color: "#c8a27a" },
  shelf: { width: 80, depth: 30, height: 180, color: "#a8b5a2" },
  drawer: { width: 75, depth: 45, height: 100, color: "#d9c2a0" },
  box: { width: 40, depth: 30, height: 30, color: "#9fb4c7" },
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
  room: { width_cm: number; depth_cm: number },
) {
  const { w, d } = footprint(layout)
  const clamp = (v: number, min: number, max: number) =>
    min > max ? (min + max) / 2 : Math.min(Math.max(v, min), max)
  return {
    x: Math.round(clamp(x, w / 2, room.width_cm - w / 2)),
    z: Math.round(clamp(z, d / 2, room.depth_cm - d / 2)),
  }
}

// ---------------------------------------------------------------
// 家の間取り：部屋の x_cm / z_cm は家の座標系での部屋の中心
// ---------------------------------------------------------------

type RoomRect = Pick<Layout, "x_cm" | "z_cm" | "width_cm" | "depth_cm" | "rotation_deg">

/** 部屋の外接矩形（左・右・奥・手前） */
export function roomBounds(r: RoomRect) {
  const { w, d } = footprint(r)
  return { left: r.x_cm - w / 2, right: r.x_cm + w / 2, top: r.z_cm - d / 2, bottom: r.z_cm + d / 2 }
}

/** 家全体の外接矩形。部屋がなければ null */
export function homeBounds(rooms: RoomRect[]) {
  if (rooms.length === 0) return null
  const b = rooms.map(roomBounds)
  return {
    left: Math.min(...b.map((r) => r.left)),
    right: Math.max(...b.map((r) => r.right)),
    top: Math.min(...b.map((r) => r.top)),
    bottom: Math.max(...b.map((r) => r.bottom)),
  }
}

export type SnapGuide = { axis: "x" | "z"; at: number; from: number; to: number }

/**
 * Figma のスマートガイドと同じ考え方で、移動中の部屋の「左端・中心・右端」（奥・中心・手前）を
 * 他の部屋の同じ線に吸着させる。X と Z は独立に判定し、揃った線をガイドとして返す
 */
export function snapRect(x: number, z: number, moving: RoomRect, others: RoomRect[], threshold: number) {
  const { w, d } = footprint(moving)
  const lines = (c: number, size: number) => [c - size / 2, c, c + size / 2]

  let dx: number | null = null
  let dz: number | null = null
  for (const o of others) {
    const ob = roomBounds(o)
    for (const mine of lines(x, w)) {
      for (const theirs of [ob.left, (ob.left + ob.right) / 2, ob.right]) {
        const diff = theirs - mine
        if (Math.abs(diff) <= threshold && (dx === null || Math.abs(diff) < Math.abs(dx))) dx = diff
      }
    }
    for (const mine of lines(z, d)) {
      for (const theirs of [ob.top, (ob.top + ob.bottom) / 2, ob.bottom]) {
        const diff = theirs - mine
        if (Math.abs(diff) <= threshold && (dz === null || Math.abs(diff) < Math.abs(dz))) dz = diff
      }
    }
  }

  const nx = Math.round(x + (dx ?? 0))
  const nz = Math.round(z + (dz ?? 0))
  const me = roomBounds({ ...moving, x_cm: nx, z_cm: nz })

  // 吸着した線と一致する他の部屋の線をガイドとして描く
  const guides: SnapGuide[] = []
  for (const o of others) {
    const ob = roomBounds(o)
    if (dx !== null) {
      for (const at of [me.left, (me.left + me.right) / 2, me.right]) {
        if ([ob.left, (ob.left + ob.right) / 2, ob.right].some((v) => Math.abs(v - at) < 0.5)) {
          guides.push({ axis: "x", at, from: Math.min(me.top, ob.top), to: Math.max(me.bottom, ob.bottom) })
        }
      }
    }
    if (dz !== null) {
      for (const at of [me.top, (me.top + me.bottom) / 2, me.bottom]) {
        if ([ob.top, (ob.top + ob.bottom) / 2, ob.bottom].some((v) => Math.abs(v - at) < 0.5)) {
          guides.push({ axis: "z", at, from: Math.min(me.left, ob.left), to: Math.max(me.right, ob.right) })
        }
      }
    }
  }
  return { x: nx, z: nz, guides }
}

/** 部屋を左から横一列に、奥の壁を揃えて並べる */
export function arrangeInRow<T extends RoomRect & { id: string }>(rooms: T[]) {
  let cursor = 0
  return rooms.map((r) => {
    const { w, d } = footprint(r)
    const pos = { id: r.id, x_cm: Math.round(cursor + w / 2), z_cm: Math.round(d / 2) }
    cursor += w
    return pos
  })
}

/** 既存の部屋の右隣（奥の壁を揃える）に新しい部屋を置く位置 */
export function nextRoomPosition(existing: RoomRect[], size: { width_cm: number; depth_cm: number }) {
  const b = homeBounds(existing)
  if (!b) return { x_cm: Math.round(size.width_cm / 2), z_cm: Math.round(size.depth_cm / 2) }
  return { x_cm: Math.round(b.right + size.width_cm / 2), z_cm: Math.round(b.top + size.depth_cm / 2) }
}
