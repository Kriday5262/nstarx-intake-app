"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Search,
  X,
  SlidersHorizontal,
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
import { cn } from "@/lib/utils";
import { VALID_STATUSES, type RequestStatus } from "@/lib/status-workflow";

const STATUSES = VALID_STATUSES;

const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
const PROJECT_TYPES = [
  "Presentation",
  "Document",
  "Video",
  "Website",
  "Graphics",
  "UI/UX",
  "Other",
] as const;
const ASSIGNEES = ["Shantanu", "Sujay"] as const;
const CLOSED_STATUSES = ["Completed", "Rejected"] as const;
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export interface AdminRequest {
  id: number;
  publicReference: string;
  fullName: string;
  email: string;
  projectType: string;
  brandingDirection?: string | null;
  assignee?: string;
  projectTitle: string;
  description: string;
  desiredDeadline: string | null;
  priority: string;
  status: RequestStatus;
  dueDate: string | null;
  internalNotes?: string | null;
  driveUrl?: string | null;
  submittedAt: string;
}

interface RequestsListProps {
  initialRequests: AdminRequest[];
}

type SortKey =
  | "projectTitle"
  | "fullName"
  | "projectType"
  | "priority"
  | "status"
  | "assignee"
  | "dueDate";
type SortDir = "asc" | "desc";

const priorityRank: Record<string, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Urgent: 4,
};

