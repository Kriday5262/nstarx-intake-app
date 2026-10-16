import { requireCurrentAdmin } from "@/lib/session";
import { DashboardShell } from "@/components/dashboard/shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireCurrentAdmin();

  return <DashboardShell admin={admin}>{children}</DashboardShell>;
}
