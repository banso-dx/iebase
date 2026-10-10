import Link from "next/link"
import { Boxes, Plus } from "lucide-react"
import { HeaderNav, TabBar } from "@/components/app/app-nav"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Boxes className="size-5 text-primary" />
            kurabase
          </Link>
          <HeaderNav />
          <Link href="/items/new" className={cn(buttonVariants({ size: "sm" }), "ml-auto")}>
            <Plus />
            登録
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 md:pb-10">{children}</main>
      <TabBar />
    </div>
  )
}
