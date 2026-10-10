"use client"

import { useRef, useState } from "react"
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber"
import { Edges, Grid, OrbitControls } from "@react-three/drei"
import { Plane, Vector3 } from "three"
import { clampToRoom, colorFor, type Layout } from "@/lib/rooms"
import type { Enums } from "@/types/database"

export type SceneFurniture = {
  id: string
  name: string
  kind: Enums<"location_kind">
  layout: Layout
  itemCount: number
}

type Props = {
  room: Pick<Layout, "width_cm" | "depth_cm" | "height_cm">
  furniture: SceneFurniture[]
  selectedId: string | null
  editing: boolean
  onSelect: (id: string | null) => void
  onMove: (id: string, pos: { x_cm: number; z_cm: number }) => void
  onMoveEnd: (id: string) => void
}

const WALL_THICKNESS = 0.05
const FLOOR_PLANE = new Plane(new Vector3(0, 1, 0), 0)

/**
 * 座標系: 部屋の左奥の床を原点に cm で保存し、描画時は部屋の中心を原点としたメートルに変換する
 */
export function RoomScene({ room, furniture, selectedId, editing, onSelect, onMove, onMoveEnd }: Props) {
  const w = room.width_cm / 100
  const d = room.depth_cm / 100
  const h = room.height_cm / 100
  // state は OrbitControls の切り替え用。イベント内の判定は再描画を待たずに済む ref で行う
  const [dragging, setDragging] = useState<string | null>(null)
  const draggingRef = useRef<string | null>(null)
  const grabOffset = useRef({ x: 0, z: 0 })
  const hit = useRef(new Vector3())

  const toRoomCm = (e: ThreeEvent<PointerEvent>) => {
    if (!e.ray.intersectPlane(FLOOR_PLANE, hit.current)) return null
    return {
      x: (hit.current.x + w / 2) * 100,
      z: (hit.current.z + d / 2) * 100,
    }
  }

  const labelRefs = useRef(new Map<string, HTMLButtonElement>())
  const anchors = furniture.map((f) => ({
    id: f.id,
    position: [
      f.layout.x_cm / 100 - w / 2,
      (f.layout.elevation_cm + f.layout.height_cm) / 100 + 0.05,
      f.layout.z_cm / 100 - d / 2,
    ] as const,
  }))

  return (
    <div className="relative size-full">
      <Canvas
        camera={{ position: [w * 1.1, Math.max(w, d) * 1.5, d * 2.1], fov: 40 }}
        shadows="percentage"
        onPointerMissed={() => !draggingRef.current && onSelect(null)}
      >
        <color attach="background" args={["#f4f2ee"]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[w, h * 3, d * 2]} intensity={1.1} castShadow />

        {/* 床 */}
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color="#e6dccd" />
        </mesh>
        {/* 50cm 方眼 */}
        <Grid
          args={[w, d]}
          position-y={0.002}
          cellSize={0.5}
          cellColor="#d2c6b4"
          sectionSize={0}
          cellThickness={0.8}
          fadeDistance={100}
        />

        {/* 奥と左の壁（手前側は視界を遮るので描かない） */}
        <mesh position={[0, h / 2, -d / 2 - WALL_THICKNESS / 2]} receiveShadow>
          <boxGeometry args={[w + WALL_THICKNESS * 2, h, WALL_THICKNESS]} />
          <meshStandardMaterial color="#faf8f5" />
        </mesh>
        <mesh position={[-w / 2 - WALL_THICKNESS / 2, h / 2, 0]} receiveShadow>
          <boxGeometry args={[WALL_THICKNESS, h, d]} />
          <meshStandardMaterial color="#f3f0eb" />
        </mesh>

        {furniture.map((f) => {
          const l = f.layout
          const selected = f.id === selectedId
          return (
            <group
              key={f.id}
              position={[
                l.x_cm / 100 - w / 2,
                l.elevation_cm / 100 + l.height_cm / 200,
                l.z_cm / 100 - d / 2,
              ]}
              rotation-y={(-l.rotation_deg * Math.PI) / 180}
            >
              <mesh
                castShadow
                receiveShadow
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(f.id)
                }}
                onPointerDown={(e) => {
                  if (!editing) return
                  e.stopPropagation()
                  onSelect(f.id)
                  const p = toRoomCm(e)
                  if (!p) return
                  grabOffset.current = { x: l.x_cm - p.x, z: l.z_cm - p.z }
                  ;(e.target as Element).setPointerCapture(e.pointerId)
                  draggingRef.current = f.id
                  setDragging(f.id)
                }}
                onPointerMove={(e) => {
                  if (draggingRef.current !== f.id) return
                  const p = toRoomCm(e)
                  if (!p) return
                  const { x, z } = clampToRoom(
                    p.x + grabOffset.current.x,
                    p.z + grabOffset.current.z,
                    l,
                    room,
                  )
                  onMove(f.id, { x_cm: x, z_cm: z })
                }}
                onPointerUp={(e) => {
                  if (draggingRef.current !== f.id) return
                  ;(e.target as Element).releasePointerCapture(e.pointerId)
                  draggingRef.current = null
                  setDragging(null)
                  onMoveEnd(f.id)
                }}
              >
                <boxGeometry args={[l.width_cm / 100, l.height_cm / 100, l.depth_cm / 100]} />
                <meshStandardMaterial
                  color={colorFor(f.kind, l)}
                  transparent={selected}
                  opacity={selected ? 0.85 : 1}
                />
                <Edges color={selected ? "#2b4c8c" : "#6b5a48"} lineWidth={selected ? 3 : 1} />
              </mesh>
            </group>
          )
        })}

        <OrbitControls
          enabled={!dragging}
          makeDefault
          target={[0, 0.4, 0]}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={1}
          maxDistance={Math.max(w, d) * 4}
        />
        <LabelProjector anchors={anchors} labelRefs={labelRefs} />
      </Canvas>

      {/* 家具名のラベル。3D 座標を毎フレーム画面座標に変換して DOM を動かす */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {furniture.map((f) => (
          <button
            key={f.id}
            ref={(el) => {
              if (el) labelRefs.current.set(f.id, el)
              else labelRefs.current.delete(f.id)
            }}
            type="button"
            onClick={() => onSelect(f.id)}
            style={{ visibility: "hidden" }}
            className={`pointer-events-auto absolute top-0 left-0 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap shadow-sm ${
              f.id === selectedId
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-white/95 text-foreground"
            }`}
          >
            {f.name}
            <span className="ml-1 opacity-70">{f.itemCount}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function LabelProjector({
  anchors,
  labelRefs,
}: {
  anchors: { id: string; position: readonly [number, number, number] }[]
  labelRefs: React.RefObject<Map<string, HTMLButtonElement>>
}) {
  const v = useRef(new Vector3())
  useFrame(({ camera, size }) => {
    for (const a of anchors) {
      const el = labelRefs.current.get(a.id)
      if (!el) continue
      v.current.set(...a.position).project(camera)
      const behind = v.current.z > 1
      el.style.visibility = behind ? "hidden" : "visible"
      const x = ((v.current.x + 1) / 2) * size.width
      const y = ((1 - v.current.y) / 2) * size.height
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
    }
  })
  return null
}
