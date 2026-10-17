import { NextRequest } from "next/server";
import { GET_COMMENTS, POST_COMMENT } from "@/lib/admin-requests-api";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return GET_COMMENTS(request, { params });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return POST_COMMENT(request, { params });
}
