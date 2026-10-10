"use client"

import { useMemo, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CornerDownRight, Package, Plus, Square } from "lucide-react"
import { toast } from "sonner"
import { addFurniture, placeLocation, removeFromLayout, updateLayout } from "@/app/(app)/rooms/actions"
import {
  EditorShell,
  EditorToolbar,
  LayerList,
  LayoutProperties,
  NameField,
  PanelSection,
  ShortcutHelp,
  type LayerRow,
} from "@/components/plan/editor-chrome"
import { PlanCanvas } from "@/components/plan/plan-canvas"
import { useLayoutEditor } from "@/components/plan/use-layout-editor"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { LOCATION_KIND_LABELS } from "@/lib/labels"
import { FURNITURE_KINDS, clampToRoom, colorFor, type Layout } from "@/lib/rooms"
import { cn } from "@/lib/utils"
import type { Enums } from "@/types/database"

// three.js はブラウザでのみ動かす
const RoomScene = dynamic(() => import("./room-scene").then((m) => m.RoomScene), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
      読み込み中…
    </div>
  ),
})

export type Furniture = { id: string; name: string; kind: Enums<"location_kind">; layout: Layout }
export type RoomItem = {
  id: string
  name: string
  quantity: number
  furnitureId: string | null
  subLocation: string | null
  photoUrl?: string
}
/** 家具の中の引き出しなど、配置しない下位の保管場所 */
export type SubLocation = { id: string; name: string; furnitureId: string; depth: number; itemCount: number }

type Props = {
  room: { id: string; name: string; layout: Layout }
  furniture: Furniture[]
  subLocations: SubLocation[]
  unplaced: { id: string; name: string }[]
  items: RoomItem[]
}

/** 部屋の中の配置エディタ。2D での編集が基本で、3D はプレビューのときだけ表示する */
export function RoomEditor({ room, furniture, subLocations, unplaced, items }: Props) {
  const router = useRouter()
  const [previewing, setPreviewing] = useState(false)
  const [, startTransition] = useTransition()

  const itemsByFurniture = useMemo(() => {
    const map = new Map<string | null, RoomItem[]>()
    for (const item of items) map.set(item.furnitureId, [...(map.get(item.furnitureId) ?? []), item])
    return map
  }, [items])
  const countOf = (id: string | null) => (itemsByFurniture.get(id) ?? []).reduce((n, i) => n + i.quantity, 0)

  const editor = useLayoutEditor({
    items: furniture,
    enabled: !previewing,
    // 部屋からはみ出さないよう位置を補正する
    normalize: (next) => {
      const { x, z } = clampToRoom(next.x_cm, next.z_cm, next, room.layout)
      return { x_cm: x, z_cm: z }
    },
  })
  const { merged, selected, selectedId, setSelectedId } = editor
  const shapes = merged.map((f) => ({ ...f, itemCount: countOf(f.id) }))

  const run = (fn: () => Promise<void>, message: string) =>
    startTransition(async () => {
      try {
        await fn()
        router.refresh()
      } catch {
        toast.error(message)
      }
    })

  const layerRows: LayerRow[] = shapes.flatMap((f) => [
    {
      id: f.id,
      name: f.name,
      meta: `${f.itemCount}`,
      icon: <Square className="size-3.5 shrink-0" fill={colorFor(f.kind, f.layout)} strokeWidth={1.5} />,
    },
    ...subLocations
      .filter((s) => s.furnitureId === f.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        meta: `${s.itemCount}`,
        depth: s.depth,
        static: true,
        icon: <CornerDownRight className="size-3 shrink-0" />,
      })),
  ])

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
          <RoomScene room={room.layout} furniture={shapes} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <PlanCanvas
            container={room.layout}
            shapes={shapes.map((f) => ({
              id: f.id,
              name: f.name,
              sublabel: `${f.itemCount}点`,
              layout: f.layout,
              variant: "furniture",
              kind: f.kind,
            }))}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={(id, patch) => editor.apply(id, patch, { save: false })}
            onCommit={editor.commitDrag}
          />
        )
      }
      layers={
        <LayerList
          title="家具"
          rows={layerRows}
          selectedId={selectedId}
          onSelect={setSelectedId}
          empty="右のパネルから家具を追加しましょう"
        />
      }
      panel={
        selected ? (
          <>
            <PanelSection>
              <NameField locationId={selected.id} name={selected.name} />
              <p className="px-2 text-xs text-muted-foreground">
                {LOCATION_KIND_LABELS[selected.kind]}・モノ {countOf(selected.id)}点
              </p>
            </PanelSection>

            <PanelSection
              title="中身"
              action={
                <Link href={`/items/new?location=${selected.id}`} className={buttonVariants({ size: "xs" })}>
                  <Plus />
                  登録
                </Link>
              }
            >
              <ItemList items={itemsByFurniture.get(selected.id) ?? []} empty="まだ何も登録されていません" />
            </PanelSection>

            {!previewing && (
              <PanelSection title="配置">
                <LayoutProperties
                  layout={selected.layout}
                  extras={["height", "elevation"]}
                  onChange={(patch) => editor.commitChange(selected.id, patch)}
                  onRotate={() => editor.rotate(selected.id)}
                />
                <div className="flex items-center gap-2 border-t pt-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    色
                    <input
                      type="color"
                      value={colorFor(selected.kind, selected.layout)}
                      onChange={(e) => editor.apply(selected.id, { color: e.target.value })}
                      className="size-7 cursor-pointer rounded border bg-transparent"
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-destructive"
                    onClick={() => {
                      if (
                        !confirm(
                          `「${selected.name}」を間取りから外しますか？保管場所と中のモノはそのまま残ります。`,
                        )
                      )
                        return
                      setSelectedId(null)
                      run(() => removeFromLayout(selected.id), "外せませんでした")
                    }}
                  >
                    間取りから外す
                  </Button>
                </div>
              </PanelSection>
            )}
            <ShortcutHelp />
          </>
        ) : (
          <>
            <RoomSize room={room} onSaved={() => router.refresh()} />
            <AddFurniture
              unplaced={unplaced}
              onAdd={(name, kind) => run(() => addFurniture(room.id, { name, kind }), "追加できませんでした")}
              onPlace={(id) => run(() => placeLocation(room.id, id), "配置できませんでした")}
            />
            {(itemsByFurniture.get(null)?.length ?? 0) > 0 && (
              <PanelSection title="部屋に直接置いてあるモノ">
                <ItemList items={itemsByFurniture.get(null)!} empty="" />
              </PanelSection>
            )}
            <ShortcutHelp />
          </>
        )
      }
    />
  )
}

