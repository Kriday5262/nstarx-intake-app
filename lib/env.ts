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

/**
 * Placeholder/development recipient. Every test and dev notification is sent
 * here instead of a real NStarX staff address, so automated test submissions
 * never reach a staff mailbox.
 */
export const PLACEHOLDER_RECIPIENT = "shantanu@kamkazi.com";

function parseAddressList(raw: string): string[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const env = {
  sendgridApiKey: () => process.env.SENDGRID_API_KEY,
  sendgridFromEmail: () =>
    process.env.SENDGRID_FROM_EMAIL ?? "noreply@nstarx-intake.kamkazi.com",
  /**
   * Optional dev/test safety switch. When EMAIL_REDIRECT_TO is set, every
   * outbound message is delivered to that address instead of the intended
   * recipients, and the original recipients are recorded in the subject and
   * body. Leave it empty in production so submitter confirmations reach the
   * actual requesters.
   */
  emailRedirectTo: (): string | null => {
    const value = (process.env.EMAIL_REDIRECT_TO ?? "").trim();
    if (!value) return null;
    return parseAddressList(value)[0] ?? null;
  },
  /**
   * Fallback for historical activity rows that were written before
   * actorName was populated: derive a display name from the email local
   * part so old entries do not show raw addresses.
   */
  adminNotifyEmails: () => {
    const raw = process.env.ADMIN_NOTIFY_EMAILS ?? PLACEHOLDER_RECIPIENT;
    return parseAddressList(raw);
  },
  displayName: (name: string, email: string): string => {
    if (name && name.trim()) return name.trim();
    const local = email.split("@")[0];
    if (!local) return email;
    return local
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  },
  assigneeEmail: (assignee: string): string | undefined => {
    const map: Record<string, string | undefined> = {
      Shantanu: process.env.ASSIGNEE_SHANTANU_EMAIL,
      Sujay: process.env.ASSIGNEE_SUJAY_EMAIL,
    };
    return map[assignee]?.trim() || undefined;
  },
  baseUrl: () =>
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://nstarx-intake.kamkazi.com",
};

export function isEmailConfigured(): boolean {
  return Boolean(env.sendgridApiKey());
}
