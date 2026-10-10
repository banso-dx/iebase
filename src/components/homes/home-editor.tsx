"use client"

import { useState, useTransition } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Box, LayoutGrid, MapPin } from "lucide-react"
import { toast } from "sonner"
import { saveRoomPositions } from "@/app/(app)/homes/actions"
import {
  EditorShell,
  EditorToolbar,
  LayerList,
  LayoutProperties,
  NameField,
  PanelSection,
  ShortcutHelp,
} from "@/components/plan/editor-chrome"
import { PlanCanvas } from "@/components/plan/plan-canvas"
import { useLayoutEditor } from "@/components/plan/use-layout-editor"
import { RoomForm } from "@/components/rooms/room-form"
import { Button, buttonVariants } from "@/components/ui/button"
import { arrangeInRow, homeBounds, type Layout } from "@/lib/rooms"
import { cn } from "@/lib/utils"
import type { Enums } from "@/types/database"
import type { HomeSceneRoom } from "./home-scene"

const HomeScene = dynamic(() => import("./home-scene").then((m) => m.HomeScene), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
      読み込み中…
    </div>
  ),
})

type Props = {
  homeId: string
  rooms: HomeSceneRoom[]
  /** 寸法未設定の部屋（部屋の追加フォームで使う） */
  candidates: { id: string; name: string }[]
  /** 玄関の靴箱など、部屋に属さず家の直下にある場所 */
  others: { id: string; name: string; kind: Enums<"location_kind">; itemCount: number }[]
}

/** 家の間取りエディタ。2D での編集が基本で、3D はプレビューのときだけ表示する */
export function HomeEditor({ homeId, rooms, candidates, others }: Props) {
  const router = useRouter()
  const [previewing, setPreviewing] = useState(false)
  const [, startTransition] = useTransition()
  const editor = useLayoutEditor({ items: rooms, enabled: !previewing })
  const { merged, selected, selectedId, setSelectedId } = editor

  const openRoom = (id: string) => router.push(`/rooms/${id}`)

  const arrange = () => {
    const ordered = [...merged].sort((a, b) => a.layout.x_cm - b.layout.x_cm)
    const positions = arrangeInRow(ordered.map((r) => ({ id: r.id, ...r.layout })))
    editor.replaceAll(positions.map(({ id, x_cm, z_cm }) => ({ id, patch: { x_cm, z_cm } })))
    startTransition(async () => {
      try {
        await saveRoomPositions(positions)
      } catch {
        toast.error("配置を保存できませんでした")
      }
    })
  }

  const frame = frameOf(merged.map((r) => r.layout))
  const totalItems = merged.reduce((n, r) => n + r.itemCount, 0) + others.reduce((n, o) => n + o.itemCount, 0)

  return (
    <EditorShell
      toolbar={
        <EditorToolbar
          previewing={previewing}
          onTogglePreview={() => setPreviewing((p) => !p)}
          canUndo={editor.historySize.undo > 0}
          canRedo={editor.historySize.redo > 0}
          onUndo={editor.undo}
          onRedo={editor.redo}
        />
      }
      canvas={
        previewing ? (
          <HomeScene
            rooms={merged}
            origin={frame.origin}
            span={frame.span}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpen={openRoom}
          />
        ) : (
          <PlanCanvas
            shapes={merged.map((r) => ({
              id: r.id,
              name: r.name,
              sublabel: `${r.layout.width_cm}×${r.layout.depth_cm}・${r.itemCount}点`,
              layout: r.layout,
              variant: "room",
              inner: r.furniture,
            }))}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={(id, patch) => editor.apply(id, patch, { save: false })}
            onCommit={editor.commitDrag}
            onOpen={openRoom}
          />
        )
      }
      layers={
        <>
          <LayerList
            title="部屋"
            rows={merged.map((r) => ({
              id: r.id,
              name: r.name,
              meta: `${r.itemCount}`,
              icon: <Box className="size-3.5 shrink-0 text-muted-foreground" />,
            }))}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpen={openRoom}
            empty="まだ部屋がありません"
          />
          {others.length > 0 && (
            <div className="border-t">
              <LayerList
                title="部屋以外の場所"
                rows={others.map((o) => ({
                  id: o.id,
                  name: o.name,
                  meta: `${o.itemCount}`,
                  icon: <MapPin className="size-3.5 shrink-0 text-muted-foreground" />,
                }))}
                selectedId={null}
                onSelect={(id) => router.push(`/items?location=${id}`)}
                empty=""
              />
            </div>
          )}
        </>
      }
      panel={
        selected ? (
          <>
            <PanelSection>
              <NameField locationId={selected.id} name={selected.name} />
              <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                <Stat
                  label="広さ"
                  value={`${((selected.layout.width_cm * selected.layout.depth_cm) / 10000).toFixed(1)}㎡`}
                />
                <Stat label="家具" value={`${selected.furniture.length}`} />
                <Stat label="モノ" value={`${selected.itemCount}点`} />
              </dl>
              <Link href={`/rooms/${selected.id}`} className={cn(buttonVariants(), "w-full")}>
                部屋の中を編集
                <ArrowRight />
              </Link>
            </PanelSection>
            {!previewing && (
              <PanelSection title="配置">
                <LayoutProperties
                  layout={selected.layout}
                  onChange={(patch) => editor.commitChange(selected.id, patch)}
                  onRotate={() => editor.rotate(selected.id)}
                />
              </PanelSection>
            )}
            <ShortcutHelp extra={[["ダブルクリック", "部屋の中を編集"]]} />
          </>
        ) : (
          <>
            <PanelSection title="この家">
              <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                <Stat label="部屋" value={`${merged.length}`} />
                <Stat label="場所" value={`${others.length}`} />
                <Stat label="モノ" value={`${totalItems}点`} />
              </dl>
              {merged.length > 1 && !previewing && (
                <Button variant="outline" size="sm" className="w-full" onClick={arrange}>
                  <LayoutGrid />
                  自動で横に並べる
                </Button>
              )}
            </PanelSection>
            <RoomForm homeId={homeId} candidates={candidates} />
            <ShortcutHelp extra={[["ダブルクリック", "部屋の中を編集"]]} />
          </>
        )
      }
    />
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function frameOf(layouts: Layout[]) {
  const b = homeBounds(layouts) ?? { left: 0, right: 400, top: 0, bottom: 400 }
  return {
    origin: { x: Math.round((b.left + b.right) / 2), z: Math.round((b.top + b.bottom) / 2) },
    span: Math.max(b.right - b.left, b.bottom - b.top, 400),
  }
}
