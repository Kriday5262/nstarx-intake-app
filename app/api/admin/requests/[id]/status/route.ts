/**
 * Next.js App Router route wrappers for the admin request management API.
 *
 * Because App Router dynamic route handlers live in
 * app/api/admin/requests/[id]/<operation>/route.ts, each export here simply
 * re-exports the corresponding implementation from lib/admin-requests-api.ts.
 */

export {
  PATCH_STATUS as PATCH,
  GET_ACTIVITY as GET,
} from "@/lib/admin-requests-api";
