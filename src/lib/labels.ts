import type { Enums } from "@/types/database"

export const ITEM_STATUS_LABELS: Record<Enums<"item_status">, string> = {
  owned: "所有中",
  listed: "出品中",
  sold: "売却済み",
  disposed: "処分済み",
  given_away: "譲渡済み",
}

export const ITEM_CONDITION_LABELS: Record<Enums<"item_condition">, string> = {
  new: "新品・未使用",
  like_new: "未使用に近い",
  good: "目立った傷や汚れなし",
  fair: "やや傷や汚れあり",
  poor: "傷や汚れあり",
}

export const PURCHASE_CHANNEL_LABELS: Record<Enums<"purchase_channel">, string> = {
  store: "店舗",
  online: "オンライン",
  gift: "もらい物",
  secondhand: "中古",
  other: "その他",
}

export const LOCATION_KIND_LABELS: Record<Enums<"location_kind">, string> = {
  home: "家",
  room: "部屋",
  closet: "クローゼット",
  shelf: "棚",
  drawer: "引き出し",
  box: "収納ボックス",
  bag: "バッグ",
  wallet: "財布",
  other: "その他",
}

export const CONSENT_PURPOSES: {
  purpose: Enums<"consent_purpose">
  title: string
  description: string
}[] = [
  {
    purpose: "anonymized_analytics",
    title: "統計データとしての利用",
    description:
      "個人を特定できない形に加工したうえで、購買・保有傾向の統計としてサービス改善や市場分析に利用します。",
  },
  {
    purpose: "third_party_provision",
    title: "提携企業へのデータ提供",
    description:
      "登録したモノの情報（購入時期・購入場所・価格など）を、提携企業に提供することに同意します。氏名・メールアドレスは提供しません。",
  },
  {
    purpose: "resale_offers",
    title: "買取・出品の提案",
    description:
      "使っていないモノについて、提携する買取サービスやフリマアプリでの売却を提案するお知らせを受け取ります。",
  },
]

/** 同意文言を変えたら上げる。履歴に残り、再同意の判定に使う */
export const CONSENT_POLICY_VERSION = "2026-10-10"

export function formatYen(value: number | null | undefined) {
  if (value == null) return "—"
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(value)
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value))
}

/** 期限までの日数（過ぎていれば負） */
export function daysUntil(value: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(value).getTime() - today.getTime()) / 86_400_000)
}