function ItemList({ items, empty }: { items: RoomItem[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="-mx-1.5 space-y-0.5">
      {items.map((i) => (
        <li key={i.id}>
          <Link href={`/items/${i.id}`} className="flex items-center gap-3 rounded-md p-1.5 hover:bg-muted">
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
              {i.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- 署名付きURLのため next/image を使わない
                <img src={i.photoUrl} alt="" className="size-full object-cover" />
              ) : (
                <Package className="size-4 text-muted-foreground" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">
                {i.name}
                {i.quantity > 1 && <span className="text-muted-foreground"> ×{i.quantity}</span>}
              </span>
              {i.subLocation && (
                <span className="block truncate text-xs text-muted-foreground">{i.subLocation}</span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function RoomSize({ room, onSaved }: { room: Props["room"]; onSaved: () => void }) {
  const [pending, startTransition] = useTransition()
  const fields = [
    ["width_cm", "幅"],
    ["depth_cm", "奥行き"],
    ["height_cm", "天井高"],
  ] as const

  return (
    <PanelSection title="部屋の広さ">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          const patch = Object.fromEntries(fields.map(([k]) => [k, Math.round(Number(fd.get(k)))]))
          if (Object.values(patch).some((v) => !Number.isFinite(v) || v < 50)) {
            toast.error("50cm 以上で入力してください")
            return
          }
          startTransition(async () => {
            try {
              await updateLayout(room.id, patch)
              onSaved()
            } catch {
              toast.error("保存できませんでした")
            }
          })
        }}
      >
        <div className="grid grid-cols-3 gap-2">
          {fields.map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`room-${key}`} className="text-xs text-muted-foreground">
                {label}（cm）
              </Label>
              <Input
                key={`${key}:${room.layout[key]}`}
                id={`room-${key}`}
                name={key}
                type="number"
                min={50}
                defaultValue={room.layout[key]}
                className="h-8 tabular-nums"
              />
            </div>
          ))}
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          広さを保存
        </Button>
      </form>
    </PanelSection>
  )
}

function AddFurniture({
  unplaced,
  onAdd,
  onPlace,
}: {
  unplaced: { id: string; name: string }[]
  onAdd: (name: string, kind: Enums<"location_kind">) => void
  onPlace: (id: string) => void
}) {
  return (
    <PanelSection title="家具を追加">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          onAdd(String(fd.get("name") ?? ""), fd.get("kind") as Enums<"location_kind">)
          e.currentTarget.reset()
        }}
      >
        <Input name="name" placeholder="名前（例：白い本棚）" required maxLength={100} className="h-8" />
        <div className="flex gap-2">
          <NativeSelect name="kind" defaultValue="shelf" className="flex-1" aria-label="種類">
            {FURNITURE_KINDS.map((k) => (
              <option key={k} value={k}>
                {LOCATION_KIND_LABELS[k]}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" size="sm">
            <Plus />
            追加
          </Button>
        </div>
      </form>

      {unplaced.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <h4 className="text-xs font-medium text-muted-foreground">この部屋の未配置の場所</h4>
          <ul className="space-y-1">
            {unplaced.map((u) => (
              <li key={u.id} className={cn("flex items-center gap-2 text-sm")}>
                <span className="flex-1 truncate">{u.name}</span>
                <Button variant="outline" size="xs" onClick={() => onPlace(u.id)}>
                  配置する
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PanelSection>
  )
}
