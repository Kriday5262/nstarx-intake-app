import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { requests, attachments, activityLog, comments } from "@/lib/schema";
import { VALID_STATUSES } from "@/lib/status-workflow";
import type { RequestStatus } from "@/lib/status-workflow";
import { requireCurrentAdmin } from "@/lib/session";
import { sendCommentNotification } from "@/lib/email";
import { env } from "@/lib/env";
import { serializeTimestamp } from "@/lib/formatting";

const priorities = ["Low", "Medium", "High", "Urgent"] as const;
const assignees = ["Shantanu", "Sujay"] as const;

const statusBodySchema = z.object({
  status: z.enum(VALID_STATUSES),
});

const priorityBodySchema = z.object({
  priority: z.enum(priorities),
});

const assigneeBodySchema = z.object({
  assignee: z.enum(assignees),
});

const dueDateBodySchema = z.object({
  dueDate: z.string().date().nullable(),
});

const notesBodySchema = z.object({
  notes: z.string().max(10000),
});

const commentBodySchema = z.object({
  content: z.string().min(1).max(5000),
});

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getRequestAndAdmin(requestId: string) {
  const admin = await requireCurrentAdmin();
  const id = Number(requestId);
  if (!Number.isFinite(id) || id <= 0) return { admin, requestRow: null };
  const requestRow = await db.query.requests.findFirst({
    where: eq(requests.id, id),
  });
  return { admin, requestRow };
}

async function appendActivity(
  requestId: number,
  actorEmail: string,
  actorName: string,
  field: string,
  oldValue: string | null | undefined,
  newValue: string | null | undefined
) {
  await db.insert(activityLog).values({
    requestId,
    actorEmail,
    actorName,
    field,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
  });
}

async function notifyAssignee(request: { id: number; projectTitle: string; publicReference: string; assignee: string }, oldAssignee: string | null, admin: { name: string; email: string }) {
  if (request.assignee === oldAssignee) return;
  const { sendAssigneeNotification } = await import("@/lib/email");
  await sendAssigneeNotification(request, admin.name);
}

/**
 * GET /api/admin/requests/[id]
 *
 * Fetch a single intake request including its attachment metadata.
 */
export async function GET_ONE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireCurrentAdmin();
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return badRequest("Invalid request ID.", 400);
  }

  const requestRow = await db.query.requests.findFirst({
    where: eq(requests.id, id),
  });
  if (!requestRow) return badRequest("Request not found.", 404);

  const attachmentRows = await db.query.attachments.findMany({
    where: eq(attachments.requestId, id),
    orderBy: [attachments.originalFilename],
  });

  return NextResponse.json({
    request: {
      id: requestRow.id,
      publicReference: requestRow.publicReference,
      fullName: requestRow.fullName,
      email: requestRow.email,
      projectType: requestRow.projectType,
      brandingDirection: requestRow.brandingDirection,
      projectTitle: requestRow.projectTitle,
      description: requestRow.description,
      desiredDeadline: requestRow.desiredDeadline,
      priority: requestRow.priority,
      status: requestRow.status,
      dueDate: requestRow.dueDate,
      internalNotes: requestRow.internalNotes,
      assignee: requestRow.assignee,
      driveUrl: requestRow.driveUrl,
      submittedAt: serializeTimestamp(requestRow.submittedAt),
    },
    attachments: attachmentRows.map((a) => ({
      id: a.id,
      originalFilename: a.originalFilename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
    })),
  });
}

/**
 * DELETE /api/admin/requests/[id]
 *
 * Removes an intake request and its related attachments + activity log rows
 * (via DB cascade). Requires an authenticated admin session.
 */
export async function DELETE_ONE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireCurrentAdmin();

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return badRequest("Invalid request ID.", 400);
  }

  const requestRow = await db.query.requests.findFirst({
    where: eq(requests.id, id),
    columns: { id: true, projectTitle: true },
  });

  if (!requestRow) return badRequest("Request not found.", 404);

  await db.delete(requests).where(eq(requests.id, id));

  return NextResponse.json({ ok: true, id, actor: admin.email });
}

/**
 * GET /api/admin/requests
 *
 * List all intake requests ordered by submission time descending.
 * Requires an authenticated admin session.
 */
