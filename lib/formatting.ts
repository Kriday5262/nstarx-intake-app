import { formatDistanceToNow, format } from "date-fns";

export function serializeTimestamp(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return null;
  // Postgres stores timestamps without a timezone, but values are captured in
  // the container's local time (Asia/Kolkata). Emit ISO with the +05:30 offset
  // so the client parses and formats them as the same wall-clock time instead
  // of treating them as UTC and adding 5:30.
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${ms}+05:30`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return format(d, "MMM d, yyyy");
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return format(d, "MMM d, yyyy h:mm a");
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fieldLabel(field: string): string {
  switch (field) {
    case "status":
      return "Status";
    case "priority":
      return "Priority";
    case "due_date":
      return "Due date";
    case "internal_notes":
      return "Internal notes";
    case "assignee":
      return "Assignee";
    case "driveUrl":
      return "Drive link";
    default:
      return field.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  }
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
