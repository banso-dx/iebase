"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authenticate } from "./actions"

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [state, action, pending] = useActionState(authenticate, undefined)

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="mode" value={mode} />
      <div className="space-y-2">
        <Label htmlFor="email">メールアドレス</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">パスワード</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={mode === "signup" ? 8 : undefined}
          required
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.message && <p className="text-sm text-muted-foreground">{state.message}</p>}

      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {mode === "signin" ? "ログイン" : "アカウントを作成"}
      </Button>

      <button
        type="button"
        className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin" ? "はじめての方はこちら（新規登録）" : "アカウントをお持ちの方はこちら"}
      </button>
    </form>
  )
}