export async function GET() {
  const admin = await requireCurrentAdmin();

  const rows = await db.query.requests.findMany({
    orderBy: [desc(requests.submittedAt)],
  });

  return NextResponse.json({
    admin: admin.email,
    requests: rows.map((r) => ({
      id: r.id,
      publicReference: r.publicReference,
      fullName: r.fullName,
      email: r.email,
      projectType: r.projectType,
      brandingDirection: r.brandingDirection,
      projectTitle: r.projectTitle,
      description: r.description,
      desiredDeadline: r.desiredDeadline,
      priority: r.priority,
      status: r.status,
      dueDate: r.dueDate,
      internalNotes: r.internalNotes,
      assignee: r.assignee,
      driveUrl: r.driveUrl,
      submittedAt: serializeTimestamp(r.submittedAt),
    })),
  });
}

/**
 * PATCH /api/admin/requests/[id]/status
 */
export async function PATCH_STATUS(request: NextRequest, { params }: { params: { id: string } }) {
  const { admin, requestRow } = await getRequestAndAdmin(params.id);
  if (!requestRow) return badRequest("Request not found.", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = statusBodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join(" "));
  }

  const current = requestRow.status as RequestStatus;
  const next = parsed.data.status;

  if (current !== next) {
    await db
      .update(requests)
      .set({ status: next })
      .where(eq(requests.id, requestRow.id));

    await appendActivity(
      requestRow.id,
      admin.email,
      admin.name,
      "status",
      current,
      next
    );
  }

  return NextResponse.json({ ok: true, id: requestRow.id, status: next });
}

/**
 * PATCH /api/admin/requests/[id]/priority
 */
export async function PATCH_PRIORITY(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { admin, requestRow } = await getRequestAndAdmin(params.id);
  if (!requestRow) return badRequest("Request not found.", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = priorityBodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join(" "));
  }

  const current = requestRow.priority;
  const next = parsed.data.priority;
  if (current !== next) {
    await db
      .update(requests)
      .set({ priority: next })
      .where(eq(requests.id, requestRow.id));

    await appendActivity(requestRow.id, admin.email, admin.name, "priority", current, next);
  }

  return NextResponse.json({ ok: true, id: requestRow.id, priority: next });
}

/**
 * PATCH /api/admin/requests/[id]/due-date
 */
export async function PATCH_DUE_DATE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { admin, requestRow } = await getRequestAndAdmin(params.id);
  if (!requestRow) return badRequest("Request not found.", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = dueDateBodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join(" "));
  }

  const next = parsed.data.dueDate;
  const current = requestRow.dueDate;

  const currentString =
    current === null || current === undefined
      ? null
      : String(current).slice(0, 10);
  const nextString = next ?? null;

  if (currentString !== nextString) {
    await db
      .update(requests)
      .set({ dueDate: nextString })
      .where(eq(requests.id, requestRow.id));

    await appendActivity(
      requestRow.id,
      admin.email,
      admin.name,
      "due_date",
      currentString,
      nextString
    );
  }

  return NextResponse.json({ ok: true, id: requestRow.id, dueDate: nextString });
}

/**
 * PATCH /api/admin/requests/[id]/notes
 */
export async function PATCH_NOTES(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { admin, requestRow } = await getRequestAndAdmin(params.id);
  if (!requestRow) return badRequest("Request not found.", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = notesBodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join(" "));
  }

  const next = parsed.data.notes;
  const current = requestRow.internalNotes ?? "";

  if (current !== next) {
    await db
      .update(requests)
      .set({ internalNotes: next })
      .where(eq(requests.id, requestRow.id));

    await appendActivity(
      requestRow.id,
      admin.email,
      admin.name,
      "internal_notes",
      current || null,
      next || null
    );
  }

  return NextResponse.json({ ok: true, id: requestRow.id, notes: next });
}

/**
 * GET /api/admin/requests/[id]/activity
 */
export async function GET_ACTIVITY(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireCurrentAdmin();
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return badRequest("Invalid request ID.", 400);
  }

  const requestRow = await db.query.requests.findFirst({
    where: eq(requests.id, id),
    columns: { id: true },
  });
  if (!requestRow) return badRequest("Request not found.", 404);

  const rows = await db.query.activityLog.findMany({
    where: eq(activityLog.requestId, id),
    orderBy: [desc(activityLog.createdAt), desc(activityLog.id)],
  });

  return NextResponse.json({
    id,
    entries: rows.map((r) => ({
      id: r.id,
      actorEmail: r.actorEmail,
      actorName: env.displayName(r.actorName ?? "", r.actorEmail),
      field: r.field,
      oldValue: r.oldValue,
      newValue: r.newValue,
      createdAt: serializeTimestamp(r.createdAt),
    })),
  });
}

