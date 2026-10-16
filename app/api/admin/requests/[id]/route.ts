/**
 * Next.js App Router route wrapper for reading a single request and its
 * attachments, and for deleting a request. The status/priority/due-date/notes/activity handlers live in
 * sibling route directories.
 */

export { GET_ONE as GET, DELETE_ONE as DELETE } from "@/lib/admin-requests-api";
