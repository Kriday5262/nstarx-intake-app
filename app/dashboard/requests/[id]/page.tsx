import { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCurrentAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { requests, attachments } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { RequestDetail } from "@/components/dashboard/request-detail";
import type { RequestStatus } from "@/lib/status-workflow";

export const metadata: Metadata = {
  title: "Request Detail · NStarX Project Intake System",
  description: "View and manage an intake request.",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function RequestDetailPage({ params }: PageProps) {
  await requireCurrentAdmin();

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    notFound();
  }

  const requestRow = await db.query.requests.findFirst({
    where: eq(requests.id, id),
  });

  if (!requestRow) {
    notFound();
  }

  const attachmentRows = await db.query.attachments.findMany({
    where: eq(attachments.requestId, id),
    orderBy: [attachments.originalFilename],
  });

  const initialRequest = {
    id: requestRow.id,
    publicReference: requestRow.publicReference,
    fullName: requestRow.fullName,
    email: requestRow.email,
    projectType: requestRow.projectType,
    brandingDirection: requestRow.brandingDirection,
    projectTitle: requestRow.projectTitle,
    description: requestRow.description,
    desiredDeadline: requestRow.desiredDeadline
      ? String(requestRow.desiredDeadline).slice(0, 10)
      : null,
    priority: requestRow.priority,
    status: requestRow.status as RequestStatus,
    assignee: requestRow.assignee,
    dueDate: requestRow.dueDate
      ? String(requestRow.dueDate).slice(0, 10)
      : null,
    driveUrl: requestRow.driveUrl,
    internalNotes: requestRow.internalNotes ?? "",
    submittedAt: requestRow.submittedAt.toISOString(),
  };

  const initialAttachments = attachmentRows.map((a) => ({
    id: a.id,
    originalFilename: a.originalFilename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
  }));

  return (
    <RequestDetail
      request={initialRequest}
      attachments={initialAttachments}
    />
  );
}
