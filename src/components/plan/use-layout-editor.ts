"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { updateLayout } from "@/app/(app)/rooms/actions"
import type { Layout } from "@/lib/rooms"

const SAVE_DELAY_MS = 400
const HISTORY_LIMIT = 100

type Change = { id: string; before: Partial<Layout>; after: Partial<Layout> }

/**
 * 2D 編集画面の共通ロジック：
 * 変更の表示（サーバーの値に上書き）、遅延保存、元に戻す / やり直す、キーボード操作
 */
export function useLayoutEditor<T extends { id: string; layout: Layout }>({
  items,
  enabled = true,
  normalize,
}: {
  items: T[]
  enabled?: boolean
  /** 変更後のレイアウトを補正する（部屋からはみ出さないようにする等） */
  normalize?: (next: Layout) => Partial<Layout>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, Partial<Layout>>>({})
  const pendingSave = useRef<
    Record<string, { timer?: ReturnType<typeof setTimeout>; patch: Partial<Layout> }>
  >({})
  const history = useRef<{ undo: Change[]; redo: Change[] }>({ undo: [], redo: [] })
  // ボタンの有効・無効の表示用（履歴そのものは ref に持つ）
  const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 })
  const [, startTransition] = useTransition()

  const merged = items.map((i) => ({ ...i, layout: { ...i.layout, ...overrides[i.id] } }))
  const selected = merged.find((i) => i.id === selectedId) ?? null

  const syncHistory = () =>
    setHistorySize({ undo: history.current.undo.length, redo: history.current.redo.length })

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

  /** 画面に反映し、少し待ってから保存する（save: false はドラッグ中の表示だけ） */
  const apply = (id: string, patch: Partial<Layout>, { save = true, immediate = false } = {}) => {
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    if (!save) return
    const entry = (pendingSave.current[id] ??= { patch: {} })
    entry.patch = { ...entry.patch, ...patch }
    clearTimeout(entry.timer)
    if (immediate) flush(id)
    else entry.timer = setTimeout(() => flush(id), SAVE_DELAY_MS)
  }

  const record = (change: Change) => {
    history.current.undo = [...history.current.undo, change].slice(-HISTORY_LIMIT)
    history.current.redo = []
    syncHistory()
  }

  const pick = (layout: Layout, keys: string[]) =>
    Object.fromEntries(keys.map((k) => [k, layout[k as keyof Layout]])) as Partial<Layout>

  /** 値を変えて履歴に積む */
  const commitChange = (id: string, patch: Partial<Layout>) => {
    const item = merged.find((i) => i.id === id)
    if (!item) return
    const next = { ...item.layout, ...patch }
    const after = { ...patch, ...normalize?.(next) }
    const before = pick(item.layout, Object.keys(after))
    apply(id, after)
    record({ id, before, after })
  }

  /** ドラッグ確定時。表示済みの現在値を保存し、移動前の値を履歴に積む */
  const commitDrag = (id: string, before: Partial<Layout>) => {
    const item = merged.find((i) => i.id === id)
    if (!item) return
    const after = pick(item.layout, Object.keys(before))
    apply(id, after)
    record({ id, before, after })
  }

  const undo = () => {
    const change = history.current.undo.pop()
    if (!change) return
    history.current.redo.push(change)
    apply(change.id, change.before, { immediate: true })
    setSelectedId(change.id)
    syncHistory()
  }

  const redo = () => {
    const change = history.current.redo.pop()
    if (!change) return
    history.current.undo.push(change)
    apply(change.id, change.after, { immediate: true })
    setSelectedId(change.id)
    syncHistory()
  }

  const rotate = (id: string) => {
    const item = merged.find((i) => i.id === id)
    if (item) commitChange(id, { rotation_deg: (item.layout.rotation_deg + 90) % 360 })
  }

  /** 「自動で並べる」など一括の変更。保存は呼び出し側で行い、履歴は消す */
  const replaceAll = (patches: { id: string; patch: Partial<Layout> }[]) => {
    setOverrides((prev) => {
      const next = { ...prev }
      for (const { id, patch } of patches) next[id] = { ...next[id], ...patch }
      return next
    })
    history.current = { undo: [], redo: [] }
    syncHistory()
  }

  // キーボード操作（最新の状態を参照するため ref 経由で呼ぶ）
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    keyHandler.current = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (e.key === "Escape") return setSelectedId(null)
      if (!selected || mod) return

      const step = e.shiftKey ? 10 : 1
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      if (delta[e.key]) {
        e.preventDefault()
        const [dx, dz] = delta[e.key]
        commitChange(selected.id, { x_cm: selected.layout.x_cm + dx, z_cm: selected.layout.z_cm + dz })
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault()
        rotate(selected.id)
      }
    }
  })
  useEffect(() => {
    if (!enabled) return
    const listener = (e: KeyboardEvent) => keyHandler.current(e)
    window.addEventListener("keydown", listener)
    return () => window.removeEventListener("keydown", listener)
  }, [enabled])

  return {
    merged,
    selected,
    selectedId,
    setSelectedId,
    apply,
    commitChange,
    commitDrag,
    undo,
    redo,
    rotate,
    replaceAll,
    historySize,
  }
}

export function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  )
}
