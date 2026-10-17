import { Metadata } from "next";
import { requireCurrentAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dashboard · NStarX Project Intake System",
  description: "Manage NStarX Project Intake System submissions.",
};

export default async function DashboardPage() {
  const admin = await requireCurrentAdmin();

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl md:text-3xl text-brand-ink">
        Dashboard
      </h1>
      <p className="text-brand-ink/80 max-w-2xl">
        Signed in as {" "}
        <strong className="text-brand-ink">{admin.name} ({admin.email})</strong>.
        Manage intake requests or settings from the top navigation.
      </p>
    </div>
  );
}
