"use client";

import { FolderKanban, History, LayoutDashboard, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban, exact: false },
  { href: "/dashboard/activity", label: "Activity", icon: History, exact: false },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: false },
] as const;

/**
 * Dashboard navigation (Task 05).
 *
 * Client component because the active link depends on the current path. Later
 * tasks (issues, projects, reports, activity) add entries here rather than
 * inventing a second navigation.
 */
export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1" aria-label="Dashboard">
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
