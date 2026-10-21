/**
 * Next.js App Router route wrapper for reading, updating, and deleting a single
 * request. The status/priority/due-date/notes/assignee/drive-url/activity/comments
 * handlers live in sibling route directories.
 */

export { GET_ONE as GET, PATCH_FULL as PATCH, DELETE_ONE as DELETE } from "@/lib/admin-requests-api";
