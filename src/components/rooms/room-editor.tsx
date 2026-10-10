"use client"

import { useMemo, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Folder, FolderOpen, Layers, Package, Plus, Rows3, Square } from "lucide-react"
import { toast } from "sonner"
import {
  addCompartment,
  addCompartments,
  addFurniture,
  placeLocation,
  removeFromLayout,
  updateLayout,
} from "@/app/(app)/rooms/actions"
import {
  EditorShell,
  EditorToolbar,
  LayoutProperties,
  NameField,
  PanelSection,
  ShortcutHelp,
} from "@/components/plan/editor-chrome"
import { FolderTree, type TreeNode } from "@/components/plan/folder-tree"
import { PlanCanvas } from "@/components/plan/plan-canvas"
import { useLayoutEditor } from "@/components/plan/use-layout-editor"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { LOCATION_KIND_LABELS } from "@/lib/labels"
import {
  COMPARTMENT_PRESETS,
  FURNITURE_KINDS,
  clampToRoom,
  colorFor,
  fromElevationCanvas,
  toElevationCanvas,
  type CompartmentPreset,
  type Layout,
} from "@/lib/rooms"
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
  locationId: string
  furnitureId: string | null
  subLocation: string | null
  photoUrl?: string
}
/** 家具の中の段・引き出しなど。layout があれば正面図に描く */
export type SubLocation = {
  id: string
  name: string
  kind: Enums<"location_kind">
  parentId: string
  furnitureId: string
  depth: number
  itemCount: number
  layout: Layout | null
}

type Props = {
  room: { id: string; name: string; layout: Layout }
  furniture: Furniture[]
  subLocations: SubLocation[]
  unplaced: { id: string; name: string }[]
  items: RoomItem[]
}

const COMPARTMENT_KINDS = ["shelf", "drawer", "box", "other"] as const satisfies Enums<"location_kind">[]

/**
 * 部屋の中の配置エディタ。
 * 「平面図」（真上から家具を配置）と「高さ」（家具を正面から見て段・引き出しを配置）を切り替える。
 * 3D はプレビューのときだけ表示する
 */
