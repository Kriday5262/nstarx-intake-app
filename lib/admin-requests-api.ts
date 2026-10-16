import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { requests, attachments, activityLog } from "@/lib/schema";
import type { RequestStatus } from "@/lib/status-workflow";
import { requireCurrentAdmin } from "@/lib/session";
import { validateStatusTransition, VALID_STATUSES } from "@/lib/status-workflow";

const priorities = ["Low", "Medium", "High", "Urgent"] as const;

const statusBodySchema = z.object({
  status: z.enum(VALID_STATUSES),
});

const priorityBodySchema = z.object({
  priority: z.enum(priorities),
});

const dueDateBodySchema = z.object({
  dueDate: z.string().date().nullable(),
});

const notesBodySchema = z.object({
  notes: z.string().max(10000),
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
  field: string,
  oldValue: string | null | undefined,
  newValue: string | null | undefined
) {
  await db.insert(activityLog).values({
    requestId,
    actorEmail,
    field,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
  });
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
      department: requestRow.department,
      projectType: requestRow.projectType,
      projectTitle: requestRow.projectTitle,
      description: requestRow.description,
      desiredDeadline: requestRow.desiredDeadline,
      priority: requestRow.priority,
      status: requestRow.status,
      dueDate: requestRow.dueDate,
      internalNotes: requestRow.internalNotes,
      submittedAt: requestRow.submittedAt,
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
      department: r.department,
      projectType: r.projectType,
      projectTitle: r.projectTitle,
      description: r.description,
      desiredDeadline: r.desiredDeadline,
      priority: r.priority,
      status: r.status,
      dueDate: r.dueDate,
      internalNotes: r.internalNotes,
      submittedAt: r.submittedAt,
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
  const validation = validateStatusTransition(current, next);
  if (!validation.ok) {
    return badRequest(validation.error);
  }

  if (current !== next) {
    await db
      .update(requests)
      .set({ status: next })
      .where(eq(requests.id, requestRow.id));

    await appendActivity(
      requestRow.id,
      admin.email,
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

    await appendActivity(requestRow.id, admin.email, "priority", current, next);
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
      field: r.field,
      oldValue: r.oldValue,
      newValue: r.newValue,
      createdAt: r.createdAt,
    })),
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
