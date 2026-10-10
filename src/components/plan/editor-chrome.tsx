"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Box, Keyboard, PenLine, Redo2, RotateCw, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { renameLocation } from "@/app/(app)/locations/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { footprint, roomBounds, type Layout } from "@/lib/rooms"
import { cn } from "@/lib/utils"
import { ToolButton } from "./plan-canvas"

/** Figma と同じ 3 カラム（レイヤー / キャンバス / プロパティ） */
export function EditorShell({
  layers,
  canvas,
  panel,
  toolbar,
}: {
  layers: React.ReactNode
  canvas: React.ReactNode
  panel: React.ReactNode
  toolbar: React.ReactNode
}) {
  return (
    <div className="grid gap-3 lg:h-[calc(100vh-10.5rem)] lg:min-h-[520px] lg:grid-cols-[220px_1fr_300px]">
      <aside className="order-2 overflow-y-auto rounded-xl border bg-card lg:order-none">{layers}</aside>
      <div className="relative order-1 h-[60vh] overflow-hidden rounded-xl border lg:order-none lg:h-auto">
        {canvas}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-end">{toolbar}</div>
      </div>
      <aside className="order-3 space-y-3 overflow-y-auto lg:order-none">{panel}</aside>
    </div>
  )
}

export function EditorToolbar({
  previewing,
  onTogglePreview,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  previewing: boolean
  onTogglePreview: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}) {
  return (
    <div className="pointer-events-auto flex items-center gap-2">
      {!previewing && (
        <div className="flex rounded-lg border bg-background/95 p-0.5 shadow-sm">
          <ToolButton label="元に戻す（⌘Z）" disabled={!canUndo} onClick={onUndo}>
            <Undo2 className="size-3.5" />
          </ToolButton>
          <ToolButton label="やり直す（⇧⌘Z）" disabled={!canRedo} onClick={onRedo}>
            <Redo2 className="size-3.5" />
          </ToolButton>
        </div>
      )}
      <Button
        size="sm"
        variant={previewing ? "outline" : "default"}
        className="shadow-sm"
        onClick={onTogglePreview}
      >
        {previewing ? <PenLine /> : <Box />}
        {previewing ? "編集に戻る" : "3Dプレビュー"}
      </Button>
    </div>
  )
}

export type LayerRow = {
  id: string
  name: string
  meta?: string
  icon?: React.ReactNode
  depth?: number
  /** 選択できない行（家具の中の引き出しなど） */
  static?: boolean
}

