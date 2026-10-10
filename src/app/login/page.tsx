import type { Metadata } from "next"
import { Boxes } from "lucide-react"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "ログイン" }

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Boxes className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">kurabase</h1>
          <p className="text-sm text-muted-foreground">家にあるモノを、まるごと管理。</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
