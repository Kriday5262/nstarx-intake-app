"use client";

import Image from "next/image";
import { Menu, X, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface DashboardAdmin {
  adminId: number;
  email: string;
  name: string;
}

interface TopNavProps {
  admin: DashboardAdmin;
  isSidebarOpen: boolean;
  onMenuToggle: () => void;
}

export function TopNav({ admin, isSidebarOpen, onMenuToggle }: TopNavProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
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
    <header className="sticky top-0 z-40 bg-white border-b border-brand-zebra">
      <div className="h-14 md:h-16 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <button
            type="button"
            onClick={onMenuToggle}
            className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-md text-brand-ink hover:bg-brand-zebra focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple"
            aria-label={isSidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={isSidebarOpen}
            aria-controls="dashboard-sidebar"
          >
            {isSidebarOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          <div className="flex items-center gap-2 md:gap-3">
            <Image
              src="/nstarx-logo-horizontal.png"
              alt="NStarX"
              width={140}
              height={36}
              priority
              className="h-7 md:h-8 w-auto"
            />
            <span className="hidden sm:inline-block h-5 w-px bg-brand-ink/20" />
            <span className="font-heading font-black text-brand-ink text-base md:text-lg">
              NStarX Intake Form
            </span>
          </div>
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-brand-ink hover:bg-brand-zebra focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple"
            aria-haspopup="menu"
            aria-expanded={isDropdownOpen}
          >
            <span className="hidden sm:inline">{admin.name}</span>
            <span className="inline sm:hidden max-w-[8rem] truncate">{admin.name}</span>
            <ChevronDown
              className={`h-4 w-4 text-brand-ink/60 transition-transform ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>

          <div
            role="menu"
            className={`absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none ${
              isDropdownOpen ? "block" : "hidden"
            }`}
          >
            <div className="px-4 py-3 border-b border-brand-zebra">
              <p className="text-sm font-semibold text-brand-ink truncate">{admin.name}</p>
              <p className="text-xs text-brand-ink/70 truncate">{admin.email}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full text-left px-4 py-2.5 text-sm font-medium text-brand-purple hover:bg-brand-zebra focus:bg-brand-zebra focus:outline-none disabled:opacity-60"
            >
              {isLoggingOut ? "Logging out…" : "Log out"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
