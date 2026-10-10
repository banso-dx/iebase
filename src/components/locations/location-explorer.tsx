"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { DeleteLocationButton } from "@/components/locations/delete-location-button"
import { FolderTree, type TreeNode } from "@/components/plan/folder-tree"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ExplorerFolder = {
  id: string
  path: string
  kindLabel: string
  itemCount: number
  /** 開くページ（家・部屋・持ち物の画面、それ以外はモノ一覧） */
  href: string
}

/** 保管場所をフォルダとして一覧する（左：ツリー、右：選んだフォルダの詳細） */
export function LocationExplorer({ nodes, folders }: { nodes: TreeNode[]; folders: ExplorerFolder[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = folders.find((f) => f.id === selectedId)

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-xl border bg-card py-2">
        {nodes.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">まだ保管場所がありません</p>
        ) : (
          <FolderTree nodes={nodes} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </div>
      <aside className="space-y-3">
        {selected ? (
          <section className="space-y-3 rounded-xl border bg-card p-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{selected.kindLabel}</p>
              <p className="text-sm font-semibold break-all">{selected.path}</p>
              <p className="text-xs text-muted-foreground">
                モノ {selected.itemCount}点（中のフォルダも含む）
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={selected.href} className={cn(buttonVariants({ size: "sm" }), "flex-1")}>
                開く
                <ArrowRight />
              </Link>
              <Link
                href={`/items/new?location=${selected.id}`}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                ここに登録
              </Link>
              <DeleteLocationButton locationId={selected.id} name={selected.path.split(" / ").pop()!} />
            </div>
          </section>
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            フォルダを選ぶと、詳細と操作が表示されます。▸ で開閉できます。
          </p>
        )}
      </aside>
    </div>
  )
}