export function RoomEditor({ room, furniture, subLocations, unplaced, items }: Props) {
  const router = useRouter()
  const [previewing, setPreviewing] = useState(false)
  // 正面図で開いている家具（null なら平面図）
  const [elevationId, setElevationId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // ---- データ（DB 側） ----
  const childrenOf = useMemo(() => {
    const map = new Map<string, SubLocation[]>()
    for (const s of subLocations) map.set(s.parentId, [...(map.get(s.parentId) ?? []), s])
    return map
  }, [subLocations])
  const itemsAt = useMemo(() => {
    const map = new Map<string, RoomItem[]>()
    for (const i of items) map.set(i.locationId, [...(map.get(i.locationId) ?? []), i])
    return map
  }, [items])
  /** その場所と、中の段・引き出しにあるモノ */
  const itemsUnder = (id: string): RoomItem[] => [
    ...(itemsAt.get(id) ?? []),
    ...(childrenOf.get(id) ?? []).flatMap((c) => itemsUnder(c.id)),
  ]
  const countUnder = (id: string) => itemsUnder(id).reduce((n, i) => n + i.quantity, 0)

  // ---- 平面図 ----
  const plan = useLayoutEditor({
    items: furniture,
    enabled: !previewing && !elevationId,
    // 部屋からはみ出さないよう位置を補正する
    normalize: (next) => {
      const { x, z } = clampToRoom(next.x_cm, next.z_cm, next, room.layout)
      return { x_cm: x, z_cm: z }
    },
  })

  // ---- 正面図（高さ） ----
  const elevationFurniture = plan.merged.find((f) => f.id === elevationId) ?? null
  const frontSize = elevationFurniture && {
    width_cm: elevationFurniture.layout.width_cm,
    depth_cm: elevationFurniture.layout.height_cm,
  }
  const compartments = elevationFurniture
    ? (childrenOf.get(elevationFurniture.id) ?? []).flatMap((c) =>
        c.layout ? [{ ...c, layout: toElevationCanvas(c.layout, elevationFurniture.layout.height_cm) }] : [],
      )
    : []
  const front = useLayoutEditor({
    items: compartments,
    enabled: !previewing && !!elevationId,
    rotatable: false,
    toStored: (l) => fromElevationCanvas(l, elevationFurniture?.layout.height_cm ?? 0),
    normalize: (next) => {
      if (!frontSize) return {}
      const { x, z } = clampToRoom(next.x_cm, next.z_cm, next, frontSize)
      return { x_cm: x, z_cm: z }
    },
  })

  const active = elevationId ? front : plan
  const openElevation = (furnitureId: string) => {
    setElevationId(furnitureId)
    plan.setSelectedId(furnitureId)
    front.setSelectedId(null)
  }
  const backToPlan = () => {
    setElevationId(null)
    front.setSelectedId(null)
  }

  const run = (fn: () => Promise<void>, message: string) =>
    startTransition(async () => {
      try {
        await fn()
        router.refresh()
      } catch {
        toast.error(message)
      }
    })

  // ---- 左：フォルダツリー（部屋 › 家具 › 段 › モノ） ----
  const itemNodes = (locationId: string): TreeNode[] =>
    (itemsAt.get(locationId) ?? []).map((i) => ({
      id: `item:${i.id}`,
      name: i.name,
      meta: i.quantity > 1 ? `×${i.quantity}` : undefined,
      href: `/items/${i.id}`,
    }))
  const subNodes = (parentId: string): TreeNode[] =>
    (childrenOf.get(parentId) ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      meta: `${countUnder(s.id)}`,
      icon: <Folder className="size-3.5 shrink-0 text-muted-foreground" />,
      children: [...subNodes(s.id), ...itemNodes(s.id)],
    }))
  const tree: TreeNode[] = [
    ...plan.merged.map((f) => ({
      id: f.id,
      name: f.name,
      meta: `${countUnder(f.id)}`,
      icon: <Square className="size-3.5 shrink-0" fill={colorFor(f.kind, f.layout)} strokeWidth={1.5} />,
      children: [...subNodes(f.id), ...itemNodes(f.id)],
    })),
    ...itemNodes(room.id),
  ]
  const selectFromTree = (id: string) => {
    const sub = subLocations.find((s) => s.id === id)
    if (!sub) {
      backToPlan()
      plan.setSelectedId(id)
      return
    }
    // 段・引き出しを選んだら、その家具の正面図を開く
    if (elevationId !== sub.furnitureId) openElevation(sub.furnitureId)
    front.setSelectedId(sub.layout && sub.parentId === sub.furnitureId ? sub.id : null)
  }
  const treeSelectedId = elevationId ? (front.selectedId ?? elevationId) : plan.selectedId

  return (
    <EditorShell
      toolbar={
        <EditorToolbar
          leading={
            <ViewSwitch
              furnitureName={elevationFurniture?.name ?? plan.selected?.name}
              mode={elevationId ? "elevation" : "plan"}
              canOpenElevation={!!plan.selected}
              onPlan={backToPlan}
              onElevation={() => plan.selected && openElevation(plan.selected.id)}
            />
          }
          previewing={previewing}
          onTogglePreview={() => setPreviewing((p) => !p)}
          canUndo={active.historySize.undo > 0}
          canRedo={active.historySize.redo > 0}
          onUndo={active.undo}
          onRedo={active.redo}
        />
      }
      canvas={
        previewing ? (
          <RoomScene
            room={room.layout}
            furniture={plan.merged.map((f) => ({ ...f, itemCount: countUnder(f.id) }))}
            selectedId={plan.selectedId}
            onSelect={plan.setSelectedId}
          />
        ) : elevationFurniture && frontSize ? (
          <PlanCanvas
            key={`front:${elevationFurniture.id}`}
            container={frontSize}
            containerLabels={{ width: "幅", depth: "高さ" }}
            shapes={front.merged.map((c) => ({
              id: c.id,
              name: c.name,
              sublabel: `${countUnder(c.id)}点`,
              layout: c.layout,
              variant: "furniture",
              kind: c.kind,
            }))}
            selectedId={front.selectedId}
            onSelect={front.setSelectedId}
            onChange={(id, patch) => front.apply(id, patch, { save: false })}
            onCommit={front.commitDrag}
          />
        ) : (
          <PlanCanvas
            key="plan"
            container={room.layout}
            shapes={plan.merged.map((f) => ({
              id: f.id,
              name: f.name,
              sublabel: `${countUnder(f.id)}点`,
              layout: f.layout,
              variant: "furniture",
              kind: f.kind,
            }))}
            selectedId={plan.selectedId}
            onSelect={plan.setSelectedId}
            onChange={(id, patch) => plan.apply(id, patch, { save: false })}
            onCommit={plan.commitDrag}
            onOpen={openElevation}
          />
        )
      }
      layers={
        <div className="py-2">
          <h2 className="px-3 pb-1 text-xs font-semibold text-muted-foreground">{room.name}</h2>
          {tree.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">右のパネルから家具を追加しましょう</p>
          ) : (
            <FolderTree
              nodes={tree}
              selectedId={treeSelectedId}
              onSelect={selectFromTree}
              onOpen={(id) => furniture.some((f) => f.id === id) && openElevation(id)}
            />
          )}
        </div>
      }
      panel={
        elevationFurniture ? (
          <ElevationPanel
            furniture={elevationFurniture}
            selected={front.selected}
            unplaced={(childrenOf.get(elevationFurniture.id) ?? []).filter((c) => !c.layout)}
            directItems={itemsAt.get(elevationFurniture.id) ?? []}
            itemsUnder={itemsUnder}
            previewing={previewing}
            onChange={(patch) => front.selected && front.commitChange(front.selected.id, patch)}
            onBack={backToPlan}
            onPreset={(preset) =>
              run(() => addCompartments(elevationFurniture.id, preset), "段を作成できませんでした")
            }
            onAdd={(input) => run(() => addCompartment(elevationFurniture.id, input), "追加できませんでした")}
            onRemove={(id) => {
              front.setSelectedId(null)
              run(() => removeFromLayout(id), "外せませんでした")
            }}
          />
        ) : plan.selected ? (
          <>
            <PanelSection>
              <NameField locationId={plan.selected.id} name={plan.selected.name} />
              <p className="px-2 text-xs text-muted-foreground">
                {LOCATION_KIND_LABELS[plan.selected.kind]}・モノ {countUnder(plan.selected.id)}点
              </p>
              <Button variant="outline" className="w-full" onClick={() => openElevation(plan.selected!.id)}>
                <Rows3 />
                高さを見る（正面図）
              </Button>
            </PanelSection>

            <PanelSection
              title="中身"
              action={
                <Link
                  href={`/items/new?location=${plan.selected.id}`}
                  className={buttonVariants({ size: "xs" })}
                >
                  <Plus />
                  登録
                </Link>
              }
            >
              <ItemList items={itemsUnder(plan.selected.id)} empty="まだ何も登録されていません" />
            </PanelSection>

            {!previewing && (
              <PanelSection title="配置">
                <LayoutProperties
                  layout={plan.selected.layout}
                  extras={["height", "elevation"]}
                  onChange={(patch) => plan.commitChange(plan.selected!.id, patch)}
                  onRotate={() => plan.rotate(plan.selected!.id)}
                />
                <div className="flex items-center gap-2 border-t pt-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    色
                    <input
                      type="color"
                      value={colorFor(plan.selected.kind, plan.selected.layout)}
                      onChange={(e) => plan.apply(plan.selected!.id, { color: e.target.value })}
                      className="size-7 cursor-pointer rounded border bg-transparent"
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-destructive"
                    onClick={() => {
                      const target = plan.selected!
                      if (
                        !confirm(
                          `「${target.name}」を間取りから外しますか？保管場所と中のモノはそのまま残ります。`,
                        )
                      )
                        return
                      plan.setSelectedId(null)
                      run(() => removeFromLayout(target.id), "外せませんでした")
                    }}
                  >
                    間取りから外す
                  </Button>
                </div>
              </PanelSection>
            )}
            <ShortcutHelp extra={[["ダブルクリック", "高さ（正面図）を開く"]]} />
          </>
        ) : (
          <>
            <RoomSize room={room} onSaved={() => router.refresh()} />
            <AddFurniture
              unplaced={unplaced}
              onAdd={(name, kind) => run(() => addFurniture(room.id, { name, kind }), "追加できませんでした")}
              onPlace={(id) => run(() => placeLocation(room.id, id), "配置できませんでした")}
            />
            {(itemsAt.get(room.id)?.length ?? 0) > 0 && (
              <PanelSection title="部屋に直接置いてあるモノ">
                <ItemList items={itemsAt.get(room.id)!} empty="" />
              </PanelSection>
            )}
            <ShortcutHelp extra={[["ダブルクリック", "高さ（正面図）を開く"]]} />
          </>
        )
      }
    />
  )
}

