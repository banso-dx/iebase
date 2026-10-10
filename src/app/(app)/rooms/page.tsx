import { redirect } from "next/navigation"

// 部屋は家の中から辿る
export default function RoomsPage() {
  redirect("/homes")
}
