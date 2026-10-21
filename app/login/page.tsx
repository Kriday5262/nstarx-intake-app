import { Metadata } from "next";
import Image from "next/image";
import LoginForm from "@/components/login-form";

export const metadata: Metadata = {
  title: "Admin Login · NStarX Project Intake System",
  description: "Sign in to the NStarX Project Intake System admin dashboard.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string; from?: string };
}) {
  const from = searchParams?.from ?? "/dashboard/requests";

  return (
    <main className="min-h-screen flex items-center justify-center bg-brand-zebra p-4">
      <div className="w-full max-w-md bg-white rounded-[4px] border border-brand-zebra p-6 md:p-8">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/nstarx-logo-horizontal.png"
              alt="NStarX logo"
              width={200}
              height={50}
              priority
              className="h-10 md:h-12 w-auto"
            />
          </div>
          <h1 className="font-heading text-2xl md:text-3xl text-brand-ink mb-2">
            NStarX Project Intake System
          </h1>
          <p className="text-brand-ink/70 text-sm md:text-base">
            Sign in to manage intake requests.
          </p>
        </div>

        <LoginForm from={from} />
      </div>
    </main>
  );
}
