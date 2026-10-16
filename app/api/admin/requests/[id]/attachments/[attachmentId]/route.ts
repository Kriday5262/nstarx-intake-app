import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { requireCurrentAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { attachments } from "@/lib/schema";

/**
 * Guess the MIME type from the file extension. Mirrors the allowed intake
 * types so we don't need to add another dependency.
 */
function guessMimeType(filename: string, fallback: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".pdf": return "application/pdf";
    case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case ".xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".mp4": return "video/mp4";
    case ".mov": return "video/quicktime";
    case ".txt": return "text/plain";
    default: return fallback;
  }
}

/**
 * GET /api/admin/requests/[id]/attachments/[attachmentId]
 *
 * Stream an attachment file back to an authenticated admin.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string; attachmentId: string } }
) {
  await requireCurrentAdmin();

  const requestId = Number(params.id);
  const attachmentId = String(params.attachmentId);

  const attachment = await db.query.attachments.findFirst({
    where: eq(attachments.id, attachmentId),
  });

  if (!attachment || attachment.requestId !== requestId) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  try {
    const absolutePath = path.resolve(attachment.storedPath);
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
    }

    const detectedMime = guessMimeType(attachment.originalFilename, attachment.mimeType || "application/octet-stream");

    const stream = createReadStream(absolutePath);
    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        "Content-Type": detectedMime,
        "Content-Length": String(fileStat.size),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.originalFilename)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }
}