/**
 * PATCH /api/admin/requests/[id]/assignee
 */
export async function PATCH_ASSIGNEE(request: NextRequest, { params }: { params: { id: string } }) {
  const { admin, requestRow } = await getRequestAndAdmin(params.id);
  if (!requestRow) return badRequest("Request not found.", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = assigneeBodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join(" "));
  }

  const current = requestRow.assignee;
  const next = parsed.data.assignee;
  if (current !== next) {
    await db
      .update(requests)
      .set({ assignee: next })
      .where(eq(requests.id, requestRow.id));

    await appendActivity(requestRow.id, admin.email, admin.name, "assignee", current, next);
    await notifyAssignee({ id: requestRow.id, projectTitle: requestRow.projectTitle, publicReference: requestRow.publicReference, assignee: next }, current, admin);
  }

  return NextResponse.json({ ok: true, id: requestRow.id, assignee: next });
}

/**
 * PATCH /api/admin/requests/[id]/drive-url
 */
export async function PATCH_DRIVE_URL(request: NextRequest, { params }: { params: { id: string } }) {
  const { admin, requestRow } = await getRequestAndAdmin(params.id);
  if (!requestRow) return badRequest("Request not found.", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const urlSchema = z.object({
    driveUrl: z.string().max(1000).nullable(),
  });
  const parsed = urlSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join(" "));
  }

  const current = requestRow.driveUrl ?? null;
  const next = parsed.data.driveUrl;
  if (current !== next) {
    await db
      .update(requests)
      .set({ driveUrl: next })
      .where(eq(requests.id, requestRow.id));

    await appendActivity(requestRow.id, admin.email, admin.name, "driveUrl", current, next);
  }

  return NextResponse.json({ ok: true, id: requestRow.id, driveUrl: next });
}

/**
 * GET /api/admin/requests/[id]/comments
 */
export async function GET_COMMENTS(_request: NextRequest, { params }: { params: { id: string } }) {
  await requireCurrentAdmin();
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return badRequest("Invalid request ID.", 400);
  }

  const requestRow = await db.query.requests.findFirst({
    where: eq(requests.id, id),
    columns: { id: true },
  });
  if (!requestRow) return badRequest("Request not found.", 404);

  const rows = await db.query.comments.findMany({
    where: eq(comments.requestId, id),
    orderBy: [desc(comments.createdAt), desc(comments.id)],
  });

  return NextResponse.json({
    id,
    comments: rows.map((r) => ({
      id: r.id,
      actorName: r.authorName,
      actorEmail: r.authorEmail,
      content: r.content,
      createdAt: serializeTimestamp(r.createdAt),
    })),
  });
}

/**
 * POST /api/admin/requests/[id]/comments
 */
export async function POST_COMMENT(request: NextRequest, { params }: { params: { id: string } }) {
  const { admin, requestRow } = await getRequestAndAdmin(params.id);
  if (!requestRow) return badRequest("Request not found.", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = commentBodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join(" "));
  }

  const [comment] = await db
    .insert(comments)
    .values({
      requestId: requestRow.id,
      authorEmail: admin.email,
      authorName: admin.name,
      content: parsed.data.content,
    })
    .returning();

  await sendCommentNotification(
    { id: requestRow.id, projectTitle: requestRow.projectTitle, publicReference: requestRow.publicReference },
    { actorName: admin.name, actorEmail: admin.email, content: parsed.data.content }
  );

  return NextResponse.json({
    ok: true,
    comment: {
      id: comment.id,
      actorName: comment.authorName,
      actorEmail: comment.authorEmail,
      content: comment.content,
      createdAt: serializeTimestamp(comment.createdAt),
    },
  });
}

/**
 * GET /api/admin/requests/[id]/notes
 */
export async function GET_NOTES(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireCurrentAdmin();
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return badRequest("Invalid request ID.", 400);
  }

  const requestRow = await db.query.requests.findFirst({
    where: eq(requests.id, id),
    columns: { id: true, internalNotes: true },
  });
  if (!requestRow) return badRequest("Request not found.", 404);

  return NextResponse.json({ id, notes: requestRow.internalNotes ?? "" });
}
