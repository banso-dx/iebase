"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Maximize, Minus, Plus } from "lucide-react"
import {
  clampToRoom,
  colorFor,
  footprint,
  homeBounds,
  roomBounds,
  snapRect,
  type Layout,
  type SnapGuide,
} from "@/lib/rooms"
import { cn } from "@/lib/utils"
import type { Enums } from "@/types/database"
import { isTyping } from "./use-layout-editor"

/** キャンバスに描く図形（部屋や家具）。x_cm / z_cm は中心 */
export type PlanShape = {
  id: string
  name: string
  /** 名前の下に小さく出す補足（サイズや点数） */
  sublabel?: string
  layout: Layout
  variant: "room" | "furniture"
  kind?: Enums<"location_kind">
  /** 図形の中に描く子要素（部屋の中の家具など）。編集対象ではない */
  inner?: { id: string; kind: Enums<"location_kind">; layout: Layout }[]
}

type View = { tx: number; ty: number; scale: number } // scale は 1cm あたりの px

type Props = {
  shapes: PlanShape[]
  /** 部屋の中を編集するとき、その部屋の寸法。図形はこの範囲から出られない（原点は左奥） */
  container?: { width_cm: number; depth_cm: number }
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** ドラッグ中の位置更新（保存しない） */
  onChange: (id: string, patch: Partial<Layout>) => void
  /** ドラッグ確定時。before は移動前の値（元に戻す用） */
  onCommit: (id: string, before: Partial<Layout>) => void
  onOpen?: (id: string) => void
}

const SNAP_PX = 8
const MIN_SCALE = 0.05
const MAX_SCALE = 6
const FIT_PADDING_PX = 56
const GRID_MINOR_CM = 10
const GRID_MID_CM = 50
const GRID_MAJOR_CM = 100

const COLORS = {
  canvas: "#f5f4f1",
  grid: ["#ecebe7", "#e3e1db", "#d8d5cd"],
  roomFill: "#fbf8f2",
  roomStroke: "#5c5145",
  furnitureStroke: "#5c5145",
  select: "#0d99ff",
  guide: "#f24822",
}

/**
 * 真上から見た 2D の編集キャンバス（Figma 風の操作）。
 * ドラッグで移動・スマートガイドで吸着、ホイールでスクロール、⌘+ホイールでズーム
 */
