"use client";

import { UserButton } from "@clerk/nextjs";
import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  LayoutDashboard,
  Mail,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const MAZATI = "#51836D";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  shopifyBadge?: boolean;
};

const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Orders", icon: Package },
  {
    href: "/dashboard/shopify-queue",
    label: "Shopify Orders",
    icon: ShoppingBag,
    shopifyBadge: true,
  },
  { href: "/dashboard/drivers", label: "Drivers", icon: Truck },
  { href: "/dashboard/pods", label: "POD Records", icon: ClipboardList },
  { href: "/dashboard/email-queue", label: "Email Queue", icon: Mail },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  pathname,
  iconOnly,
  onNavigate,
  shopifyPendingCount,
}: {
  pathname: string;
  iconOnly?: boolean;
  onNavigate?: () => void;
  shopifyPendingCount: number;
}) {
  return (
    <nav className="flex flex-col gap-0.5 p-2" aria-label="Main">
      {nav.map(({ href, label, icon: Icon, shopifyBadge }) => {
        const active = isActive(pathname, href);
        const showBadge = shopifyBadge && shopifyPendingCount > 0;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors",
              active &&
                "border-l-[3px] bg-gray-100 text-gray-900 shadow-sm",
              !active && "border-l-[3px] border-transparent",
            )}
            style={
              active
                ? { borderLeftColor: MAZATI }
                : { borderLeftColor: "transparent" }
            }
          >
            <span className="relative shrink-0">
              <Icon
                className={cn(
                  "size-5",
                  active ? "text-gray-900" : "text-gray-500",
                )}
                aria-hidden
              />
              {iconOnly && showBadge ? (
                <span
                  className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-red-600"
                  aria-hidden
                />
              ) : null}
            </span>
            {!iconOnly ? (
              <>
                <span className="min-w-0 flex-1">{label}</span>
                {showBadge ? (
                  <span className="shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums">
                    {shopifyPendingCount > 99 ? "99+" : shopifyPendingCount}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="sr-only">{label}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardShell({
  children,
  shopifyPendingCount = 0,
}: {
  children: React.ReactNode;
  shopifyPendingCount?: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar — 240px */}
      <aside
        className="hidden w-[240px] shrink-0 flex-col border-r border-gray-200 bg-white lg:flex"
        aria-label="Sidebar"
      >
        <div className="border-b border-gray-200 px-4 py-4">
          <span className="text-base font-semibold text-gray-900">Mazati POD</span>
        </div>
        <NavLinks
          pathname={pathname}
          shopifyPendingCount={shopifyPendingCount}
        />
      </aside>

      {/* Tablet icon rail — 768px–1023px */}
      <aside
        className="hidden w-16 shrink-0 flex-col border-r border-gray-200 bg-white md:flex lg:hidden"
        aria-label="Sidebar icons"
      >
        <div className="flex h-14 items-center justify-center border-b border-gray-200">
          <span className="text-xs font-bold text-[#51836D]" aria-hidden>
            M
          </span>
        </div>
        <NavLinks
          pathname={pathname}
          iconOnly
          shopifyPendingCount={shopifyPendingCount}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 md:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="size-5 text-gray-700" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0">
                <SheetHeader className="border-b border-gray-200 px-4 py-4 text-left">
                  <SheetTitle className="text-base font-semibold">
                    Mazati POD
                  </SheetTitle>
                </SheetHeader>
                <NavLinks
                  pathname={pathname}
                  shopifyPendingCount={shopifyPendingCount}
                  onNavigate={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <span className="font-semibold text-gray-900 lg:hidden">
              Mazati POD
            </span>
          </div>
          <div className="hidden flex-1 lg:block" />
          <UserButton />
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