/** キャンバス左上：平面図 / 高さ（正面図）の切り替え */
function ViewSwitch({
  mode,
  furnitureName,
  canOpenElevation,
  onPlan,
  onElevation,
}: {
  mode: "plan" | "elevation"
  furnitureName?: string
  canOpenElevation: boolean
  onPlan: () => void
  onElevation: () => void
}) {
  const item = (active: boolean) =>
    cn(
      "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs whitespace-nowrap disabled:pointer-events-none disabled:opacity-40",
      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
    )
  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border bg-background/95 p-0.5 shadow-sm">
        <button type="button" className={item(mode === "plan")} onClick={onPlan}>
          <Layers className="size-3.5" />
          平面図
        </button>
        <button
          type="button"
          className={item(mode === "elevation")}
          disabled={!canOpenElevation && mode !== "elevation"}
          title={canOpenElevation ? undefined : "家具を選ぶと、正面から見た高さを編集できます"}
          onClick={onElevation}
        >
          <Rows3 className="size-3.5" />
          高さ
        </button>
      </div>
      {mode === "elevation" && furnitureName && (
        <span className="hidden rounded-md bg-background/90 px-2 py-1 text-xs whitespace-nowrap text-muted-foreground shadow-sm xl:inline">
          {furnitureName} を正面から見た図
        </span>
      )}
    </div>
  )
}

