import { Metadata } from "next";
import { requireCurrentAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Settings · NStarX Intake",
  description: "NStarX intake dashboard settings.",
};

export default async function SettingsPage() {
  await requireCurrentAdmin();

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl md:text-3xl text-brand-ink">
        Settings
      </h1>
      <p className="text-brand-ink/80 max-w-2xl">
        Dashboard settings will be configured here.
      </p>
    </div>
  );
}
