import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { CarryForm } from "@/components/carry/carry-form"
import { CarryIcon } from "@/components/carry/carry-icon"
import { getLocationTree } from "@/lib/data/locations"
import { LOCATION_KIND_LABELS } from "@/lib/labels"
import { requireUser } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "持ち物" }

export default async function CarryPage() {
  const { supabase } = await requireUser()
  const tree = await getLocationTree(supabase)
  const roots = tree.carryRoots()

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">持ち物</h1>
        <p className="text-sm text-muted-foreground">
          財布やカバンなど、持ち歩くものの中身を管理します。家や部屋とは別に扱います。
        </p>
      </div>

      {roots.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roots.map((c) => {
            const inner = tree.descendants(c.id).filter((d) => d.id !== c.id)
            return (
              <li key={c.id}>
                <Link
                  href={`/carry/${c.id}`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
                >
                  <span className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CarryIcon kind={c.kind} className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {LOCATION_KIND_LABELS[c.kind]}・モノ {tree.itemCount(c.id)}点
                      {inner.length > 0 && `・${inner.map((i) => i.name).join("、")}入り`}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <div className="max-w-xl">
        <CarryForm title="財布・カバンを追加" />
      </div>
    </div>
  )
}
