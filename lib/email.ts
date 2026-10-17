import { env, isEmailConfigured } from "./env";
import {
  renderAdminNotificationEmail,
  renderSubmitterConfirmationEmail,
} from "./email-templates";
import { loadSendGrid } from "./sendgrid-loader";
import type { AttachmentRow, RequestRow } from "./email-templates";
import { brandWrapper, ctaButton, escapeHtml } from "./email-templates";
import type { Client } from "@sendgrid/mail";

export type { AttachmentRow, RequestRow } from "./email-templates";

let injectedClient: Client | undefined;

export function setEmailClient(mockClient: Client): void {
  injectedClient = mockClient;
}

function getClient(): Client {
  if (injectedClient) return injectedClient;
  const apiKey = env.sendgridApiKey();
  if (!apiKey) {
    throw new Error("SendGrid API key is not configured");
  }
  const sgMail = loadSendGrid();
  sgMail.setApiKey(apiKey);
  return sgMail;
}

function logError(context: string, error: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[email] ${context}: ${describeSendGridError(error)}`);
}

function logWarn(message: string): void {
  // eslint-disable-next-line no-console
  console.warn(`[email] ${message}`);
}

function logInfo(message: string): void {
  // eslint-disable-next-line no-console
  console.info(`[email] ${message}`);
}

/**
 * The SendGrid SDK throws errors whose `message` alone is usually just
 * "Bad Request"; the actionable detail (invalid sender, blocked recipient,
 * quota) lives in `error.response.body`. Surface both so a failed send is
 * diagnosable from `docker logs` alone.
 */
function describeSendGridError(error: unknown): string {
  const parts: string[] = [];
  parts.push(error instanceof Error ? error.message : String(error));
  const response = (error as { response?: { statusCode?: number; body?: unknown } })
    .response;
  if (response && typeof response === "object") {
    if (response.statusCode) parts.push(`status=${response.statusCode}`);
    if (response.body) {
      let body: unknown = response.body;
      if (typeof body !== "string") {
        try {
          body = JSON.stringify(body);
        } catch {
          body = String(body);
        }
      }
      parts.push(`body=${String(body).slice(0, 500)}`);
    }
  }
  return parts.join(" | ");
}

function messageIdOf(result: { headers: unknown } | undefined): string {
  const headers = result?.headers as Record<string, unknown> | undefined;
  const raw = headers?.["x-message-id"] ?? headers?.["X-Message-Id"];
  return typeof raw === "string" ? raw : "unknown";
}

/** SendGrid accepts a bare address for single-recipient messages. */
function toField(to: string[]): string | string[] {
  return to.length === 1 ? to[0] : to;
}

/**
 * Applies the optional EMAIL_REDIRECT_TO dev/test switch. Returns the addresses
 * to actually send to plus the intended recipients when they were overridden.
 */
function resolveRecipients(intended: string[]): {
  to: string[];
  redirectedFrom: string[] | null;
} {
  const clean = intended.map((address) => address.trim()).filter(Boolean);
  const redirect = env.emailRedirectTo();
  if (redirect) {
    return { to: [redirect], redirectedFrom: clean };
  }
  return { to: clean, redirectedFrom: null };
}

function redirectNote(redirectedFrom: string[] | null): string {
  return redirectedFrom && redirectedFrom.length
    ? `[TEST — original recipient: ${redirectedFrom.join(", ")}] `
    : "";
}

function redirectTextNote(redirectedFrom: string[] | null): string {
  return redirectedFrom && redirectedFrom.length
    ? `TEST MODE: this message was redirected to you instead of ${redirectedFrom.join(", ")}.\n\n`
    : "";
}

/**
 * Email is disabled when SENDGRID_API_KEY is unset. The old code only emitted a
 * warning, so a missing key silently produced no notifications; log the failure
 * loudly as well so it is visible in `docker logs` and in monitoring.
 */
function logDisabled(context: string): void {
  logWarn(`SendGrid API key not configured; skipping ${context}.`);
  // eslint-disable-next-line no-console
  console.error(
    `[email] EMAIL DISABLED — SENDGRID_API_KEY is empty, so "${context}" was NOT sent. ` +
      "Set SENDGRID_API_KEY in .env and restart the app container."
  );
}

function toSendGridAttachment(attachment: AttachmentRow): {
  filename: string;
  content: string;
  type: string;
  disposition: "attachment";
} {
  return {
    filename: attachment.originalFilename,
    content: Buffer.from(attachment.storedPath).toString("base64"),
    type: attachment.mimeType,
    disposition: "attachment",
  };
}

export async function sendAdminNotification(
  request: RequestRow,
  attachments: AttachmentRow[],
): Promise<void> {
  try {
    if (!isEmailConfigured()) {
      logDisabled("admin notification");
      return;
    }

    const { to, redirectedFrom } = resolveRecipients(env.adminNotifyEmails());
    if (to.length === 0) {
      logWarn("ADMIN_NOTIFY_EMAILS is empty; skipping admin notification.");
      return;
    }

    const rendered = renderAdminNotificationEmail(request, attachments);

    const result = await getClient().sendMultiple({
      to,
      from: env.sendgridFromEmail(),
      subject: `${redirectNote(redirectedFrom)}${rendered.subject}`,
      text: `${redirectTextNote(redirectedFrom)}${rendered.text}`,
      html: rendered.html,
      attachments: attachments.map(toSendGridAttachment),
    });

    logInfo(
      `admin notification for ${request.publicReference} accepted by SendGrid for ${to.join(", ")} (message-id=${messageIdOf(result[0])})`
    );
  } catch (error) {
    logError(
      `sendAdminNotification failed for ${request.publicReference}`,
      error
    );
  }
}

export async function sendSubmitterConfirmation(
  request: RequestRow,
): Promise<void> {
  try {
    if (!isEmailConfigured()) {
      logDisabled("submitter confirmation");
      return;
    }

    const { to, redirectedFrom } = resolveRecipients([request.email]);
    if (to.length === 0) {
      logWarn("Submitter address is missing; skipping confirmation email.");
      return;
    }

    const rendered = renderSubmitterConfirmationEmail(request);

    const result = await getClient().send({
      to: toField(to),
      from: env.sendgridFromEmail(),
      subject: `${redirectNote(redirectedFrom)}${rendered.subject}`,
      text: `${redirectTextNote(redirectedFrom)}${rendered.text}`,
      html: rendered.html,
    });

    logInfo(
      `submitter confirmation for ${request.publicReference} accepted by SendGrid for ${to.join(", ")} (message-id=${messageIdOf(result[0])})`
    );
  } catch (error) {
    logError(
      `sendSubmitterConfirmation failed for ${request.publicReference}`,
      error
    );
  }
}

export async function sendAssigneeNotification(
  request: { id: number; projectTitle: string; publicReference: string; assignee: string },
  actorName: string,
): Promise<void> {
  try {
    if (!isEmailConfigured()) {
      logDisabled("assignee notification");
      return;
    }

    const recipient = env.assigneeEmail(request.assignee);
    if (!recipient) {
      logWarn(`No email configured for assignee ${request.assignee}; skipping notification.`);
      return;
    }

    const { to, redirectedFrom } = resolveRecipients([recipient]);

    const dashboardUrl = `${env.baseUrl()}/dashboard/requests/${request.id}`;
    const subject = `Assigned: ${request.publicReference} — ${request.projectTitle}`;

    const html = brandWrapper(
      "You’ve been assigned a request",
      `\u003cp style="margin:0 0 16px 0;font-size:16px;line-height:1.5;"\u003eHi ${escapeHtml(request.assignee)},\u003c/p\u003e
       \u003cp style="margin:0 0 16px 0;font-size:16px;line-height:1.5;"\u003e${escapeHtml(actorName)} assigned you to \u003cstrong\u003e${escapeHtml(request.projectTitle)}\u003c/strong\u003e (${escapeHtml(request.publicReference)}).\u003c/p\u003e
       ${ctaButton(dashboardUrl, "Open in Dashboard")}`
    );

    const text = `Hi ${request.assignee},\n\n${actorName} assigned you to ${request.projectTitle} (${request.publicReference}).\n\nOpen in dashboard: ${dashboardUrl}\n`;

    const result = await getClient().send({
      to: toField(to),
      from: env.sendgridFromEmail(),
      subject: `${redirectNote(redirectedFrom)}${subject}`,
      text: `${redirectTextNote(redirectedFrom)}${text}`,
      html,
    });

    logInfo(
      `assignee notification for ${request.publicReference} accepted by SendGrid for ${to.join(", ")} (message-id=${messageIdOf(result[0])})`
    );
  } catch (error) {
    logError(
      `sendAssigneeNotification failed for ${request.publicReference}`,
      error
    );
  }
}

export async function sendCommentNotification(
  request: { id: number; projectTitle: string; publicReference: string },
  comment: { actorName: string; actorEmail: string; content: string },
): Promise<void> {
  try {
    if (!isEmailConfigured()) {
      logDisabled("comment notification");
      return;
    }

    const { to, redirectedFrom } = resolveRecipients(env.adminNotifyEmails());
    if (to.length === 0) {
      logWarn("ADMIN_NOTIFY_EMAILS is empty; skipping comment notification.");
      return;
    }

    const dashboardUrl = `${env.baseUrl()}/dashboard/requests/${request.id}`;
    const subject = `New comment on ${request.publicReference} — ${request.projectTitle}`;
    const actor = comment.actorName || comment.actorEmail;
    const preview = comment.content.slice(0, 200).replace(/\s+/g, " ");

    const html = brandWrapper(
      "New comment on a request",
      `\u003cp style="margin:0 0 16px 0;font-size:16px;line-height:1.5;"\u003e${escapeHtml(actor)} commented on \u003cstrong\u003e${escapeHtml(request.projectTitle)}\u003c/strong\u003e (${escapeHtml(request.publicReference)}):\u003c/p\u003e
       \u003cblockquote style="margin:0 0 16px 0;padding:12px 16px;border-left:4px solid #6464B4;background:#f4f6f9;font-size:15px;line-height:1.5;"\u003e${escapeHtml(preview)}${comment.content.length > 200 ? "…" : ""}\u003c/blockquote\u003e
       ${ctaButton(dashboardUrl, "View in Dashboard")}`
    );

    const text = `${actor} commented on ${request.projectTitle} (${request.publicReference}):\n\n${preview}${comment.content.length > 200 ? "…" : ""}\n\nView in dashboard: ${dashboardUrl}\n`;

    const result = await getClient().sendMultiple({
      to,
      from: env.sendgridFromEmail(),
      subject: `${redirectNote(redirectedFrom)}${subject}`,
      text: `${redirectTextNote(redirectedFrom)}${text}`,
      html,
    });

    logInfo(
      `comment notification for ${request.publicReference} accepted by SendGrid for ${to.join(", ")} (message-id=${messageIdOf(result[0])})`
    );
  } catch (error) {
    logError(
      `sendCommentNotification failed for ${request.publicReference}`,
      error
    );
  }
}

export function resetEmailClient(): void {
  injectedClient = undefined;
}
