"use client"

import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"
import { setConsent } from "@/app/(app)/settings/actions"
import { Switch } from "@/components/ui/switch"
import type { Enums } from "@/types/database"

export function ConsentSwitch({
  purpose,
  granted,
  title,
  description,
}: {
  purpose: Enums<"consent_purpose">
  granted: boolean
  title: string
  description: string
}) {
  const [optimistic, setOptimistic] = useOptimistic(granted)
  const [, startTransition] = useTransition()
  const id = `consent-${purpose}`

  return (
    <div className="flex items-start gap-4 px-4 py-4">
      <div className="flex-1 space-y-1">
        <label htmlFor={id} className="text-sm font-medium">
          {title}
        </label>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={optimistic}
        onCheckedChange={(checked) =>
          startTransition(async () => {
            setOptimistic(checked)
            try {
              await setConsent(purpose, checked)
            } catch {
              toast.error("保存できませんでした")
            }
          })
        }
      />
    </div>
  )
}
