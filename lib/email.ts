import { env, isEmailConfigured } from "./env";
import {
  renderAdminNotificationEmail,
  renderSubmitterConfirmationEmail,
} from "./email-templates";
import { loadSendGrid } from "./sendgrid-loader";
import type { AttachmentRow, RequestRow } from "./email-templates";
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

export function resetEmailClient(): void {
  injectedClient = undefined;
}
