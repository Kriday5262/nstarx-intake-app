"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Search,
  Trash2,
  Eye,
  X,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  VALID_STATUSES,
  type RequestStatus,
  validateStatusTransition,
} from "@/lib/status-workflow";

const STATUSES = VALID_STATUSES;

const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
const PROJECT_TYPES = [
  "Deck Redesign",
  "Document Branding",
  "Video Creation",
  "Website Work",
  "Other",
] as const;
const DEPARTMENTS = [
  "Marketing",
  "Sales",
  "Product",
  "Engineering",
  "Operations",
  "HR",
  "Finance",
  "Executive",
  "Other",
] as const;

const PAGE_SIZE = 25;

export interface AdminRequest {
  id: number;
  publicReference: string;
  fullName: string;
  email: string;
  department: string;
  projectType: string;
  projectTitle: string;
  description: string;
  desiredDeadline: string | null;
  priority: string;
  status: RequestStatus;
  dueDate: string | null;
  internalNotes?: string | null;
  submittedAt: string;
}

interface RequestsListProps {
  initialRequests: AdminRequest[];
}

type SortKey =
  | "projectTitle"
  | "fullName"
  | "department"
  | "projectType"
  | "priority"
  | "status"
  | "dueDate"
  | "submittedAt";
type SortDir = "asc" | "desc";

