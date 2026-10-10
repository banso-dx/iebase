"use client"

import { useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { Edges, Grid, OrbitControls } from "@react-three/drei"
import { colorFor, type Layout } from "@/lib/rooms"
import type { Enums } from "@/types/database"
import { LabelProjector, SceneLabel } from "./scene-labels"

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
  onSelect: (id: string | null) => void
}

const WALL_THICKNESS = 0.05

/**
 * 部屋の3Dプレビュー（表示専用。配置の編集は 2D の PlanCanvas で行う）。
 * 座標系: 部屋の左奥の床を原点に cm で保存し、描画時は部屋の中心を原点としたメートルに変換する
 */
export function RoomScene({ room, furniture, selectedId, onSelect }: Props) {
  const w = room.width_cm / 100
  const d = room.depth_cm / 100
  const h = room.height_cm / 100
  const labelRefs = useRef(new Map<string, HTMLElement>())
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
        onPointerMissed={() => onSelect(null)}
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
            <mesh
              key={f.id}
              castShadow
              receiveShadow
              position={[
                l.x_cm / 100 - w / 2,
                l.elevation_cm / 100 + l.height_cm / 200,
                l.z_cm / 100 - d / 2,
              ]}
              rotation-y={(-l.rotation_deg * Math.PI) / 180}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(f.id)
              }}
            >
              <boxGeometry args={[l.width_cm / 100, l.height_cm / 100, l.depth_cm / 100]} />
              <meshStandardMaterial
                color={colorFor(f.kind, l)}
                transparent={selected}
                opacity={selected ? 0.85 : 1}
              />
              <Edges color={selected ? "#0d99ff" : "#6b5a48"} />
            </mesh>
          )
        })}

        <OrbitControls
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
          <SceneLabel
            key={f.id}
            id={f.id}
            labelRefs={labelRefs}
            selected={f.id === selectedId}
            onClick={() => onSelect(f.id)}
          >
            {f.name}
            <span className="ml-1 opacity-70">{f.itemCount}</span>
          </SceneLabel>
        ))}
      </div>
    </div>
  )
}
