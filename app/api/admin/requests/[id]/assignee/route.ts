import { NextRequest } from "next/server";
import { PATCH_ASSIGNEE } from "@/lib/admin-requests-api";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return PATCH_ASSIGNEE(request, { params });
}
