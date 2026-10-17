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
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(`[email] ${context}: ${message}`);
}

function logWarn(message: string): void {
  // eslint-disable-next-line no-console
  console.warn(`[email] ${message}`);
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
      logWarn(
        "SendGrid API key not configured; skipping admin notification.",
      );
      return;
    }

    const recipients = env.adminNotifyEmails();
    if (recipients.length === 0) {
      logWarn("ADMIN_NOTIFY_EMAILS is empty; skipping admin notification.");
      return;
    }

    const { html, text, subject } = renderAdminNotificationEmail(
      request,
      attachments,
    );

    await getClient().sendMultiple({
      to: recipients,
      from: env.sendgridFromEmail(),
      subject,
      text,
      html,
      attachments: attachments.map(toSendGridAttachment),
    });
  } catch (error) {
    logError("sendAdminNotification failed", error);
  }
}

export async function sendSubmitterConfirmation(
  request: RequestRow,
): Promise<void> {
  try {
    if (!isEmailConfigured()) {
      logWarn(
        "SendGrid API key not configured; skipping submitter confirmation.",
      );
      return;
    }

    const { html, text, subject } = renderSubmitterConfirmationEmail(request);

    await getClient().send({
      to: request.email,
      from: env.sendgridFromEmail(),
      subject,
      text,
      html,
    });
  } catch (error) {
    logError("sendSubmitterConfirmation failed", error);
  }
}

export async function sendAssigneeNotification(
  request: { id: number; projectTitle: string; publicReference: string; assignee: string },
  actorName: string,
): Promise<void> {
  try {
    if (!isEmailConfigured()) {
      logWarn("SendGrid API key not configured; skipping assignee notification.");
      return;
    }

    const recipient = env.assigneeEmail(request.assignee);
    if (!recipient) {
      logWarn(`No email configured for assignee ${request.assignee}; skipping notification.`);
      return;
    }

    const dashboardUrl = `${env.baseUrl()}/dashboard/requests/${request.id}`;
    const subject = `Assigned: ${request.publicReference} — ${request.projectTitle}`;

    const html = brandWrapper(
      "You’ve been assigned a request",
      `\u003cp style="margin:0 0 16px 0;font-size:16px;line-height:1.5;"\u003eHi ${escapeHtml(request.assignee)},\u003c/p\u003e
       \u003cp style="margin:0 0 16px 0;font-size:16px;line-height:1.5;"\u003e${escapeHtml(actorName)} assigned you to \u003cstrong\u003e${escapeHtml(request.projectTitle)}\u003c/strong\u003e (${escapeHtml(request.publicReference)}).\u003c/p\u003e
       ${ctaButton(dashboardUrl, "Open in Dashboard")}`
    );

    const text = `Hi ${request.assignee},\n\n${actorName} assigned you to ${request.projectTitle} (${request.publicReference}).\n\nOpen in dashboard: ${dashboardUrl}\n`;

    await getClient().send({
      to: recipient,
      from: env.sendgridFromEmail(),
      subject,
      text,
      html,
    });
  } catch (error) {
    logError("sendAssigneeNotification failed", error);
  }
}

export async function sendCommentNotification(
  request: { id: number; projectTitle: string; publicReference: string },
  comment: { actorName: string; actorEmail: string; content: string },
): Promise<void> {
  try {
    if (!isEmailConfigured()) {
      logWarn("SendGrid API key not configured; skipping comment notification.");
      return;
    }

    const recipients = env.adminNotifyEmails();
    if (recipients.length === 0) {
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

    await getClient().sendMultiple({
      to: recipients,
      from: env.sendgridFromEmail(),
      subject,
      text,
      html,
    });
  } catch (error) {
    logError("sendCommentNotification failed", error);
  }
}

export function resetEmailClient(): void {
  injectedClient = undefined;
}
