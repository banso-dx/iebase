"use client"

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Vector3 } from "three"
import { cn } from "@/lib/utils"

export type LabelAnchor = { id: string; position: readonly [number, number, number] }
export type LabelRefs = React.RefObject<Map<string, HTMLElement>>

/**
 * Canvas の中に置き、各ラベルの 3D 座標を毎フレーム画面座標に変換して DOM を動かす。
 * drei の Html は React 19 でアンマウント時にエラーになるため使わない
 */
export function LabelProjector({ anchors, labelRefs }: { anchors: LabelAnchor[]; labelRefs: LabelRefs }) {
  const v = useRef(new Vector3())
  useFrame(({ camera, size }) => {
    for (const a of anchors) {
      const el = labelRefs.current.get(a.id)
      if (!el) continue
      v.current.set(...a.position).project(camera)
      el.style.visibility = v.current.z > 1 ? "hidden" : "visible"
      const x = ((v.current.x + 1) / 2) * size.width
      const y = ((1 - v.current.y) / 2) * size.height
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
    }
  })
  return null
}

/** Canvas の外（重ねた div の中）に置くラベル */
export function SceneLabel({
  id,
  labelRefs,
  selected,
  onClick,
  children,
}: {
  id: string
  labelRefs: LabelRefs
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      ref={(el) => {
        if (el) labelRefs.current.set(id, el)
        else labelRefs.current.delete(id)
      }}
      type="button"
      onClick={onClick}
      style={{ visibility: "hidden" }}
      className={cn(
        "pointer-events-auto absolute top-0 left-0 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap shadow-sm",
        selected ? "border-primary bg-primary text-primary-foreground" : "bg-white/95 text-foreground"
      )}
    >
      {children}
    </button>
  )
}
