"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ImagePlus, X } from "lucide-react"
import { toast } from "sonner"
import { saveItem } from "@/app/(app)/items/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { PHOTO_BUCKET } from "@/lib/data/items"
import {
  ITEM_CONDITION_LABELS,
  ITEM_STATUS_LABELS,
  PURCHASE_CHANNEL_LABELS,
} from "@/lib/labels"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/types/database"

type Option = { id: string | number; label: string }
export type ExistingPhoto = { id: string; storage_path: string; url?: string }

const ACCEPT = "image/jpeg,image/png,image/webp"

export function ItemForm({
  userId,
  item,
  photos = [],
  defaultLocationId,
  categories,
  locations,
}: {
  userId: string
  item?: Tables<"items">
  photos?: ExistingPhoto[]
  defaultLocationId?: string
  categories: Option[]
  locations: Option[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [existing, setExisting] = useState(photos)
  const [newFiles, setNewFiles] = useState<{ file: File; preview: string }[]>([])

  const addFiles = (files: FileList | null) => {
    if (!files) return
    setNewFiles((prev) => [
      ...prev,
      ...Array.from(files).map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ])
  }

  const removeExisting = async (photo: ExistingPhoto) => {
    const supabase = createClient()
    const { error } = await supabase.from("item_photos").delete().eq("id", photo.id)
    if (error) return toast.error("写真を削除できませんでした")
    await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path])
    setExisting((prev) => prev.filter((p) => p.id !== photo.id))
  }

  const onSubmit = (formData: FormData) => {
    setError(undefined)
    startTransition(async () => {
      const result = await saveItem(item?.id ?? null, formData)
      if (result.id === undefined) {
        setError(result.error)
        return
      }

      const itemId = result.id
      if (newFiles.length > 0) {
        const supabase = createClient()
        const uploaded = await Promise.all(
          newFiles.map(async ({ file }, i) => {
            const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
            const path = `${userId}/${itemId}/${crypto.randomUUID()}.${ext}`
            const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
              contentType: file.type,
            })
            return error ? null : { item_id: itemId, storage_path: path, sort_order: existing.length + i }
          })
        )
        const rows = uploaded.filter((r) => r !== null)
        if (rows.length > 0) await supabase.from("item_photos").insert(rows)
        if (rows.length < newFiles.length) toast.error("一部の写真をアップロードできませんでした")
      }

      toast.success(item ? "更新しました" : "登録しました")
      router.push(`/items/${itemId}`)
      router.refresh()
    })
  }

  return (
    <form action={onSubmit} className="space-y-8">
      <FormSection title="写真">
        <div className="flex flex-wrap gap-2">
          {existing.map((p) => (
            <Thumb key={p.id} src={p.url} onRemove={() => removeExisting(p)} />
          ))}
          {newFiles.map((f, i) => (
            <Thumb
              key={f.preview}
              src={f.preview}
              onRemove={() => setNewFiles((prev) => prev.filter((_, j) => j !== i))}
            />
          ))}
          <label className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted/50">
            <ImagePlus className="size-5" />
            追加
            <input
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ""
              }}
            />
          </label>
        </div>
      </FormSection>

      <FormSection title="基本情報">
        <Field label="名前" htmlFor="name" required>
          <Input id="name" name="name" defaultValue={item?.name} required maxLength={200} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="カテゴリ" htmlFor="category_id">
            <NativeSelect id="category_id" name="category_id" defaultValue={item?.category_id ?? ""}>
              <option value="">未選択</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="保管場所" htmlFor="location_id">
            <NativeSelect id="location_id" name="location_id" defaultValue={item?.location_id ?? defaultLocationId ?? ""}>
              <option value="">未選択</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="ブランド・メーカー" htmlFor="brand">
            <Input id="brand" name="brand" defaultValue={item?.brand ?? ""} />
          </Field>
          <Field label="型番" htmlFor="model_number">
            <Input id="model_number" name="model_number" defaultValue={item?.model_number ?? ""} />
          </Field>
          <Field label="色" htmlFor="color">
            <Input id="color" name="color" defaultValue={item?.color ?? ""} />
          </Field>
          <Field label="サイズ" htmlFor="size">
            <Input id="size" name="size" defaultValue={item?.size ?? ""} />
          </Field>
          <Field label="数量" htmlFor="quantity">
            <Input id="quantity" name="quantity" type="number" min={0} defaultValue={item?.quantity ?? 1} />
          </Field>
          <Field label="JANコード（バーコード）" htmlFor="jan_code">
            <Input
              id="jan_code"
              name="jan_code"
              inputMode="numeric"
              pattern="[0-9]{8,14}"
              defaultValue={item?.jan_code ?? ""}
            />
          </Field>
          <Field label="状態" htmlFor="condition">
            <NativeSelect id="condition" name="condition" defaultValue={item?.condition ?? ""}>
              <option value="">未選択</option>
              {Object.entries(ITEM_CONDITION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="ステータス" htmlFor="status">
            <NativeSelect id="status" name="status" defaultValue={item?.status ?? "owned"}>
              {Object.entries(ITEM_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </FormSection>

      <FormSection title="購入情報">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="購入日" htmlFor="purchased_at">
            <Input id="purchased_at" name="purchased_at" type="date" defaultValue={item?.purchased_at ?? ""} />
          </Field>
          <Field label="購入金額（円）" htmlFor="purchase_price">
            <Input
              id="purchase_price"
              name="purchase_price"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={item?.purchase_price ?? ""}
            />
          </Field>
          <Field label="購入場所（店名・サイト名）" htmlFor="purchase_store">
            <Input id="purchase_store" name="purchase_store" defaultValue={item?.purchase_store ?? ""} />
          </Field>
          <Field label="購入方法" htmlFor="purchase_channel">
            <NativeSelect
              id="purchase_channel"
              name="purchase_channel"
              defaultValue={item?.purchase_channel ?? ""}
            >
              <option value="">未選択</option>
              {Object.entries(PURCHASE_CHANNEL_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </FormSection>

      <FormSection title="期限">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="使用・消費期限" htmlFor="expires_at">
            <Input id="expires_at" name="expires_at" type="date" defaultValue={item?.expires_at ?? ""} />
          </Field>
          <Field label="保証期限" htmlFor="warranty_until">
            <Input
              id="warranty_until"
              name="warranty_until"
              type="date"
              defaultValue={item?.warranty_until ?? ""}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="メモ">
        <Textarea name="notes" rows={4} defaultValue={item?.notes ?? ""} aria-label="メモ" />
      </FormSection>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" className="h-10 flex-1 sm:flex-none sm:px-8" disabled={pending}>
          {pending ? "保存中…" : item ? "更新する" : "登録する"}
        </Button>
        <Button type="button" variant="ghost" className="h-10" onClick={() => router.back()}>
          キャンセル
        </Button>
      </div>
    </form>
  )
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-sm font-semibold text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  )
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  )
}

function Thumb({ src, onRemove }: { src?: string; onRemove: () => void }) {
  return (
    <div className="relative size-24 overflow-hidden rounded-lg bg-muted">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- blob/署名付きURLのため next/image を使わない
        <img src={src} alt="" className="size-full object-cover" />
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="写真を削除"
        className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}
