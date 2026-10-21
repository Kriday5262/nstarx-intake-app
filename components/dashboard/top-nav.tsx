"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Inbox, Settings, ChevronDown, Menu, X } from "lucide-react";

interface DashboardAdmin {
  adminId: number;
  email: string;
  name: string;
}

interface TopNavProps {
  admin: DashboardAdmin;
}

const navItems = [
  { label: "Requests", href: "/dashboard/requests", icon: Inbox },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function TopNav({ admin }: TopNavProps) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/admin/logout", {
        method: "POST",
        redirect: "manual",
      });
      if (response.ok || response.status === 0 || response.status === 303) {
        router.push("/login");
        return;
      }
      console.error("Logout failed:", response.status);
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-brand-zebra">
        <div className="h-14 md:h-16 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              className="md:hidden inline-flex items-center justify-center rounded-[4px] p-2 text-brand-ink hover:bg-brand-zebra focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-light min-h-11 min-w-11"
              aria-label={isMobileMenuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-dashboard-nav"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href="/dashboard/requests" className="flex items-center gap-2 md:gap-3 min-w-0 min-h-11">
              <Image
                src="/nstarx-logo-horizontal.png"
                alt="NStarX"
                width={140}
                height={36}
                priority
                className="h-7 md:h-8 w-auto"
              />
              <span className="hidden sm:inline-block h-5 w-px bg-brand-ink/20" />
              <span className="font-heading font-black text-brand-ink text-base md:text-lg truncate">
                NStarX Project Intake System
              </span>
            </Link>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((v) => !v)}
              className="flex items-center gap-2 rounded-[4px] px-2 py-2 text-sm font-medium text-brand-ink hover:bg-brand-zebra focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-light min-h-11"
              aria-haspopup="menu"
              aria-expanded={isDropdownOpen}
            >
              <span className="hidden sm:inline truncate max-w-[10rem]">{admin.name}</span>
              <span className="inline sm:hidden max-w-[6rem] truncate">{admin.name}</span>
              <ChevronDown
                className={`h-4 w-4 text-brand-ink/60 transition-transform ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            <div
              role="menu"
              className={`absolute right-0 mt-2 w-56 origin-top-right rounded-[4px] bg-white ring-1 ring-black/5 focus:outline-none ${
                isDropdownOpen ? "block" : "hidden"
              }`}
            >
              <div className="px-4 py-3 border-b border-brand-zebra">
                <p className="text-sm font-semibold text-brand-ink truncate">{admin.name}</p>
                <p className="text-xs text-brand-ink/70 truncate">{admin.email}</p>
              </div>
              <Link
                href="/dashboard/settings"
                role="menuitem"
                onClick={() => setIsDropdownOpen(false)}
                className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-zebra focus:bg-brand-zebra focus:outline-none min-h-11"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-zebra focus:bg-brand-zebra focus:outline-none disabled:opacity-60 min-h-11"
              >
                {isLoggingOut ? "Logging out…" : "Log out"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile navigation drawer */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-brand-ink/30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        id="mobile-dashboard-nav"
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform bg-white border-r border-brand-zebra transition-transform duration-200 ease-in-out md:hidden",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col pt-16">
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
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 rounded-[4px] px-3 py-3 text-sm font-medium transition-colors min-h-11",
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
          <div className="border-t border-brand-zebra p-4 text-xs text-brand-ink/50">
            NStarX Intake Form
          </div>
        </div>
      </aside>
    </>
  );
}