function ElevationPanel({
  furniture,
  selected,
  unplaced,
  directItems,
  itemsUnder,
  previewing,
  onChange,
  onBack,
  onPreset,
  onAdd,
  onRemove,
}: {
  furniture: Furniture
  selected: (SubLocation & { layout: Layout }) | null
  unplaced: SubLocation[]
  directItems: RoomItem[]
  itemsUnder: (id: string) => RoomItem[]
  previewing: boolean
  onChange: (patch: Partial<Layout>) => void
  onBack: () => void
  onPreset: (preset: CompartmentPreset) => void
  onAdd: (input: { name: string; kind: Enums<"location_kind"> } | { locationId: string }) => void
  onRemove: (id: string) => void
}) {
  if (selected) {
    const contents = itemsUnder(selected.id)
    return (
      <>
        <PanelSection>
          <NameField locationId={selected.id} name={selected.name} />
          <p className="px-2 text-xs text-muted-foreground">
            {furniture.name} の{LOCATION_KIND_LABELS[selected.kind]}・モノ{" "}
            {contents.reduce((n, i) => n + i.quantity, 0)}点
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
          <ItemList items={contents} empty="まだ何も登録されていません" />
        </PanelSection>
        {!previewing && (
          <PanelSection title="位置（正面から見て）">
            <ElevationProperties
              layout={selected.layout}
              furnitureHeight={furniture.layout.height_cm}
              onChange={onChange}
            />
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive"
              onClick={() => {
                if (
                  !confirm(
                    `「${selected.name}」を正面図から外しますか？保管場所と中のモノはそのまま残ります。`,
                  )
                )
                  return
                onRemove(selected.id)
              }}
            >
              正面図から外す
            </Button>
          </PanelSection>
        )}
        <ShortcutHelp />
      </>
    )
  }

  return (
    <>
      <PanelSection>
        <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={onBack}>
          <ArrowLeft />
          平面図に戻る
        </Button>
        <p className="text-sm">
          <span className="font-semibold">{furniture.name}</span>
          <span className="text-muted-foreground">
            {" "}
            を正面から見ています（幅 {furniture.layout.width_cm} × 高さ {furniture.layout.height_cm} cm）
          </span>
        </p>
      </PanelSection>

      <PanelSection title="段・引き出しを作る">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(COMPARTMENT_PRESETS) as CompartmentPreset[]).map((p) => (
            <Button
              key={p}
              variant="outline"
              size="sm"
              className="h-auto flex-col py-2"
              onClick={() => onPreset(p)}
            >
              <Rows3 />
              <span className="text-xs">{COMPARTMENT_PRESETS[p].label}</span>
            </Button>
          ))}
        </div>
        <form
          className="flex gap-2 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            onAdd({ name: String(fd.get("name") ?? ""), kind: fd.get("kind") as Enums<"location_kind"> })
            e.currentTarget.reset()
          }}
        >
          <Input name="name" placeholder="名前（例：上段）" required maxLength={100} className="h-8 flex-1" />
          <NativeSelect name="kind" defaultValue="shelf" aria-label="種類" className="w-24">
            {COMPARTMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k === "shelf" ? "段" : LOCATION_KIND_LABELS[k]}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" size="sm">
            <Plus />
          </Button>
        </form>
        {unplaced.length > 0 && (
          <div className="space-y-1 border-t pt-3">
            <h4 className="text-xs font-medium text-muted-foreground">未配置の段・引き出し</h4>
            {unplaced.map((u) => (
              <div key={u.id} className="flex items-center gap-2 text-sm">
                <FolderOpen className="size-3.5 text-muted-foreground" />
                <span className="flex-1 truncate">{u.name}</span>
                <Button variant="outline" size="xs" onClick={() => onAdd({ locationId: u.id })}>
                  配置する
                </Button>
              </div>
            ))}
          </div>
        )}
      </PanelSection>

      {directItems.length > 0 && (
        <PanelSection title={`${furniture.name} に直接入っているモノ`}>
          <ItemList items={directItems} empty="" />
        </PanelSection>
      )}
      <ShortcutHelp />
    </>
  )
}

