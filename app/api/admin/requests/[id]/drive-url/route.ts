import { NextRequest } from "next/server";
import { PATCH_DRIVE_URL } from "@/lib/admin-requests-api";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return PATCH_DRIVE_URL(request, { params });
}
