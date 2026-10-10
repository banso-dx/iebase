"use server"

import { revalidatePath } from "next/cache"
import { CONSENT_POLICY_VERSION } from "@/lib/labels"
import { requireUser } from "@/lib/supabase/server"
import type { Enums } from "@/types/database"

export async function updateProfile(formData: FormData) {
  const value = (key: string) => String(formData.get(key) ?? "").trim() || null
  const birthYear = value("birth_year")

  const { supabase, user } = await requireUser()
  await supabase
    .from("profiles")
    .update({
      display_name: value("display_name"),
      birth_year: birthYear ? Number(birthYear) : null,
      gender: value("gender"),
      prefecture: value("prefecture"),
    })
    .eq("id", user.id)
  revalidatePath("/settings")
}

/** 同意は上書きせず履歴として追記する */
export async function setConsent(purpose: Enums<"consent_purpose">, granted: boolean) {
  const { supabase } = await requireUser()
  const { error } = await supabase
    .from("data_sharing_consents")
    .insert({ purpose, granted, policy_version: CONSENT_POLICY_VERSION })
  if (error) throw new Error("同意状態を保存できませんでした")
  revalidatePath("/settings")
}
