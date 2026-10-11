import { describe, expect, it } from "vitest"
import {
  arrangeInRow,
  clampToRoom,
  footprint,
  fromElevationCanvas,
  homeBounds,
  nextRoomPosition,
  snapRect,
  splitEvenly,
  toElevationCanvas,
  type Layout,
} from "./rooms"

const rect = (x: number, z: number, w: number, d: number, rot = 0) => ({
  x_cm: x,
  z_cm: z,
  width_cm: w,
  depth_cm: d,
  rotation_deg: rot,
})

describe("footprint", () => {
  it("回転なしなら幅と奥行きのまま", () => {
    expect(footprint({ width_cm: 100, depth_cm: 40, rotation_deg: 0 })).toEqual({ w: 100, d: 40 })
  })
  it("90度回転で幅と奥行きが入れ替わる", () => {
    const f = footprint({ width_cm: 100, depth_cm: 40, rotation_deg: 90 })
    expect(f.w).toBeCloseTo(40)
    expect(f.d).toBeCloseTo(100)
  })
})

describe("clampToRoom", () => {
  const room = { width_cm: 360, depth_cm: 270 }
  const sofa = { width_cm: 100, depth_cm: 40, rotation_deg: 0 }
  it("部屋の中ならそのまま", () => {
    expect(clampToRoom(180, 135, sofa, room)).toEqual({ x: 180, z: 135 })
  })
  it("はみ出す分だけ内側に寄せる", () => {
    expect(clampToRoom(-50, 999, sofa, room)).toEqual({ x: 50, z: 250 })
  })
  it("部屋より大きい家具は中央に置く", () => {
    const big = { width_cm: 500, depth_cm: 40, rotation_deg: 0 }
    expect(clampToRoom(0, 135, big, room).x).toBe(180)
  })
})

describe("homeBounds / nextRoomPosition", () => {
  it("部屋がなければ null", () => {
    expect(homeBounds([])).toBeNull()
  })
  it("全部屋を含む外接矩形を返す", () => {
    const b = homeBounds([rect(100, 100, 200, 200), rect(300, 150, 200, 100)])
    expect(b).toEqual({ left: 0, right: 400, top: 0, bottom: 200 })
  })
  it("最初の部屋は原点に角を合わせる", () => {
    expect(nextRoomPosition([], { width_cm: 360, depth_cm: 270 })).toEqual({ x_cm: 180, z_cm: 135 })
  })
  it("既存の部屋の右隣に、奥の壁を揃えて置く", () => {
    const pos = nextRoomPosition([rect(100, 100, 200, 200)], { width_cm: 100, depth_cm: 80 })
    expect(pos).toEqual({ x_cm: 250, z_cm: 40 })
  })
})

describe("arrangeInRow", () => {
  it("左から奥の壁を揃えて並べる", () => {
    const rooms = [
      { id: "a", ...rect(0, 0, 200, 100) },
      { id: "b", ...rect(0, 0, 100, 300) },
    ]
    expect(arrangeInRow(rooms)).toEqual([
      { id: "a", x_cm: 100, z_cm: 50 },
      { id: "b", x_cm: 250, z_cm: 150 },
    ])
  })
})

describe("snapRect", () => {
  const other = rect(100, 100, 200, 200) // left 0, right 200, top 0, bottom 200
  it("しきい値内なら隣の壁に吸着しガイドを返す", () => {
    const r = snapRect(303, 100, rect(0, 0, 200, 200), [other], 8)
    expect(r.x).toBe(300) // 左端が相手の右端(200)に揃う
    expect(r.guides.some((g) => g.axis === "x" && g.at === 200)).toBe(true)
  })
  it("しきい値の外なら動かさない", () => {
    const r = snapRect(350, 400, rect(0, 0, 200, 200), [other], 8)
    expect(r).toEqual({ x: 350, z: 400, guides: [] })
  })
})

describe("正面図の座標変換", () => {
  const shelf: Layout = {
    x_cm: 40,
    z_cm: 15,
    width_cm: 80,
    depth_cm: 30,
    height_cm: 50,
    elevation_cm: 100,
    rotation_deg: 30,
    color: null,
  }
  it("画面座標では上端からの位置になり、回転は 0 になる", () => {
    const c = toElevationCanvas(shelf, 180)
    expect(c.z_cm).toBe(55) // 180 - 100 - 25
    expect(c.depth_cm).toBe(50)
    expect(c.rotation_deg).toBe(0)
  })
  it("往復しても段の位置とサイズが変わらない", () => {
    const back = fromElevationCanvas(toElevationCanvas(shelf, 180), 180)
    expect(back).toEqual({ x_cm: 40, width_cm: 80, height_cm: 50, elevation_cm: 100 })
  })
  it("底より下には出ない", () => {
    const c = { ...toElevationCanvas(shelf, 180), z_cm: 999 }
    expect(fromElevationCanvas(c, 180).elevation_cm).toBe(0)
  })
})

describe("splitEvenly", () => {
  it("高さを等分し、最初の段が一番上になる", () => {
    const rows = splitEvenly({ width_cm: 80, depth_cm: 30, height_cm: 180 }, 3)
    expect(rows.map((r) => r.height_cm)).toEqual([60, 60, 60])
    expect(rows.map((r) => r.elevation_cm)).toEqual([120, 60, 0])
  })
})
