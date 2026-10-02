"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Home, Settings, Users } from "@/components/icons";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/dashboard", label: "Lyouma", Icon: Home },
  { href: "/dashboard/planning", label: "Planning", Icon: Calendar },
  { href: "/dashboard/clients", label: "Clients", Icon: Users },
  { href: "/dashboard/reglages", label: "Reglages", Icon: Settings },
] as const;

/** Nizar's four destinations. Services live under Reglages. */
export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  return (
    <nav
      aria-label="Navigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid h-nav max-w-md grid-cols-4">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-200",
                  active ? "text-gold" : "text-muted active:text-fg",
                )}
              >
                <Icon width={22} height={22} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