const priorityRank: Record<string, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Urgent: 4,
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function priorityClasses(priority: string) {
  switch (priority) {
    case "Low":
      return "bg-gray-100 text-gray-700 border-gray-200";
    case "Medium":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "High":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "Urgent":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function statusClasses(status: RequestStatus) {
  switch (status) {
    case "Submitted":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "In Review":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "Planned":
      return "bg-indigo-100 text-indigo-700 border-indigo-200";
    case "In Progress":
      return "bg-sky-100 text-sky-700 border-sky-200";
    case "Completed":
      return "bg-green-100 text-green-700 border-green-200";
    case "Rejected":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function sortRequests(
  rows: AdminRequest[],
  key: SortKey,
  dir: SortDir
): AdminRequest[] {
  const sorted = [...rows].sort((a, b) => {
    let comparison = 0;
    switch (key) {
      case "projectTitle":
        comparison = a.projectTitle.localeCompare(b.projectTitle);
        break;
      case "fullName":
        comparison = a.fullName.localeCompare(b.fullName);
        break;
      case "department":
        comparison = a.department.localeCompare(b.department);
        break;
      case "projectType":
        comparison = a.projectType.localeCompare(b.projectType);
        break;
      case "priority":
        comparison =
          (priorityRank[a.priority] ?? 0) - (priorityRank[b.priority] ?? 0);
        break;
      case "status":
        comparison = a.status.localeCompare(b.status);
        break;
      case "dueDate": {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        comparison = aDate - bDate;
        break;
      }
      case "submittedAt": {
        const aDate = new Date(a.submittedAt).getTime();
        const bDate = new Date(b.submittedAt).getTime();
        comparison = aDate - bDate;
        break;
      }
    }
    return comparison;
  });
  return dir === "desc" ? sorted.reverse() : sorted;
}

function HeaderCell({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = currentKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "group flex w-full items-center gap-1.5 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-brand-zebra",
        active ? "text-brand-purple" : "text-brand-ink/70"
      )}
    >
      {label}
      <span className="inline-flex flex-col">
        <ChevronUp
          className={cn(
            "h-3 w-3 transition-colors",
            active && currentDir === "asc"
              ? "text-brand-purple"
              : "text-brand-ink/30 group-hover:text-brand-ink/50"
          )}
        />
        <ChevronDown
          className={cn(
            "-mt-1 h-3 w-3 transition-colors",
            active && currentDir === "desc"
              ? "text-brand-purple"
              : "text-brand-ink/30 group-hover:text-brand-ink/50"
          )}
        />
      </span>
    </button>
  );
}

export function RequestsList({ initialRequests }: RequestsListProps) {
  const [requests, setRequests] = React.useState(initialRequests);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("submittedAt");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [page, setPage] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [busyDelete, setBusyDelete] = React.useState<number | null>(null);
  const [busyStatus, setBusyStatus] = React.useState<number | null>(null);
  const [statusError, setStatusError] = React.useState<{
    id: number;
    message: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminRequest | null>(
    null
  );
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const query = search.trim().toLowerCase();

  const filtered = React.useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (priorityFilter !== "all" && r.priority !== priorityFilter)
        return false;
      if (typeFilter !== "all" && r.projectType !== typeFilter) return false;
      if (departmentFilter !== "all" && r.department !== departmentFilter)
        return false;
      if (query) {
        const hay = [
          r.projectTitle,
          r.description,
          r.fullName,
          r.email,
          r.publicReference,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [
    requests,
    statusFilter,
    priorityFilter,
    typeFilter,
    departmentFilter,
    query,
  ]);

  const sorted = React.useMemo(
    () => sortRequests(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir]
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(startIndex, startIndex + PAGE_SIZE);

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  React.useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter, typeFilter, departmentFilter, search]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const pageIds = pageRows.map((r) => r.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }

  async function handleStatusChange(request: AdminRequest, next: RequestStatus) {
    setStatusError(null);
    const validation = validateStatusTransition(request.status, next);
    if (!validation.ok) {
      setStatusError({ id: request.id, message: validation.error });
      return;
    }
    setBusyStatus(request.id);
    try {
      const response = await fetch(`/api/admin/requests/${request.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatusError({
          id: request.id,
          message: data.error || `Update failed (${response.status})`,
        });
        return;
      }
      setRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, status: next } : r))
      );
    } catch (err) {
      setStatusError({
        id: request.id,
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setBusyStatus(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    setBusyDelete(deleteTarget.id);
    try {
      const response = await fetch(
        `/api/admin/requests/${deleteTarget.id}`,
        {
          method: "DELETE",
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDeleteError(data.error || `Delete failed (${response.status})`);
        return;
      }
      setRequests((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusyDelete(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setTypeFilter("all");
    setDepartmentFilter("all");
  }

  const hasFilters =
    search ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    typeFilter !== "all" ||
    departmentFilter !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-ink/40" />
          <Input
            type="text"
            placeholder="Search title, description, requester…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white border-brand-zebra focus-visible:ring-brand-purple"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-ink/40 hover:text-brand-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <FilterSelect
            label="Status"
            value={statusFilter}
            options={STATUSES}
            onChange={setStatusFilter}
          />
          <FilterSelect
            label="Priority"
            value={priorityFilter}
            options={PRIORITIES}
            onChange={setPriorityFilter}
          />
          <FilterSelect
            label="Project Type"
            value={typeFilter}
            options={PROJECT_TYPES}
            onChange={setTypeFilter}
          />
          <FilterSelect
            label="Department"
            value={departmentFilter}
            options={DEPARTMENTS}
            onChange={setDepartmentFilter}
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-brand-purple hover:text-brand-purple-dark hover:bg-brand-purple/10"
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-brand-zebra bg-white shadow-sm overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-brand-zebra border-b border-brand-zebra">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-brand-ink/30 text-brand-purple focus:ring-brand-purple"
                    checked={
                      pageRows.length > 0 &&
                      pageRows.every((r) => selectedIds.has(r.id))
                    }
                    onChange={toggleSelectAll}
                    aria-label="Select all requests on page"
                  />
                </th>
                <th className="px-0 py-0">
                  <HeaderCell
                    label="Project Title"
                    sortKey="projectTitle"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-0 py-0">
                  <HeaderCell
                    label="Requester"
                    sortKey="fullName"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-0 py-0">
                  <HeaderCell
                    label="Department"
                    sortKey="department"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-0 py-0">
                  <HeaderCell
                    label="Type"
                    sortKey="projectType"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-0 py-0">
                  <HeaderCell
                    label="Priority"
                    sortKey="priority"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-0 py-0">
                  <HeaderCell
                    label="Status"
                    sortKey="status"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-0 py-0">
                  <HeaderCell
                    label="Due Date"
                    sortKey="dueDate"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-0 py-0">
                  <HeaderCell
                    label="Submitted"
                    sortKey="submittedAt"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink/70">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-zebra">
              {pageRows.map((request) => {
                const isTerminal = request.status === "Completed";
                return (
                  <tr
                    key={request.id}
                    className={cn(
                      "bg-white hover:bg-brand-zebra/60 transition-colors",
                      selectedIds.has(request.id) && "bg-brand-purple/5"
                    )}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-brand-ink/30 text-brand-purple focus:ring-brand-purple"
                        checked={selectedIds.has(request.id)}
                        onChange={() => toggleSelect(request.id)}
                        aria-label={`Select request ${request.projectTitle}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-brand-ink max-w-[260px]">
                      <div className="truncate" title={request.projectTitle}>
                        {request.projectTitle}
                      </div>
                      <div className="text-xs text-brand-ink/50 mt-0.5">
                        {request.publicReference}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-brand-ink">
                        {request.fullName}
                      </div>
                      <div className="text-xs text-brand-ink/60">
                        {request.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brand-ink/80">
                      {request.department}
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{request.projectType}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={priorityClasses(request.priority)}>
                        {request.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge className={statusClasses(request.status)}>
                          {request.status}
                        </Badge>
                        {statusError?.id === request.id && (
                          <span
                            className="text-xs text-red-600 inline-flex items-center gap-1"
                            title={statusError.message}
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span className="max-w-[160px] truncate">
                              {statusError.message}
                            </span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brand-ink/80 whitespace-nowrap">
                      {formatDate(request.dueDate ?? request.desiredDeadline)}
                    </td>
                    <td className="px-4 py-3 text-brand-ink/80 whitespace-nowrap">
                      {formatDate(request.submittedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/requests/${request.id}`}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium bg-brand-zebra text-brand-ink hover:bg-brand-purple/10 hover:text-brand-purple transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                        <InlineStatusSelect
                          value={request.status}
                          disabled={busyStatus === request.id || isTerminal}
                          onChange={(next) =>
                            handleStatusChange(request, next)
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(request);
                          }}
                          aria-label={`Delete request ${request.projectTitle}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-brand-zebra">
          {pageRows.map((request) => {
            const isTerminal = request.status === "Completed";
            return (
              <div
                key={request.id}
                className={cn(
                  "p-4 space-y-3 bg-white",
                  selectedIds.has(request.id) && "bg-brand-purple/5"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-brand-ink/30 text-brand-purple focus:ring-brand-purple"
                      checked={selectedIds.has(request.id)}
                      onChange={() => toggleSelect(request.id)}
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-brand-ink break-words">
                        {request.projectTitle}
                      </div>
                      <div className="text-xs text-brand-ink/50">
                        {request.publicReference}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-brand-ink/50">Requester</div>
                    <div className="font-medium text-brand-ink truncate">
                      {request.fullName}
                    </div>
                    <div className="text-xs text-brand-ink/60 truncate">
                      {request.email}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-brand-ink/50">Department</div>
                    <div className="text-brand-ink/80">{request.department}</div>
                  </div>
                  <div>
                    <div className="text-xs text-brand-ink/50">Type</div>
                    <Badge>{request.projectType}</Badge>
                  </div>
                  <div>
                    <div className="text-xs text-brand-ink/50">Priority</div>
                    <Badge className={priorityClasses(request.priority)}>
                      {request.priority}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs text-brand-ink/50">Status</div>
                    <div className="flex flex-col gap-1">
                      <Badge className={statusClasses(request.status)}>
                        {request.status}
                      </Badge>
                      {statusError?.id === request.id && (
                        <span className="text-xs text-red-600 inline-flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>{statusError.message}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-brand-ink/50">Due</div>
                    <div className="text-brand-ink/80">
                      {formatDate(request.dueDate ?? request.desiredDeadline)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="text-xs text-brand-ink/50">
                    Submitted {formatDate(request.submittedAt)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/requests/${request.id}`}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium bg-brand-zebra text-brand-ink hover:bg-brand-purple/10 hover:text-brand-purple transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Link>
                    <InlineStatusSelect
                      value={request.status}
                      disabled={busyStatus === request.id || isTerminal}
                      onChange={(next) => handleStatusChange(request, next)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(request);
                      }}
                      aria-label={`Delete request ${request.projectTitle}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {pageRows.length === 0 && (
          <div className="p-8 text-center text-brand-ink/60">
            {hasFilters
              ? "No requests match the current filters."
              : "No requests yet."}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-brand-ink/70">
          Showing {sorted.length === 0 ? 0 : startIndex + 1}–
          {Math.min(startIndex + PAGE_SIZE, sorted.length)} of {sorted.length}{" "}
          {filtered.length !== requests.length && (
            <span className="text-brand-ink/50">
              ({requests.length} total)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage(1)}
            disabled={safePage <= 1}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm text-brand-ink/80">
            Page {safePage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage(totalPages)}
            disabled={safePage >= totalPages}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-brand-ink">
              Delete request?
            </DialogTitle>
            <DialogDescription className="text-brand-ink/70">
              This will permanently remove{" "}
              <strong className="text-brand-ink">
                {deleteTarget?.projectTitle}
              </strong>{" "}
              ({deleteTarget?.publicReference}) and all related attachments and
              activity history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {deleteError}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={busyDelete === deleteTarget?.id}
            >
              {busyDelete === deleteTarget?.id ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-brand-ink/70">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-[150px] bg-white border-brand-zebra focus:ring-brand-purple">
          <SelectValue placeholder={`All ${label}s`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function InlineStatusSelect({
  value,
  disabled,
  onChange,
}: {
  value: RequestStatus;
  disabled?: boolean;
  onChange: (next: RequestStatus) => void;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(v) => onChange(v as RequestStatus)}
    >
      <SelectTrigger
        className={cn(
          "h-8 w-[120px] text-xs border-brand-zebra focus:ring-brand-purple",
          disabled && "opacity-60 cursor-not-allowed"
        )}
        aria-label="Edit status"
      >
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}
