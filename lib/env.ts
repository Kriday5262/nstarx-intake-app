/**
 * Server-side environment helpers. Do not import this file into client code.
 */

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  sendgridApiKey: () => process.env.SENDGRID_API_KEY,
  sendgridFromEmail: () =>
    process.env.SENDGRID_FROM_EMAIL ?? "noreply@nstarx-intake.kamkazi.com",
  adminNotifyEmails: () => {
    const raw =
      process.env.ADMIN_NOTIFY_EMAILS ??
      "shantanu.chaturvedi@nstarxinc.com,shantanu@kamkazi.com";
    return raw
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
  },
  assigneeEmail: (assignee: string): string | undefined => {
    const map: Record<string, string | undefined> = {
      Shantanu: process.env.ASSIGNEE_SHANTANU_EMAIL,
      Sujay: process.env.ASSIGNEE_SUJAY_EMAIL,
    };
    return map[assignee];
  },
  baseUrl: () =>
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://nstarx-intake.kamkazi.com",
};

export function isEmailConfigured(): boolean {
  return Boolean(env.sendgridApiKey());
}
