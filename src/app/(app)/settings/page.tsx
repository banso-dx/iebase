import type { Metadata } from "next"
import { ConsentSwitch } from "@/components/settings/consent-switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { CONSENT_POLICY_VERSION, CONSENT_PURPOSES } from "@/lib/labels"
import { PREFECTURES } from "@/lib/prefectures"
import { requireUser } from "@/lib/supabase/server"
import { updateProfile } from "./actions"

export const metadata: Metadata = { title: "設定" }

const GENDERS = [
  ["female", "女性"],
  ["male", "男性"],
  ["other", "その他"],
  ["no_answer", "回答しない"],
] as const

export default async function SettingsPage() {
  const { supabase, user } = await requireUser()
  const [{ data: profile }, { data: consents }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("current_consents").select("purpose, granted, policy_version"),
  ])

  // 文言のバージョンが変わった同意は無効扱い（再同意が必要）
  const isGranted = (purpose: string) =>
    consents?.some(
      (c) => c.purpose === purpose && c.granted && c.policy_version === CONSENT_POLICY_VERSION
    ) ?? false

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <h1 className="text-xl font-semibold">設定</h1>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-semibold">プロフィール</h2>
          <p className="text-xs text-muted-foreground">
            任意項目です。統計データとして利用する場合も、個人を特定できない形で扱います。
          </p>
        </div>
        <form action={updateProfile} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="display_name">表示名</Label>
            <Input id="display_name" name="display_name" defaultValue={profile?.display_name ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birth_year">生まれ年</Label>
            <Input
              id="birth_year"
              name="birth_year"
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              placeholder="1990"
              defaultValue={profile?.birth_year ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gender">性別</Label>
            <NativeSelect id="gender" name="gender" defaultValue={profile?.gender ?? ""}>
              <option value="">未選択</option>
              {GENDERS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prefecture">お住まいの都道府県</Label>
            <NativeSelect id="prefecture" name="prefecture" defaultValue={profile?.prefecture ?? ""}>
              <option value="">未選択</option>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">保存する</Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-semibold">データの利用について</h2>
          <p className="text-xs text-muted-foreground">
            いつでも変更できます。オフにすると、それ以降のデータは提供・利用されません。
          </p>
        </div>
        <div className="divide-y rounded-xl border bg-card">
          {CONSENT_PURPOSES.map((c) => (
            <ConsentSwitch key={c.purpose} {...c} granted={isGranted(c.purpose)} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">アカウント</h2>
        <div className="flex items-center justify-between rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline">
              ログアウト
            </Button>
          </form>
        </div>
      </section>
    </div>
  )
}
