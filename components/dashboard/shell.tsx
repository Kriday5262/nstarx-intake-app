"use client";

import { TopNav } from "./top-nav";

interface DashboardShellProps {
  admin: {
    adminId: number;
    email: string;
    name: string;
  };
  children: React.ReactNode;
}

export function DashboardShell({ admin, children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-brand-canvas">
      <TopNav admin={admin} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {children}
      </main>
    </div>
  );
}
