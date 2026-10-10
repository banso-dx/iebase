"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, House, Package, MapPin, Settings, Wallet, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon; also?: string[] }[] = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/items", label: "モノ", icon: Package },
  { href: "/homes", label: "家", icon: House, also: ["/rooms"] },
  { href: "/carry", label: "持ち物", icon: Wallet },
  { href: "/locations", label: "保管場所", icon: MapPin },
  { href: "/settings", label: "設定", icon: Settings },
]

function isActive(pathname: string, { href, also = [] }: { href: string; also?: string[] }) {
  if (href === "/") return pathname === "/"
  return [href, ...also].some((p) => pathname.startsWith(p))
}

/** PC 用：ヘッダー内の横並びナビ */
export function HeaderNav() {
  const pathname = usePathname()

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
            isActive(pathname, item) && "bg-muted font-medium text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

/**
 * スマホ用：下部タブバー（iOS 版のタブ構成と揃える）。
 * backdrop-filter を持つ要素の中に置くと fixed の基準がずれるため、ヘッダーの外に置くこと
 */
export function TabBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-6">
        {NAV_ITEMS.map(({ icon: Icon, ...item }) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground",
                isActive(pathname, item) && "text-primary"
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
