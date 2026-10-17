import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requests, attachments, activityLog } from "@/lib/schema";
import { sendAdminNotification, sendSubmitterConfirmation } from "@/lib/email";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".xlsx", ".png", ".jpg", ".jpeg", ".mp4", ".mov"];
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "video/mp4",
  "video/quicktime",
  "text/plain",
];

const formSchema = z.object({
  fullName: z.string().min(1, "Full name is required.").max(255, "Too long."),
  email: z.string().min(1, "Email is required.").email("Please enter a valid email.").max(255, "Too long."),
  projectType: z.enum(["Presentation", "Document", "Video", "Website", "Graphics", "UI/UX", "Other"]),
  brandingDirection: z.enum(["NStarX", "SHI", "NStarX + SHI", "Not sure", "Other"]),
  projectTitle: z.string().min(1, "Project title is required.").max(500, "Too long."),
  description: z.string().min(50, "Description must be at least 50 characters.").max(5000, "Description must be 5000 characters or less."),
  desiredDeadline: z.string().optional().nullable().or(z.literal("")),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).default("Medium"),
  driveUrl: z.string().max(1000, "Link is too long.").refine((val) => !val || /^https?:\/\/.+/.test(val), { message: "Please enter a valid URL starting with http:// or https://" }).optional().or(z.literal("")),
});

function generateReference(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const time = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const nano = String(process.hrtime.bigint() % BigInt(1000000)).padStart(6, "0");
  return `NSX-${yyyy}${mm}${dd}-${time}-${nano}`;
}

function isAllowedFile(file: File): boolean {
  if (ALLOWED_MIME_TYPES.includes(file.type)) return true;
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

function parseDeadline(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const raw = Object.fromEntries(formData.entries());
    const parsed = formSchema.safeParse(raw);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") {
          errors[field] = issue.message;
        }
      }
      console.error("[intake] validation failed", errors);
      return NextResponse.json({ success: false, errors, fileErrors: [] }, { status: 400 });
    }

    const data = parsed.data;
    const deadlineDate = parseDeadline(data.desiredDeadline);

    const fileCount = Number(formData.get("fileCount") ?? "0");
    const incomingFiles: File[] = [];
    const fileErrors: string[] = [];

    for (let i = 0; i < fileCount; i++) {
      const originalName = String(formData.get(`fileName_${i}`) ?? "");
      const file = formData.get(`file_${i}`);
      if (!file || !(file instanceof File) || !file.size) continue;
      if (!originalName) {
        fileErrors.push(`Attachment ${i + 1} is missing a filename.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        fileErrors.push(`${originalName} exceeds the 25 MB limit.`);
        continue;
      }
      if (!isAllowedFile(file)) {
        fileErrors.push(`${originalName} is not a supported file type.`);
        continue;
      }
      incomingFiles.push(file);
    }

    if (incomingFiles.length > MAX_FILES) {
      fileErrors.push(`You can attach up to ${MAX_FILES} files only.`);
    }

    if (fileErrors.length) {
      return NextResponse.json({ success: false, errors: {}, fileErrors }, { status: 400 });
    }

    const filesToSave = incomingFiles.slice(0, MAX_FILES);

    const reference = generateReference();
    const [requestRow] = await db
      .insert(requests)
      .values({
        publicReference: reference,
        fullName: data.fullName,
        email: data.email,
        projectType: data.projectType,
        brandingDirection: data.brandingDirection,
        projectTitle: data.projectTitle,
        description: data.description,
        desiredDeadline: deadlineDate ? deadlineDate.toISOString().slice(0, 10) : null,
        priority: data.priority,
        status: "Submitted",
        assignee: "Shantanu",
        driveUrl: data.driveUrl || null,
      })
      .returning();

    const uploadRoot = process.env.UPLOAD_DIR ?? "/mnt/hikvision/Shantanu/Work/NStarX-Intake-Uploads";
    const requestDir = path.join(uploadRoot, String(requestRow.id));
    await mkdir(requestDir, { recursive: true });

    const attachmentRows = [];
    for (const file of filesToSave) {
      const storedName = `${randomUUID()}_${file.name}`;
      const storedPath = path.join(requestDir, storedName);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(storedPath, buffer);

      const [attachment] = await db
        .insert(attachments)
        .values({
          requestId: requestRow.id,
          originalFilename: file.name,
          storedPath,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        })
        .returning();
      attachmentRows.push(attachment);
    }

    // Initial status activity log entry created by the system
    await db.insert(activityLog).values({
      requestId: requestRow.id,
      actorEmail: "system",
      actorName: "System",
      field: "status",
      oldValue: null,
      newValue: "Submitted",
    });

    const emailRequest = {
      id: requestRow.id,
      publicReference: requestRow.publicReference,
      fullName: requestRow.fullName,
      email: requestRow.email,
      projectType: requestRow.projectType,
      projectTitle: requestRow.projectTitle,
      description: requestRow.description,
      desiredDeadline: requestRow.desiredDeadline ? new Date(requestRow.desiredDeadline) : null,
      priority: requestRow.priority,
      status: requestRow.status,
      dueDate: requestRow.dueDate ? new Date(requestRow.dueDate) : null,
      internalNotes: requestRow.internalNotes || null,
      submittedAt: new Date(requestRow.submittedAt),
    };

    await sendAdminNotification(
      emailRequest,
      attachmentRows.map((a) => ({
        id: a.id,
        requestId: a.requestId,
        originalFilename: a.originalFilename,
        storedPath: a.storedPath,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      }))
    );

    await sendSubmitterConfirmation(emailRequest);

    return NextResponse.json({ success: true, reference }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/requests] failed:", message);
    return NextResponse.json(
      { success: false, errors: { _form: "Something went wrong. Please try again." }, fileErrors: [] },
      { status: 500 }
    );
  }
}
