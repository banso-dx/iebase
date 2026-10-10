"use client"

import { useTransition } from "react"
import { Trash2 } from "lucide-react"
import { deleteItem } from "@/app/(app)/items/actions"
import { Button } from "@/components/ui/button"

export function DeleteItemButton({ itemId }: { itemId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm("このモノを削除しますか？写真も削除され、元に戻せません。")) return
        startTransition(() => deleteItem(itemId))
      }}
    >
      <Trash2 />
      削除する
    </Button>
  )
}
