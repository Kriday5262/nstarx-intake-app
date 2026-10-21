"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChangePasswordFormProps {
  email: string;
}

export function ChangePasswordForm({ email }: ChangePasswordFormProps) {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const form = event.currentTarget;
    const currentPassword = form.currentPassword.value;
    const newPassword = form.newPassword.value;
    const confirmPassword = form.confirmPassword.value;

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/admin/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || `Update failed (${response.status}).` });
        return;
      }
      setMessage({ type: "success", text: "Password updated successfully." });
      form.reset();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Network error." });
    } finally {
      setPending(false);
    }
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="email" value={email} />

      {message && (
        <div
          className={cn(
            "rounded-[4px] p-3 text-sm flex items-start gap-2",
            message.type === "success" ? "bg-brand-purple/10 text-brand-purple" : "bg-red-50 text-red-700"
          )}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          disabled={pending}
        >
          {pending ? "Updating…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}
