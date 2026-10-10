import { Plus } from "lucide-react"
import { createCarry } from "@/app/(app)/carry/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { CARRY_KINDS } from "@/lib/carry"
import { LOCATION_KIND_LABELS } from "@/lib/labels"

/** parentId を渡すと、その持ち物の中に作る */
export function CarryForm({ parentId, title }: { parentId?: string; title: string }) {
  return (
    <form action={createCarry} className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input name="name" placeholder="名前（例：通勤バッグ、長財布）" required maxLength={100} className="flex-1" />
        <NativeSelect name="kind" defaultValue={parentId ? "pouch" : "bag"} aria-label="種類" className="sm:w-36">
          {CARRY_KINDS.map((k) => (
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
  )
}