export function LayerList({
  title,
  rows,
  selectedId,
  onSelect,
  onOpen,
  empty,
}: {
  title: string
  rows: LayerRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  onOpen?: (id: string) => void
  empty: string
}) {
  return (
    <div className="py-2">
      <h2 className="px-3 pb-1 text-xs font-semibold text-muted-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                disabled={r.static}
                onClick={() => onSelect(r.id)}
                onDoubleClick={() => onOpen?.(r.id)}
                style={{ paddingLeft: 12 + (r.depth ?? 0) * 14 }}
                className={cn(
                  "flex w-full items-center gap-2 py-1.5 pr-3 text-left text-sm disabled:cursor-default",
                  r.id === selectedId ? "bg-[#0d99ff]/10 text-foreground" : "hover:bg-muted/60",
                  r.static && "text-muted-foreground",
                )}
              >
                {r.icon}
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                {r.meta && (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{r.meta}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function PanelSection({
  title,
  children,
  action,
}: {
  title?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      {(title || action) && (
        <div className="flex items-center gap-2">
          {title && <h3 className="flex-1 text-xs font-semibold text-muted-foreground">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** 保管場所の名前をその場で変える入力欄（DB に直接保存） */
export function NameField({ locationId, name }: { locationId: string; name: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Input
      key={`${locationId}:${name}`}
      defaultValue={name}
      aria-label="名前"
      disabled={pending}
      maxLength={100}
      className="h-9 border-transparent px-2 text-base font-semibold shadow-none hover:border-input focus-visible:border-ring"
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
        if (e.key === "Escape") {
          e.currentTarget.value = name
          e.currentTarget.blur()
        }
      }}
      onBlur={(e) => {
        const next = e.target.value.trim()
        if (!next || next === name) {
          e.target.value = name
          return
        }
        startTransition(async () => {
          try {
            await renameLocation(locationId, next)
            router.refresh()
          } catch {
            toast.error("名前を変更できませんでした")
            e.target.value = name
          }
        })
      }}
    />
  )
}

type Extra = "height" | "elevation"

/**
 * Figma のプロパティパネルと同じく X / Y は左上の位置。
 * 幅・奥行きを変えても左上は動かさない
 */
export function LayoutProperties({
  layout,
  extras = [],
  onChange,
  onRotate,
}: {
  layout: Layout
  extras?: Extra[]
  onChange: (patch: Partial<Layout>) => void
  onRotate: () => void
}) {
  const b = roomBounds(layout)
  const { w, d } = footprint(layout)
  const fields: {
    key: string
    label: string
    value: number
    min?: number
    toPatch: (v: number) => Partial<Layout>
  }[] = [
    { key: "x", label: "X", value: b.left, toPatch: (v) => ({ x_cm: Math.round(v + w / 2) }) },
    { key: "y", label: "Y", value: b.top, toPatch: (v) => ({ z_cm: Math.round(v + d / 2) }) },
    {
      key: "w",
      label: "幅",
      value: layout.width_cm,
      min: 1,
      toPatch: (v) => resizeKeepingTopLeft(layout, { width_cm: v }),
    },
    {
      key: "d",
      label: "奥行き",
      value: layout.depth_cm,
      min: 1,
      toPatch: (v) => resizeKeepingTopLeft(layout, { depth_cm: v }),
    },
  ]
  if (extras.includes("height")) {
    fields.push({
      key: "h",
      label: "高さ",
      value: layout.height_cm,
      min: 1,
      toPatch: (v) => ({ height_cm: v }),
    })
  }
  if (extras.includes("elevation")) {
    fields.push({
      key: "e",
      label: "床から",
      value: layout.elevation_cm,
      min: 0,
      toPatch: (v) => ({ elevation_cm: v }),
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={`prop-${f.key}`} className="text-xs text-muted-foreground">
              {f.label}（cm）
            </Label>
            <Input
              // 外から値が変わったら入力欄を作り直す
              key={`${f.key}:${f.value}`}
              id={`prop-${f.key}`}
              type="number"
              min={f.min}
              defaultValue={Math.round(f.value)}
              className="h-8 tabular-nums"
              onBlur={(e) => {
                const v = Math.round(Number(e.target.value))
                if (!Number.isFinite(v) || v === Math.round(f.value) || (f.min !== undefined && v < f.min)) {
                  e.target.value = String(Math.round(f.value))
                  return
                }
                onChange(f.toPatch(v))
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur()
                if (e.key === "Escape") {
                  e.currentTarget.value = String(Math.round(f.value))
                  e.currentTarget.blur()
                }
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">回転 {layout.rotation_deg}°</span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={onRotate}>
          <RotateCw />
          90°回転（R）
        </Button>
      </div>
    </div>
  )
}

function resizeKeepingTopLeft(
  layout: Layout,
  size: Partial<Pick<Layout, "width_cm" | "depth_cm">>,
): Partial<Layout> {
  const before = roomBounds(layout)
  const { w, d } = footprint({ ...layout, ...size })
  return { ...size, x_cm: Math.round(before.left + w / 2), z_cm: Math.round(before.top + d / 2) }
}

export function ShortcutHelp({ extra = [] }: { extra?: [string, string][] }) {
  const rows: [string, string][] = [
    ["ドラッグ", "移動（Alt で吸着なし）"],
    ["矢印キー", "1cm 移動（Shift で 10cm）"],
    ["R", "90°回転"],
    ["⌘Z / ⇧⌘Z", "元に戻す / やり直す"],
    ["⌘ + ホイール", "ズーム"],
    ["Shift + 1", "全体を表示"],
    ...extra,
  ]
  return (
    <details className="rounded-xl border bg-card px-4 py-3 text-xs">
      <summary className="flex cursor-pointer items-center gap-1.5 font-semibold text-muted-foreground">
        <Keyboard className="size-3.5" />
        操作
      </summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt>
              <kbd className="rounded border bg-muted px-1 font-sans">{k}</kbd>
            </dt>
            <dd className="text-muted-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
