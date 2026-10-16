"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Inbox, Settings } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  {
    label: "Requests",
    href: "/dashboard/requests",
    icon: Inbox,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop on mobile when open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-brand-ink/30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        id="dashboard-sidebar"
        className={cn(
          "fixed md:static inset-y-0 left-0 z-40 w-60 transform bg-white border-r border-brand-zebra transition-transform duration-200 ease-in-out md:transform-none",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col pt-16 md:pt-4">
          <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Dashboard navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname !== null &&
                (pathname === item.href || pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (window.innerWidth < 768) onClose();
                  }}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand-purple/10 text-brand-purple"
                      : "text-brand-ink/80 hover:bg-brand-zebra hover:text-brand-ink"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-colors",
                      isActive
                        ? "text-brand-purple"
                        : "text-brand-ink/50 group-hover:text-brand-ink"
                    )}
                    aria-hidden="true"
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-brand-zebra p-4 text-xs text-brand-ink/50 md:hidden">
            NStarX Intake Form
          </div>
        </div>
      </aside>
    </>
  );
}
