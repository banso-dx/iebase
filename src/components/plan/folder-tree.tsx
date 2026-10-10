"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

/** フォルダ（保管場所）とファイル（モノ）の木 */
export type TreeNode = {
  id: string
  name: string
  icon?: React.ReactNode
  meta?: string
  /** モノなど、リンク先に移動する葉 */
  href?: string
  children?: TreeNode[]
}

/**
 * Finder のようなフォルダツリー。フォルダはクリックで選択、左の矢印で開閉する。
 * 既定ではすべて開いた状態
 */
export function FolderTree({
  nodes,
  selectedId,
  onSelect,
  onOpen,
}: {
  nodes: TreeNode[]
  selectedId: string | null
  onSelect?: (id: string) => void
  onOpen?: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const render = (node: TreeNode, depth: number): React.ReactNode => {
    const isFolder = !node.href
    const open = !collapsed.has(node.id)
    const hasChildren = (node.children?.length ?? 0) > 0
    const rowClass = cn(
      "flex w-full items-center gap-1.5 py-1 pr-3 text-left text-sm",
      node.id === selectedId ? "bg-[#0d99ff]/10" : "hover:bg-muted/60",
    )
    const indent = { paddingLeft: 6 + depth * 14 }

    return (
      <li key={node.id}>
        {isFolder ? (
          <div className={rowClass} style={indent}>
            <button
              type="button"
              aria-label={open ? "閉じる" : "開く"}
              onClick={() => toggle(node.id)}
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded",
                !hasChildren && "invisible",
              )}
            >
              <ChevronRight
                className={cn("size-3 text-muted-foreground transition-transform", open && "rotate-90")}
              />
            </button>
            <button
              type="button"
              onClick={() => onSelect?.(node.id)}
              onDoubleClick={() => onOpen?.(node.id)}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
            >
              {node.icon}
              <span className="min-w-0 flex-1 truncate">{node.name}</span>
              {node.meta && (
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{node.meta}</span>
              )}
            </button>
          </div>
        ) : (
          <Link
            href={node.href!}
            className={cn(rowClass, "text-muted-foreground hover:text-foreground")}
            style={indent}
          >
            <span className="size-4 shrink-0" />
            {node.icon ?? <FileText className="size-3.5 shrink-0" />}
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
            {node.meta && <span className="shrink-0 text-xs tabular-nums">{node.meta}</span>}
          </Link>
        )}
        {isFolder && open && hasChildren && <ul>{node.children!.map((c) => render(c, depth + 1))}</ul>}
      </li>
    )
  }

  return <ul>{nodes.map((n) => render(n, 0))}</ul>
}
