"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, Package, Pencil, Plus, RotateCw, X } from "lucide-react"
import { toast } from "sonner"
import {
  addFurniture,
  placeLocation,
  removeFromLayout,
  updateLayout,
} from "@/app/(app)/rooms/actions"
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
  loading: () => <div className="flex size-full items-center justify-center text-sm text-muted-foreground">読み込み中…</div>,
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

type Props = {
  room: { id: string; name: string; layout: Layout }
  furniture: Furniture[]
  unplaced: { id: string; name: string }[]
  items: RoomItem[]
}

const SAVE_DELAY_MS = 400

export function RoomEditor({ room, furniture, unplaced, items }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // 保存前の変更をサーバーの値に重ねて表示する
  const [overrides, setOverrides] = useState<Record<string, Partial<Layout>>>({})
  const pendingSave = useRef<Record<string, { timer?: ReturnType<typeof setTimeout>; patch: Partial<Layout> }>>({})
  const [, startTransition] = useTransition()

  const itemsByFurniture = useMemo(() => {
    const map = new Map<string | null, RoomItem[]>()
    for (const item of items) map.set(item.furnitureId, [...(map.get(item.furnitureId) ?? []), item])
    return map
  }, [items])

  const merged = furniture.map((f) => ({
    ...f,
    layout: { ...f.layout, ...overrides[f.id] },
    itemCount: (itemsByFurniture.get(f.id) ?? []).reduce((n, i) => n + i.quantity, 0),
  }))
  const selected = merged.find((f) => f.id === selectedId) ?? null

  const flush = (id: string) => {
    const entry = pendingSave.current[id]
    if (!entry) return
    clearTimeout(entry.timer)
    delete pendingSave.current[id]
    startTransition(async () => {
      try {
        await updateLayout(id, entry.patch)
      } catch {
        toast.error("配置を保存できませんでした")
      }
    })
  }

  const change = (id: string, patch: Partial<Layout>, { immediate = false } = {}) => {
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    const entry = (pendingSave.current[id] ??= { patch: {} })
    entry.patch = { ...entry.patch, ...patch }
    clearTimeout(entry.timer)
    if (immediate) flush(id)
    else entry.timer = setTimeout(() => flush(id), SAVE_DELAY_MS)
  }

  /** サイズや向きを変えたら、はみ出さないよう位置も補正する */
  const resize = (f: (typeof merged)[number], patch: Partial<Layout>) => {
    const next = { ...f.layout, ...patch }
    const { x, z } = clampToRoom(next.x_cm, next.z_cm, next, room.layout)
    change(f.id, { ...patch, x_cm: x, z_cm: z })
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

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="relative h-[55vh] min-h-80 overflow-hidden rounded-xl border lg:h-[calc(100vh-11rem)]">
        <RoomScene
          room={room.layout}
          furniture={merged}
          selectedId={selectedId}
          editing={editing}
          onSelect={setSelectedId}
          onMove={(id, pos) => change(id, pos)}
          onMoveEnd={(id) => flush(id)}
        />
        <div className="absolute top-3 left-3 flex rounded-lg border bg-background/95 p-0.5 shadow-sm">
          <ModeButton active={!editing} onClick={() => setEditing(false)} icon={Eye} label="見る" />
          <ModeButton active={editing} onClick={() => setEditing(true)} icon={Pencil} label="配置を編集" />
        </div>
        {editing && (
          <p className="absolute bottom-3 left-3 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground">
            家具をドラッグして移動できます
          </p>
        )}
      </div>

      <aside className="space-y-4">
        {selected ? (
          <section className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ background: colorFor(selected.kind, selected.layout) }} />
              <h2 className="flex-1 truncate font-semibold">{selected.name}</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => setSelectedId(null)} aria-label="閉じる">
                <X />
              </Button>
            </div>

            {editing ? (
              <FurnitureSettings
                furniture={selected}
                onResize={(patch) => resize(selected, patch)}
                onColor={(color) => change(selected.id, { color })}
                onRemove={() => {
                  if (!confirm(`「${selected.name}」を3Dから外しますか？保管場所と中のモノはそのまま残ります。`)) return
                  setSelectedId(null)
                  run(() => removeFromLayout(selected.id), "外せませんでした")
                }}
              />
            ) : (
              <ItemList
                items={itemsByFurniture.get(selected.id) ?? []}
                empty="まだ何も登録されていません"
              />
            )}
            <Link
              href={`/items/new?location=${selected.id}`}
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              <Plus />
              ここにモノを登録
            </Link>
          </section>
        ) : editing ? (
          <AddFurniture
            unplaced={unplaced}
            onAdd={(name, kind) => run(() => addFurniture(room.id, { name, kind }), "追加できませんでした")}
            onPlace={(id) => run(() => placeLocation(room.id, id), "配置できませんでした")}
          />
        ) : (
          <section className="space-y-3 rounded-xl border bg-card p-4">
            <h2 className="font-semibold">家具</h2>
            {merged.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                「配置を編集」から、クローゼットや棚を置いてみましょう。
              </p>
            ) : (
              <ul className="space-y-1">
                {merged.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(f.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="size-3 rounded-sm" style={{ background: colorFor(f.kind, f.layout) }} />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{f.itemCount}点</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {(itemsByFurniture.get(null)?.length ?? 0) > 0 && (
              <div className="space-y-2 border-t pt-3">
                <h3 className="text-sm font-medium text-muted-foreground">部屋に直接置いてあるモノ</h3>
                <ItemList items={itemsByFurniture.get(null)!} empty="" />
              </div>
            )}
          </section>
        )}
      </aside>
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Eye
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}

function ItemList({ items, empty }: { items: RoomItem[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="max-h-[40vh] space-y-1 overflow-y-auto">
      {items.map((i) => (
        <li key={i.id}>
          <Link href={`/items/${i.id}`} className="flex items-center gap-3 rounded-md p-1.5 hover:bg-muted">
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
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
              {i.subLocation && <span className="block truncate text-xs text-muted-foreground">{i.subLocation}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function FurnitureSettings({
  furniture,
  onResize,
  onColor,
  onRemove,
}: {
  furniture: Furniture
  onResize: (patch: Partial<Layout>) => void
  onColor: (color: string) => void
  onRemove: () => void
}) {
  const l = furniture.layout
  const fields: [keyof Layout, string][] = [
    ["width_cm", "幅"],
    ["depth_cm", "奥行き"],
    ["height_cm", "高さ"],
    ["elevation_cm", "床からの高さ"],
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={key} className="text-xs">
              {label}（cm）
            </Label>
            <Input
              id={key}
              type="number"
              min={key === "elevation_cm" ? 0 : 1}
              value={l[key] as number}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value))
                if (Number.isFinite(n) && n >= (key === "elevation_cm" ? 0 : 1)) onResize({ [key]: n })
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onResize({ rotation_deg: (l.rotation_deg + 90) % 360 })}
        >
          <RotateCw />
          90°回転
        </Button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          色
          <input
            type="color"
            value={colorFor(furniture.kind, l)}
            onChange={(e) => onColor(e.target.value)}
            className="size-7 cursor-pointer rounded border bg-transparent"
          />
        </label>
        <Button variant="ghost" size="sm" className="ml-auto text-destructive" onClick={onRemove}>
          3Dから外す
        </Button>
      </div>
    </div>
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
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">家具を追加</h2>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          onAdd(String(fd.get("name") ?? ""), fd.get("kind") as Enums<"location_kind">)
          e.currentTarget.reset()
        }}
      >
        <Input name="name" placeholder="名前（例：白い本棚）" required maxLength={100} />
        <div className="flex gap-2">
          <NativeSelect name="kind" defaultValue="shelf" className="flex-1" aria-label="種類">
            {FURNITURE_KINDS.map((k) => (
              <option key={k} value={k}>
                {LOCATION_KIND_LABELS[k]}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit">
            <Plus />
            追加
          </Button>
        </div>
      </form>

      {unplaced.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <h3 className="text-sm font-medium text-muted-foreground">この部屋の未配置の場所</h3>
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
      <p className="text-xs text-muted-foreground">配置済みの家具をタップすると、サイズや向きを変えられます。</p>
    </section>
  )
}