export function PlanCanvas({ shapes, container, selectedId, onSelect, onChange, onCommit, onOpen }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [view, setView] = useState<View | null>(null)
  const [guides, setGuides] = useState<SnapGuide[]>([])
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [panning, setPanning] = useState(false)
  const drag = useRef<
    | {
        kind: "shape"
        id: string
        startX: number
        startZ: number
        pointerX: number
        pointerY: number
        moved: boolean
      }
    | { kind: "pan"; pointerX: number; pointerY: number; tx: number; ty: number }
    | null
  >(null)

  const containerRect = container && {
    x_cm: container.width_cm / 2,
    z_cm: container.depth_cm / 2,
    width_cm: container.width_cm,
    depth_cm: container.depth_cm,
    rotation_deg: 0,
  }

  const fit = useCallback(
    (width = size.width, height = size.height) => {
      // 図形がまだないときは 4m 四方を表示する
      const b = homeBounds([...shapes.map((s) => s.layout), ...(containerRect ? [containerRect] : [])]) ?? {
        left: 0,
        right: 400,
        top: 0,
        bottom: 400,
      }
      if (width === 0) return
      const scale = Math.min(
        (width - FIT_PADDING_PX * 2) / Math.max(b.right - b.left, 100),
        (height - FIT_PADDING_PX * 2) / Math.max(b.bottom - b.top, 100),
        MAX_SCALE,
      )
      setView({
        scale,
        tx: width / 2 - ((b.left + b.right) / 2) * scale,
        ty: height / 2 - ((b.top + b.bottom) / 2) * scale,
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- containerRect は container から導出
    [shapes, container, size.width, size.height],
  )

  // コンテナの大きさを追跡し、初回は全体が収まるように表示する
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current || size.width === 0) return
    fitted.current = true
    fit(size.width, size.height)
  }, [fit, size])

  const zoomAt = useCallback((factor: number, sx: number, sy: number) => {
    setView((v) => {
      if (!v) return v
      const scale = Math.min(Math.max(v.scale * factor, MIN_SCALE), MAX_SCALE)
      // カーソル位置の cm 座標が動かないように平行移動を補正する
      const k = scale / v.scale
      return { scale, tx: sx - (sx - v.tx) * k, ty: sy - (sy - v.ty) * k }
    })
  }, [])

  // ホイール：⌘/Ctrl（トラックパッドのピンチ含む）でズーム、それ以外はスクロール
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top)
      } else {
        setView((v) => (v ? { ...v, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY } : v))
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [zoomAt])

  // 表示まわりのショートカット（Shift+1 で全体表示、⌘+ / ⌘- でズーム）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const cx = size.width / 2
      const cy = size.height / 2
      if (e.shiftKey && (e.code === "Digit1" || e.key === "!")) {
        e.preventDefault()
        fit()
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault()
        zoomAt(1.25, cx, cy)
      } else if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault()
        zoomAt(0.8, cx, cy)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [fit, zoomAt, size])

  if (!view) {
    return <div ref={containerRef} className="size-full" style={{ background: COLORS.canvas }} />
  }

  const onShapePointerDown = (e: React.PointerEvent, shape: PlanShape) => {
    if (e.button !== 0) return
    e.stopPropagation()
    onSelect(shape.id)
    containerRef.current?.setPointerCapture(e.pointerId)
    drag.current = {
      kind: "shape",
      id: shape.id,
      startX: shape.layout.x_cm,
      startZ: shape.layout.z_cm,
      pointerX: e.clientX,
      pointerY: e.clientY,
      moved: false,
    }
  }

  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return
    onSelect(null)
    containerRef.current?.setPointerCapture(e.pointerId)
    drag.current = { kind: "pan", pointerX: e.clientX, pointerY: e.clientY, tx: view.tx, ty: view.ty }
    setPanning(true)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (d.kind === "pan") {
      setView({ ...view, tx: d.tx + e.clientX - d.pointerX, ty: d.ty + e.clientY - d.pointerY })
      return
    }
    const shape = shapes.find((s) => s.id === d.id)
    if (!shape) return
    // わずかな手ブレはクリックとして扱う
    if (!d.moved && Math.hypot(e.clientX - d.pointerX, e.clientY - d.pointerY) < 3) return
    d.moved = true

    const rawX = d.startX + (e.clientX - d.pointerX) / view.scale
    const rawZ = d.startZ + (e.clientY - d.pointerY) / view.scale
    const targets = [
      ...shapes.filter((s) => s.id !== d.id).map((s) => s.layout),
      ...(containerRect ? [containerRect] : []),
    ]
    let next = e.altKey
      ? { x: Math.round(rawX), z: Math.round(rawZ), guides: [] as SnapGuide[] }
      : snapRect(rawX, rawZ, shape.layout, targets, SNAP_PX / view.scale)
    if (container) next = { ...next, ...clampToRoom(next.x, next.z, shape.layout, container) }
    setGuides(next.guides)
    onChange(d.id, { x_cm: next.x, z_cm: next.z })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    setPanning(false)
    setGuides([])
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId)
    }
    if (d?.kind === "shape" && d.moved) onCommit(d.id, { x_cm: d.startX, z_cm: d.startZ })
  }

  // 表示範囲に合わせた方眼（10cm / 50cm / 1m）
  const visible = {
    left: -view.tx / view.scale,
    top: -view.ty / view.scale,
    right: (size.width - view.tx) / view.scale,
    bottom: (size.height - view.ty) / view.scale,
  }
  const gridLines = (step: number) => {
    // 縮小しすぎて線が詰まる場合は描かない
    if (step * view.scale < 8) return []
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
    for (let x = Math.floor(visible.left / step) * step; x <= visible.right; x += step) {
      lines.push({ x1: x, y1: visible.top, x2: x, y2: visible.bottom })
    }
    for (let y = Math.floor(visible.top / step) * step; y <= visible.bottom; y += step) {
      lines.push({ x1: visible.left, y1: y, x2: visible.right, y2: y })
    }
    return lines
  }
  const px = (n: number) => n / view.scale // 画面上で n px になる cm
  const stroke = (width: number) => ({ strokeWidth: width, vectorEffect: "non-scaling-stroke" as const })

  return (
    <div
      ref={containerRef}
      className={cn("relative size-full touch-none select-none", panning && "cursor-grabbing")}
      style={{ background: COLORS.canvas }}
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg width={size.width} height={size.height} className="absolute inset-0">
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          {[GRID_MINOR_CM, GRID_MID_CM, GRID_MAJOR_CM].map((step, level) =>
            gridLines(step).map((l, i) => (
              <line key={`${step}-${i}`} {...l} stroke={COLORS.grid[level]} {...stroke(1)} />
            )),
          )}

          {/* 部屋の中を編集しているときの部屋（壁） */}
          {container && (
            <g pointerEvents="none">
              <rect
                x={0}
                y={0}
                width={container.width_cm}
                height={container.depth_cm}
                fill={COLORS.roomFill}
                stroke={COLORS.roomStroke}
                {...stroke(4)}
              />
              <text
                x={container.width_cm / 2}
                y={-px(10)}
                textAnchor="middle"
                fontSize={px(11)}
                fill="#7c6f60"
              >
                {container.width_cm} cm
              </text>
              <text
                x={-px(10)}
                y={container.depth_cm / 2}
                textAnchor="middle"
                fontSize={px(11)}
                fill="#7c6f60"
                transform={`rotate(-90 ${-px(10)} ${container.depth_cm / 2})`}
              >
                {container.depth_cm} cm
              </text>
            </g>
          )}

          {shapes.map((s) => {
            const l = s.layout
            const selected = s.id === selectedId
            const hovered = s.id === hoverId && !selected
            const isRoom = s.variant === "room"
            return (
              <g
                key={s.id}
                transform={`translate(${l.x_cm} ${l.z_cm}) rotate(${l.rotation_deg})`}
                className="cursor-move"
                onPointerDown={(e) => onShapePointerDown(e, s)}
                onPointerEnter={() => setHoverId(s.id)}
                onPointerLeave={() => setHoverId(null)}
                onDoubleClick={() => onOpen?.(s.id)}
              >
                <rect
                  x={-l.width_cm / 2}
                  y={-l.depth_cm / 2}
                  width={l.width_cm}
                  height={l.depth_cm}
                  fill={isRoom ? COLORS.roomFill : colorFor(s.kind ?? "other", l)}
                  fillOpacity={isRoom ? 1 : 0.85}
                  stroke={isRoom ? COLORS.roomStroke : COLORS.furnitureStroke}
                  {...stroke(isRoom ? 4 : 1)}
                />
                {s.inner?.map((f) => (
                  <rect
                    key={f.id}
                    transform={`translate(${f.layout.x_cm - l.width_cm / 2} ${f.layout.z_cm - l.depth_cm / 2}) rotate(${f.layout.rotation_deg})`}
                    x={-f.layout.width_cm / 2}
                    y={-f.layout.depth_cm / 2}
                    width={f.layout.width_cm}
                    height={f.layout.depth_cm}
                    fill={colorFor(f.kind, f.layout)}
                    fillOpacity={0.6}
                    stroke={COLORS.furnitureStroke}
                    {...stroke(1)}
                  />
                ))}
                {(selected || hovered) && (
                  <rect
                    x={-l.width_cm / 2}
                    y={-l.depth_cm / 2}
                    width={l.width_cm}
                    height={l.depth_cm}
                    fill="none"
                    stroke={COLORS.select}
                    {...stroke(selected ? 2 : 1.5)}
                  />
                )}
              </g>
            )
          })}

          {/* 名前のラベル（回転の影響を受けないよう図形の外で描く） */}
          {shapes.map((s) => {
            const { w, d } = footprint(s.layout)
            if (w * view.scale < 44 || d * view.scale < 22) return null
            const twoLines = s.sublabel && d * view.scale >= 40
            return (
              <g key={`label-${s.id}`} pointerEvents="none">
                <text
                  x={s.layout.x_cm}
                  y={s.layout.z_cm + (twoLines ? -px(2) : px(4))}
                  textAnchor="middle"
                  fontSize={px(s.variant === "room" ? 13 : 12)}
                  fontWeight={600}
                  fill="#2f2923"
                >
                  {s.name}
                </text>
                {twoLines && (
                  <text
                    x={s.layout.x_cm}
                    y={s.layout.z_cm + px(13)}
                    textAnchor="middle"
                    fontSize={px(11)}
                    fill="#6f6355"
                  >
                    {s.sublabel}
                  </text>
                )}
              </g>
            )
          })}

          {/* 選択中の図形の四隅（Figma と同じ見た目の目印） */}
          {shapes
            .filter((s) => s.id === selectedId)
            .map((s) => {
              const b = roomBounds(s.layout)
              const h = px(7)
              return (
                <g key={`handles-${s.id}`} pointerEvents="none">
                  {[
                    [b.left, b.top],
                    [b.right, b.top],
                    [b.left, b.bottom],
                    [b.right, b.bottom],
                  ].map(([hx, hy], i) => (
                    <rect
                      key={i}
                      x={hx - h / 2}
                      y={hy - h / 2}
                      width={h}
                      height={h}
                      fill="white"
                      stroke={COLORS.select}
                      {...stroke(1)}
                    />
                  ))}
                </g>
              )
            })}

          {/* スマートガイド */}
          {guides.map((g, i) =>
            g.axis === "x" ? (
              <line key={i} x1={g.at} y1={g.from} x2={g.at} y2={g.to} stroke={COLORS.guide} {...stroke(1)} />
            ) : (
              <line key={i} x1={g.from} y1={g.at} x2={g.to} y2={g.at} stroke={COLORS.guide} {...stroke(1)} />
            ),
          )}
        </g>
      </svg>

      <div
        className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-lg border bg-background/95 p-0.5 text-xs shadow-sm"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <ToolButton label="縮小（⌘-）" onClick={() => zoomAt(0.8, size.width / 2, size.height / 2)}>
          <Minus className="size-3.5" />
        </ToolButton>
        <span className="w-11 text-center tabular-nums">{Math.round(view.scale * 100)}%</span>
        <ToolButton label="拡大（⌘+）" onClick={() => zoomAt(1.25, size.width / 2, size.height / 2)}>
          <Plus className="size-3.5" />
        </ToolButton>
        <ToolButton label="全体を表示（Shift+1）" onClick={() => fit()}>
          <Maximize className="size-3.5" />
        </ToolButton>
      </div>
    </div>
  )
}

export function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}
