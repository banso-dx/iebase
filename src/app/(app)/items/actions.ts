"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { PHOTO_BUCKET } from "@/lib/data/items"
import { requireUser } from "@/lib/supabase/server"
import type { Enums, TablesInsert } from "@/types/database"

export type SaveItemResult = { id: string; error?: undefined } | { id?: undefined; error: string }

const text = (fd: FormData, key: string) => {
  const v = String(fd.get(key) ?? "").trim()
  return v === "" ? null : v
}
const int = (fd: FormData, key: string) => {
  const v = text(fd, key)
  if (v == null) return null
  const n = Number(v.replace(/[,，]/g, ""))
  return Number.isInteger(n) && n >= 0 ? n : NaN
}

function parseItem(fd: FormData): Omit<TablesInsert<"items">, "user_id"> | string {
  const name = text(fd, "name")
  if (!name) return "名前を入力してください"

  const quantity = int(fd, "quantity") ?? 1
  const purchasePrice = int(fd, "purchase_price")
  if (Number.isNaN(quantity) || Number.isNaN(purchasePrice)) return "数量・価格は0以上の整数で入力してください"

  const jan = text(fd, "jan_code")
  if (jan && !/^[0-9]{8,14}$/.test(jan)) return "JANコードは8〜14桁の数字で入力してください"

  const categoryId = text(fd, "category_id")

  return {
    name,
    brand: text(fd, "brand"),
    model_number: text(fd, "model_number"),
    jan_code: jan,
    color: text(fd, "color"),
    size: text(fd, "size"),
    quantity,
    category_id: categoryId ? Number(categoryId) : null,
    location_id: text(fd, "location_id"),
    condition: text(fd, "condition") as Enums<"item_condition"> | null,
    status: (text(fd, "status") ?? "owned") as Enums<"item_status">,
    purchased_at: text(fd, "purchased_at"),
    purchase_store: text(fd, "purchase_store"),
    purchase_channel: text(fd, "purchase_channel") as Enums<"purchase_channel"> | null,
    purchase_price: purchasePrice,
    expires_at: text(fd, "expires_at"),
    warranty_until: text(fd, "warranty_until"),
    notes: text(fd, "notes"),
  }
}

/** 写真のアップロードはクライアントから Storage に直接行う（iOS と同じ流れ） */
export async function saveItem(itemId: string | null, formData: FormData): Promise<SaveItemResult> {
  const parsed = parseItem(formData)
  if (typeof parsed === "string") return { error: parsed }

  const { supabase } = await requireUser()
  const result = itemId
    ? await supabase.from("items").update(parsed).eq("id", itemId).select("id").single()
    : await supabase.from("items").insert(parsed).select("id").single()

  if (result.error) return { error: "保存に失敗しました。時間をおいて再度お試しください。" }

  revalidatePath("/", "layout")
  return { id: result.data.id }
}

export async function deleteItem(itemId: string) {
  const { supabase } = await requireUser()

  const { data: photos } = await supabase
    .from("item_photos")
    .select("storage_path")
    .eq("item_id", itemId)
  if (photos?.length) {
    await supabase.storage.from(PHOTO_BUCKET).remove(photos.map((p) => p.storage_path))
  }
  await supabase.from("items").delete().eq("id", itemId)

  revalidatePath("/", "layout")
  redirect("/items")
}
