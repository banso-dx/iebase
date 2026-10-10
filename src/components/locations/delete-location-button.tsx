"use client"

import { useTransition } from "react"
import { Trash2 } from "lucide-react"
import { deleteLocation } from "@/app/(app)/locations/actions"
import { Button } from "@/components/ui/button"

export function DeleteLocationButton({ locationId, name }: { locationId: string; name: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`${name}を削除`}
      disabled={pending}
      onClick={() => {
        if (!confirm(`「${name}」を削除しますか？中のモノは「場所未設定」になります。`)) return
        startTransition(() => deleteLocation(locationId))
      }}
    >
      <Trash2 />
    </Button>
  )
}
