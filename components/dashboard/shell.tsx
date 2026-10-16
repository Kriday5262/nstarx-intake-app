"use client";

import { useState } from "react";
import { TopNav } from "./top-nav";
import { Sidebar } from "./sidebar";

interface DashboardAdmin {
  adminId: number;
  email: string;
  name: string;
}

interface DashboardShellProps {
  admin: DashboardAdmin;
  children: React.ReactNode;
}

export function DashboardShell({ admin, children }: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-brand-zebra">
      <TopNav
        admin={admin}
        isSidebarOpen={isSidebarOpen}
        onMenuToggle={() => setIsSidebarOpen((s) => !s)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
