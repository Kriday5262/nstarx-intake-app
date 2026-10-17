import { Metadata } from "next";
import { requireCurrentAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { requests } from "@/lib/schema";
import { asc, sql } from "drizzle-orm";
import { RequestsList, type AdminRequest } from "@/components/dashboard/requests-list";
import { serializeTimestamp } from "@/lib/formatting";

export const metadata: Metadata = {
  title: "Requests · NStarX Project Intake System",
  description: "Manage NStarX intake requests.",
};

export default async function RequestsPage() {
  await requireCurrentAdmin();

  const rows = await db.query.requests.findMany({
    orderBy: [asc(sql`coalesce(${requests.dueDate}, '9999-12-31'::date)`)],
  });

  const initialRequests: AdminRequest[] = rows.map((r) => ({
    id: r.id,
    publicReference: r.publicReference,
    fullName: r.fullName,
    email: r.email,
    projectType: r.projectType,
    projectTitle: r.projectTitle,
    description: r.description,
    desiredDeadline: r.desiredDeadline ? String(r.desiredDeadline).slice(0, 10) : null,
    priority: r.priority,
    status: r.status as AdminRequest["status"],
    assignee: r.assignee,
    dueDate: r.dueDate,
    internalNotes: r.internalNotes,
    submittedAt: serializeTimestamp(r.submittedAt) ?? "",
  }));

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl md:text-3xl text-brand-ink">
        Requests
      </h1>
      <RequestsList initialRequests={initialRequests} />
    </div>
  );
}
