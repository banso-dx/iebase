"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Pencil, X } from "lucide-react"
import { toast } from "sonner"
import { renameLocation } from "@/app/(app)/locations/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** 保管場所（家・部屋など）の名前をその場で変更できる見出し */
export function EditableTitle({ locationId, name }: { locationId: string; name: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <h1 className="truncate text-xl font-semibold">{name}</h1>
        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label="名前を変更">
          <Pencil />
        </Button>
      </div>
    )
  }

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        const next = String(new FormData(e.currentTarget).get("name") ?? "").trim()
        if (!next || next === name) return setEditing(false)
        startTransition(async () => {
          try {
            await renameLocation(locationId, next)
            setEditing(false)
            router.refresh()
          } catch {
            toast.error("名前を変更できませんでした")
          }
        })
      }}
    >
      <Input
        name="name"
        defaultValue={name}
        aria-label="名前"
        required
        maxLength={100}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        className="h-9 w-56 text-base"
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
      />
      <Button type="submit" size="icon-sm" disabled={pending} aria-label="保存">
        <Check />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(false)} aria-label="キャンセル">
        <X />
      </Button>
    </form>
  )
}
