"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type AuthState = { error?: string; message?: string } | undefined

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  }
}

export async function authenticate(state: AuthState, formData: FormData): Promise<AuthState> {
  return formData.get("mode") === "signup" ? signUp(state, formData) : signIn(state, formData)
}

async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(readCredentials(formData))
  if (error) return { error: "メールアドレスかパスワードが正しくありません" }
  redirect("/")
}

async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const credentials = readCredentials(formData)
  if (credentials.password.length < 8) {
    return { error: "パスワードは8文字以上にしてください" }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp(credentials)
  if (error) return { error: error.message }

  // メール確認が有効な環境ではセッションが返らない
  if (!data.session) {
    return { message: "確認メールを送信しました。メール内のリンクから登録を完了してください。" }
  }
  redirect("/")
}
