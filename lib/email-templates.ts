import { env } from "./env";

export type RequestRow = {
  id: number;
  publicReference: string;
  fullName: string;
  email: string;
  department: string;
  projectType: string;
  projectTitle: string;
  description: string;
  desiredDeadline: Date | null;
  priority: string;
  status: string;
  dueDate: Date | null;
  internalNotes: string | null;
  submittedAt: Date;
};

export type AttachmentRow = {
  id: string;
  requestId: number;
  originalFilename: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
};

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "Not specified";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function escapeHtml(value: unknown): string {
  const text = value == null ? "" : String(value);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function brandWrapper(title: string, body: string): string {
  return `\u003c!DOCTYPE html\u003e
\u003chtml lang="en"\u003e
\u003chead\u003e
  \u003cmeta charset="UTF-8"\u003e
  \u003cmeta name="viewport" content="width=device-width, initial-scale=1.0"\u003e
  \u003ctitle\u003e${escapeHtml(title)}\u003c/title\u003e
\u003c/head\u003e
\u003cbody style="margin:0;padding:0;background-color:#F4F6F9;font-family:'Nunito Sans',Nunito,Arial,sans-serif;color:#333F50;"\u003e
  \u003ctable width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F6F9;"\u003e
    \u003ctr\u003e
      \u003ctd align="center" style="padding:24px 16px;"\u003e
        \u003ctable width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#FFFFFF;border-radius:8px;overflow:hidden;border:1px solid #E4E7EB;"\u003e
          \u003ctr\u003e
            \u003ctd style="background-color:#6464B4;padding:24px 32px;text-align:center;"\u003e
              \u003ch1 style="margin:0;font-family:Montserrat,Impact,sans-serif;font-weight:900;font-size:22px;line-height:1.25;color:#FFFFFF;"\u003e${escapeHtml(title)}\u003c/h1\u003e
            \u003c/td\u003e
          \u003c/tr\u003e
          \u003ctr\u003e
            \u003ctd style="padding:32px;"\u003e
              ${body}
            \u003c/td\u003e
          \u003c/tr\u003e
          \u003ctr\u003e
            \u003ctd style="padding:24px 32px;border-top:1px solid #E4E7EB;text-align:center;color:#6464B4;font-size:12px;line-height:1.5;"\u003e
              NStarX Intake · Powered by NStarX\u003cbr\u003e
              \u003cspan style="color:#333F50;"\u003eThis is an automated message. Please do not reply directly to this email.\u003c/span\u003e
            \u003c/td\u003e
          \u003c/tr\u003e
        \u003c/table\u003e
      \u003c/td\u003e
    \u003c/tr\u003e
  \u003c/table\u003e
\u003c/body\u003e
\u003c/html\u003e`;
}

function ctaButton(href: string, label: string): string {
  return `\u003cdiv style="text-align:center;margin:24px 0;"\u003e
  \u003ca href="${escapeHtml(href)}" style="display:inline-block;background-color:#6464B4;color:#FFFFFF;font-family:Montserrat,Impact,sans-serif;font-weight:700;font-size:14px;line-height:1;padding:14px 28px;border-radius:6px;text-decoration:none;"\u003e${escapeHtml(label)}\u003c/a\u003e
\u003c/div\u003e`;
}

function fieldRows(
  rows: Array<{ label: string; value: string | null | undefined }>
): string {
  return `\u003ctable width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;"\u003e
    ${rows
      .map(
        (row) =>
          `\u003ctr\u003e\u003ctd style="padding:10px 0;border-bottom:1px solid #E4E7EB;vertical-align:top;width:40%;font-weight:700;color:#6464B4;"\u003e${escapeHtml(row.label)}\u003c/td\u003e\u003ctd style="padding:10px 0 10px 12px;border-bottom:1px solid #E4E7EB;vertical-align:top;width:60%;color:#333F50;"\u003e${escapeHtml(row.value ?? "—")}\u003c/td\u003e\u003c/tr\u003e`,
      )
      .join("\n")}
  \u003c/table\u003e`;
}

function plainTextLines(lines: Array<{ label: string; value: string }>): string {
  return lines.map((l) => `${l.label}: ${l.value}`).join("\n");
}

export function renderAdminNotificationEmail(
  request: RequestRow,
  attachments: AttachmentRow[],
): { html: string; text: string; subject: string } {
  const dashboardUrl = `${env.baseUrl()}/dashboard/requests/${request.id}`;
  const attachmentList =
    attachments.length > 0
      ? attachments
          .map(
            (a) =>
              `• ${escapeHtml(a.originalFilename)} (${formatBytes(a.sizeBytes)})`,
          )
          .join("\u003cbr\u003e")
      : "None";

  const htmlBody = `
    \u003cp style="margin:0 0 16px 0;font-size:16px;line-height:1.5;"\u003eA new intake request has been submitted.\u003c/p\u003e
    \u003cp style="margin:0 0 24px 0;font-size:14px;line-height:1.5;color:#6464B4;"\u003e\u003cstrong\u003eReference:\u003c/strong\u003e ${escapeHtml(request.publicReference)}\u003c/p\u003e
    ${ctaButton(dashboardUrl, "Open in Dashboard")}
    \u003ch2 style="margin:24px 0 12px 0;font-family:Montserrat,Impact,sans-serif;font-weight:900;font-size:18px;color:#333F50;"\u003eSubmission Details\u003c/h2\u003e
    ${fieldRows([
      { label: "Full Name", value: request.fullName },
      { label: "Email", value: request.email },
      { label: "Department / Team", value: request.department },
      { label: "Project Type", value: request.projectType },
      { label: "Project Title", value: request.projectTitle },
      { label: "Description", value: request.description },
      { label: "Desired Deadline", value: formatDate(request.desiredDeadline) },
      { label: "Priority", value: request.priority },
      { label: "Status", value: request.status },
      { label: "Submitted At", value: formatDate(request.submittedAt) },
    ])}
    \u003ch2 style="margin:24px 0 12px 0;font-family:Montserrat,Impact,sans-serif;font-weight:900;font-size:18px;color:#333F50;"\u003eAttachments\u003c/h2\u003e
    \u003cp style="margin:0;font-size:14px;line-height:1.6;"\u003e${attachmentList}\u003c/p\u003e
  `;

  const text = `A new intake request has been submitted.

Reference: ${request.publicReference}

${plainTextLines([
    { label: "Full Name", value: request.fullName },
    { label: "Email", value: request.email },
    { label: "Department / Team", value: request.department },
    { label: "Project Type", value: request.projectType },
    { label: "Project Title", value: request.projectTitle },
    { label: "Description", value: request.description },
    { label: "Desired Deadline", value: formatDate(request.desiredDeadline) },
    { label: "Priority", value: request.priority },
    { label: "Status", value: request.status },
    { label: "Submitted At", value: formatDate(request.submittedAt) },
  ])}

Attachments:
${attachments.length > 0 ? attachments.map((a) => `• ${a.originalFilename} (${formatBytes(a.sizeBytes)})`).join("\n") : "None"}

Open in dashboard: ${dashboardUrl}
`;

  return {
    html: brandWrapper("New NStarX Intake Submission", htmlBody),
    text,
    subject: `New submission ${request.publicReference} — ${request.projectTitle}`,
  };
}

export function renderSubmitterConfirmationEmail(
  request: RequestRow,
): { html: string; text: string; subject: string } {
  const statusUrl = `${env.baseUrl()}/status?ref=${encodeURIComponent(request.publicReference)}\u0026email=${encodeURIComponent(request.email)}`;

  const htmlBody = `
    \u003cp style="margin:0 0 16px 0;font-size:16px;line-height:1.5;"\u003eHi ${escapeHtml(request.fullName)},\u003c/p\u003e
    \u003cp style="margin:0 0 16px 0;font-size:16px;line-height:1.5;"\u003eThank you for submitting your request. Shantanu will review the requirements with Sujay and plan it in accordance with other priority items.\u003c/p\u003e
    \u003cp style="margin:0 0 24px 0;font-size:14px;line-height:1.5;color:#6464B4;"\u003e\u003cstrong\u003eYour reference number:\u003c/strong\u003e ${escapeHtml(request.publicReference)}\u003c/p\u003e
    ${ctaButton(statusUrl, "Track Request Status")}
    \u003ch2 style="margin:24px 0 12px 0;font-family:Montserrat,Impact,sans-serif;font-weight:900;font-size:18px;color:#333F50;"\u003eSubmission Summary\u003c/h2\u003e
    ${fieldRows([
      { label: "Project Title", value: request.projectTitle },
      { label: "Project Type", value: request.projectType },
      { label: "Description", value: request.description },
      { label: "Desired Deadline", value: formatDate(request.desiredDeadline) },
      { label: "Priority", value: request.priority },
      { label: "Status", value: request.status },
      { label: "Submitted At", value: formatDate(request.submittedAt) },
    ])}
  `;

  const text = `Hi ${request.fullName},

Thank you for submitting your request. Shantanu will review the requirements with Sujay and plan it in accordance with other priority items.

Your reference number: ${request.publicReference}

${plainTextLines([
    { label: "Project Title", value: request.projectTitle },
    { label: "Project Type", value: request.projectType },
    { label: "Description", value: request.description },
    { label: "Desired Deadline", value: formatDate(request.desiredDeadline) },
    { label: "Priority", value: request.priority },
    { label: "Status", value: request.status },
    { label: "Submitted At", value: formatDate(request.submittedAt) },
  ])}

Track your request: ${statusUrl}
`;

  return {
    html: brandWrapper("NStarX Intake — Submission Confirmed", htmlBody),
    text,
    subject: `Your NStarX intake request ${request.publicReference} has been received`,
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