const statusRank: Record<string, number> = {
  Submitted: 1,
  "Not Started": 2,
  "In Progress": 3,
  "In Review": 4,
  Completed: 5,
  Rejected: 6,
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

function isOverdue(value: string | null | undefined): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
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
      case "projectType":
        comparison = a.projectType.localeCompare(b.projectType);
        break;
      case "priority":
        comparison =
          (priorityRank[a.priority] ?? 0) - (priorityRank[b.priority] ?? 0);
        break;
      case "status":
        comparison =
          (statusRank[a.status] ?? 0) - (statusRank[b.status] ?? 0);
        break;
      case "assignee":
        comparison = (a.assignee || "").localeCompare(b.assignee || "");
        break;
      case "dueDate": {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
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
        "group flex w-full items-center gap-1.5 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-brand-zebra",
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
  const router = useRouter();
  const [requests, setRequests] = React.useState(initialRequests);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>("all");
  const [pageSize, setPageSize] = React.useState<number>(25);
  const [sortKey, setSortKey] = React.useState<SortKey>("dueDate");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [page, setPage] = React.useState(1);
  const [showFilters, setShowFilters] = React.useState(false);

  const query = search.trim().toLowerCase();

  const filtered = React.useMemo(() => {
    const showingClosed =
      statusFilter === "Completed" || statusFilter === "Rejected";
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (priorityFilter !== "all" && r.priority !== priorityFilter)
        return false;
      if (typeFilter !== "all" && r.projectType !== typeFilter) return false;
      if (assigneeFilter !== "all" && r.assignee !== assigneeFilter)
        return false;
      if (!showingClosed && CLOSED_STATUSES.includes(r.status as typeof CLOSED_STATUSES[number]))
        return false;
      if (query) {
        const hay = [
          r.projectTitle,
          r.description,
          r.fullName,
          r.email,
          r.publicReference,
          r.assignee,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, priorityFilter, typeFilter, assigneeFilter, query]);

  const sorted = React.useMemo(
    () => sortRequests(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir]
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(startIndex, startIndex + pageSize);

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  React.useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter, typeFilter, assigneeFilter, pageSize, search]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setTypeFilter("all");
    setAssigneeFilter("all");
  }

  const hasFilters =
    search ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    typeFilter !== "all" ||
    assigneeFilter !== "all";

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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-ink/40 hover:text-brand-ink min-h-11 min-w-11 inline-flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button
            variant="outline"
            onClick={() => setShowFilters((v) => !v)}
            className="flex-1 border-brand-zebra hover:bg-brand-purple/10 hover:text-brand-purple min-h-11"
          >
            <SlidersHorizontal className="h-4 w-4 mr-1.5" />
            {showFilters ? "Hide filters" : "Filters"}
            {hasFilters && <span className="ml-1.5 inline-flex h-2 w-2 rounded-full bg-brand-purple" />}
          </Button>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="text-brand-purple hover:text-brand-purple-dark hover:bg-brand-purple/10 min-h-11"
            >
              Clear
            </Button>
          )}
        </div>

        <div className="hidden md:flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
            label="Assignee"
            value={assigneeFilter}
            options={ASSIGNEES}
            onChange={setAssigneeFilter}
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-brand-purple hover:text-brand-purple-dark hover:bg-brand-purple/10 min-h-11 md:min-h-9"
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Mobile filter panel */}
      {showFilters && (
        <div className="md:hidden rounded-lg border border-brand-zebra bg-white p-4 space-y-3 shadow-sm">
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
            label="Assignee"
            value={assigneeFilter}
            options={ASSIGNEES}
            onChange={setAssigneeFilter}
          />
        </div>
      )}

      <div className="rounded-lg border border-brand-zebra bg-white shadow-sm overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-brand-zebra border-b border-brand-zebra">
              <tr>
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
                    label="Assignee"
                    sortKey="assignee"
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
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-zebra">
              {pageRows.map((request) => {
                const due = request.dueDate ?? request.desiredDeadline;
                const detailUrl = `/dashboard/requests/${request.id}`;
                const openDetail = () => router.push(detailUrl);
                const handleRowKey = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetail();
                  }
                };
                return (
                  <tr
                    key={request.id}
                    role="button"
                    tabIndex={0}
                    onClick={openDetail}
                    onKeyDown={handleRowKey}
                    className="bg-white hover:bg-brand-zebra/60 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-purple"
                  >
                    <td className="px-3 py-3">
                      <div className="block font-medium text-brand-ink hover:text-brand-purple">
                        <div className="truncate max-w-[260px]" title={request.projectTitle}>
                          {request.projectTitle}
                        </div>
                        <div className="text-xs text-brand-ink/50 mt-0.5">
                          {request.publicReference}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-medium text-brand-ink">
                      {request.fullName}
                    </td>
                    <td className="px-3 py-3 text-brand-ink/80 whitespace-nowrap">
                      {request.projectType}
                    </td>
                    <td className="px-3 py-3">
                      <Badge className={priorityClasses(request.priority)}>
                        {request.priority}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-brand-ink/80 whitespace-nowrap">
                      {request.status}
                    </td>
                    <td className="px-3 py-3 text-brand-ink/80 whitespace-nowrap">
                      {request.assignee || "—"}
                    </td>
                    <td className={cn(
                      "px-3 py-3 whitespace-nowrap",
                      isOverdue(due) ? "text-red-600 bg-red-50 font-semibold" : "text-brand-ink/80"
                    )}>
                      {formatDate(due)}
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
            const due = request.dueDate ?? request.desiredDeadline;
            const overdue = isOverdue(due);
            return (
              <Link
                key={request.id}
                href={`/dashboard/requests/${request.id}`}
                className="block p-4 space-y-3 bg-white hover:bg-brand-zebra/60 active:bg-brand-zebra"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-brand-ink break-words">
                    {request.projectTitle}
                  </div>
                  <div className="text-xs text-brand-ink/50">
                    {request.publicReference}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-brand-ink/50">Requester</div>
                      <div className="font-medium text-brand-ink truncate">
                        {request.fullName}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-brand-ink/50">Type</div>
                      <div className="text-brand-ink/80">{request.projectType}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-brand-ink/50">Priority</div>
                      <Badge className={priorityClasses(request.priority)}>
                        {request.priority}
                      </Badge>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-brand-ink/50">Status</div>
                      <div className="text-brand-ink/80">{request.status}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-brand-ink/50">Assignee</div>
                      <div className="text-brand-ink/80">{request.assignee || "—"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-brand-ink/50">Due</div>
                      <div className={cn(
                        overdue ? "text-red-600 font-semibold" : "text-brand-ink/80"
                      )}>
                        {overdue && <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                          <span>Overdue</span>
                        </span>}
                        {" "}{formatDate(due)}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {pageRows.length === 0 && (
          <div className="p-8 text-center text-brand-ink/60">
            {hasFilters
              ? "No requests match the current filters."
              : "No open requests yet."}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-sm text-brand-ink/70">
          <span>
            Showing {sorted.length === 0 ? 0 : startIndex + 1}–
            {Math.min(startIndex + pageSize, sorted.length)} of {sorted.length}<span className="sr-only"> results</span>{" "}
            {filtered.length !== requests.length && (
              <span className="text-brand-ink/50">
                ({requests.length} total)
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <label className="text-brand-ink/70" htmlFor="page-size">Show</label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v))}
            >
              <SelectTrigger id="page-size" className="h-11 w-[80px] bg-white border-brand-zebra focus:ring-brand-purple">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-brand-zebra">
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <SelectItem
                    key={s}
                    value={String(s)}
                    className="cursor-pointer focus:bg-brand-lime/20 focus:text-brand-ink data-[state=checked]:text-brand-purple"
                  >
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            onClick={() => setPage(1)}
            disabled={safePage <= 1}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
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
            className="h-11 w-11"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            onClick={() => setPage(totalPages)}
            disabled={safePage >= totalPages}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
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
        <SelectTrigger className="w-full sm:w-[150px] bg-white border-brand-zebra focus:ring-brand-purple hover:border-brand-purple data-[state=open]:border-brand-purple">
          <SelectValue placeholder={`All ${label}s`} />
        </SelectTrigger>
        <SelectContent className="bg-white border-brand-zebra">
          <SelectItem
            value="all"
            className="cursor-pointer focus:bg-brand-lime/20 focus:text-brand-ink data-[state=checked]:text-brand-purple"
          >
            All
          </SelectItem>
          {options.map((o) => (
            <SelectItem
              key={o}
              value={o}
              className="cursor-pointer focus:bg-brand-lime/20 focus:text-brand-ink data-[state=checked]:text-brand-purple"
            >
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}
