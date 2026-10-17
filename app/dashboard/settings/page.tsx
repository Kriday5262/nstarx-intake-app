import { Metadata } from "next";
import { requireCurrentAdmin } from "@/lib/session";
import { ChangePasswordForm } from "@/components/dashboard/change-password-form";

export const metadata: Metadata = {
  title: "Settings · NStarX Project Intake System",
  description: "NStarX Project Intake System dashboard settings.",
};

export default async function SettingsPage() {
  const admin = await requireCurrentAdmin();

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl md:text-3xl text-brand-ink">
        Settings
      </h1>

      <section className="rounded-lg border border-brand-zebra bg-white shadow-sm p-5 md:p-6 max-w-2xl">
        <h2 className="font-heading text-lg text-brand-ink mb-4">Change Password</h2>
        <ChangePasswordForm email={admin.email} />
      </section>
    </div>
  );
}
