"use client"

import { useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { Edges, OrbitControls } from "@react-three/drei"
import { LabelProjector, SceneLabel } from "@/components/rooms/scene-labels"
import { colorFor, type Layout } from "@/lib/rooms"
import type { Enums } from "@/types/database"

export type HomeSceneRoom = {
  id: string
  name: string
  layout: Layout
  itemCount: number
  furniture: { id: string; kind: Enums<"location_kind">; layout: Layout }[]
}

type Props = {
  rooms: HomeSceneRoom[]
  /** 家の座標系（cm）で、画面の中心に置く点 */
  origin: { x: number; z: number }
  span: number
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpen: (id: string) => void
}

// 俯瞰しやすいよう、壁は腰高で切って描く
const CUTAWAY_WALL_M = 1.0
const WALL_THICKNESS = 0.06
const noRaycast = () => null

/** 家全体の3D俯瞰（表示専用。配置の編集は 2D の FloorPlanEditor で行う） */
export function HomeScene({ rooms, origin, span, selectedId, onSelect, onOpen }: Props) {
  const labelRefs = useRef(new Map<string, HTMLElement>())
  const toWorld = (x: number, z: number) => [(x - origin.x) / 100, (z - origin.z) / 100] as const

  const anchors = rooms.map((r) => {
    const [x, z] = toWorld(r.layout.x_cm, r.layout.z_cm)
    return { id: r.id, position: [x, Math.min(r.layout.height_cm / 100, CUTAWAY_WALL_M) + 0.3, z] as const }
  })

  const s = span / 100
  return (
    <div className="relative size-full">
      <Canvas
        camera={{ position: [s * 0.5, s * 1.7, s * 1.5], fov: 40 }}
        shadows="percentage"
        onPointerMissed={() => onSelect(null)}
      >
        <color attach="background" args={["#f4f2ee"]} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[s, s * 2, s]} intensity={1} castShadow />

        {/* 地面 */}
        <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow raycast={noRaycast}>
          <planeGeometry args={[s * 4, s * 4]} />
          <meshStandardMaterial color="#ebe7df" />
        </mesh>

        {rooms.map((r) => {
          const l = r.layout
          const w = l.width_cm / 100
          const d = l.depth_cm / 100
          const wallH = Math.min(l.height_cm / 100, CUTAWAY_WALL_M)
          const [x, z] = toWorld(l.x_cm, l.z_cm)
          const selected = r.id === selectedId
          const walls: [number, number, number, number][] = [
            // [x, z, 幅, 奥行き]
            [0, -d / 2, w + WALL_THICKNESS, WALL_THICKNESS],
            [0, d / 2, w + WALL_THICKNESS, WALL_THICKNESS],
            [-w / 2, 0, WALL_THICKNESS, d],
            [w / 2, 0, WALL_THICKNESS, d],
          ]

          return (
            <group key={r.id} position={[x, 0, z]} rotation-y={(-l.rotation_deg * Math.PI) / 180}>
              {/* 床：選択の当たり判定 */}
              <mesh
                rotation-x={-Math.PI / 2}
                receiveShadow
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(r.id)
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  onOpen(r.id)
                }}
              >
                <planeGeometry args={[w, d]} />
                <meshStandardMaterial color={selected ? "#d6dcef" : "#e6dccd"} />
              </mesh>

              {walls.map(([wx, wz, ww, wd], i) => (
                <mesh key={i} position={[wx, wallH / 2, wz]} castShadow raycast={noRaycast}>
                  <boxGeometry args={[ww, wallH, wd]} />
                  <meshStandardMaterial color={selected ? "#c3cde8" : "#faf8f5"} />
                </mesh>
              ))}

              {r.furniture.map((f) => {
                const fl = f.layout
                return (
                  <mesh
                    key={f.id}
                    raycast={noRaycast}
                    castShadow
                    position={[
                      fl.x_cm / 100 - w / 2,
                      fl.elevation_cm / 100 + fl.height_cm / 200,
                      fl.z_cm / 100 - d / 2,
                    ]}
                    rotation-y={(-fl.rotation_deg * Math.PI) / 180}
                  >
                    <boxGeometry args={[fl.width_cm / 100, fl.height_cm / 100, fl.depth_cm / 100]} />
                    <meshStandardMaterial color={colorFor(f.kind, fl)} />
                    <Edges color="#6b5a48" />
                  </mesh>
                )
              })}
            </group>
          )
        })}

        <OrbitControls
          makeDefault
          target={[0, 0, 0]}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={2}
          maxDistance={s * 4}
        />
        <LabelProjector anchors={anchors} labelRefs={labelRefs} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {rooms.map((r) => (
          <SceneLabel
            key={r.id}
            id={r.id}
            labelRefs={labelRefs}
            selected={r.id === selectedId}
            onClick={() => onSelect(r.id)}
          >
            {r.name}
            <span className="ml-1 opacity-70">{r.itemCount}</span>
          </SceneLabel>
        ))}
      </div>
    </div>
  )
}