/** 正面から見た位置。画面上の座標（z_cm は上端基準）を「左から」「下から」で編集する */
function ElevationProperties({
  layout,
  furnitureHeight,
  onChange,
}: {
  layout: Layout
  furnitureHeight: number
  onChange: (patch: Partial<Layout>) => void
}) {
  const left = layout.x_cm - layout.width_cm / 2
  const bottom = furnitureHeight - layout.z_cm - layout.depth_cm / 2
  const fields: {
    key: string
    label: string
    value: number
    min: number
    toPatch: (v: number) => Partial<Layout>
  }[] = [
    {
      key: "left",
      label: "左から",
      value: left,
      min: 0,
      toPatch: (v) => ({ x_cm: v + layout.width_cm / 2 }),
    },
    {
      key: "bottom",
      label: "下から",
      value: bottom,
      min: 0,
      toPatch: (v) => ({ z_cm: furnitureHeight - v - layout.depth_cm / 2 }),
    },
    {
      key: "width",
      label: "幅",
      value: layout.width_cm,
      min: 1,
      toPatch: (v) => ({ width_cm: v, x_cm: left + v / 2 }),
    },
    {
      key: "height",
      label: "高さ",
      value: layout.depth_cm,
      min: 1,
      toPatch: (v) => ({ depth_cm: v, z_cm: furnitureHeight - bottom - v / 2 }),
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label htmlFor={`front-${f.key}`} className="text-xs text-muted-foreground">
            {f.label}（cm）
          </Label>
          <Input
            key={`${f.key}:${Math.round(f.value)}`}
            id={`front-${f.key}`}
            type="number"
            min={f.min}
            defaultValue={Math.round(f.value)}
            className="h-8 tabular-nums"
            onBlur={(e) => {
              const v = Math.round(Number(e.target.value))
              if (!Number.isFinite(v) || v < f.min || v === Math.round(f.value)) {
                e.target.value = String(Math.round(f.value))
                return
              }
              onChange(f.toPatch(v))
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur()
            }}
          />
        </div>
      ))}
    </div>
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
              <li key={u.id} className="flex items-center gap-2 text-sm">
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
