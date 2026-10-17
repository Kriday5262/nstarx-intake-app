"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginForm({ from }: { from: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      const form = event.currentTarget;
      const email = form.email.value.trim();
      const password = form.password.value;

      if (!email || !password) {
        return;
      }

      setIsPending(true);

      try {
        const response = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          throw new Error("Invalid email or password.");
        }

        await response.json();

        router.push(from.startsWith("/") ? from : "/dashboard");
      } catch {
        setError("Invalid email or password.");
      } finally {
        setIsPending(false);
      }
    },
    [from, router]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="from" value={from} />

      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@nstarxinc.com"
          required
          className="min-h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          className="min-h-11"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full min-h-11 inline-flex items-center justify-center rounded-md bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-purple-dark disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
