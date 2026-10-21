"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Download, FileText, Paperclip, Calendar as CalendarIcon, MessageSquare, ExternalLink, Trash2, Pencil, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDate, formatDateTime, formatFileSize, fieldLabel, relativeTime } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Markdown, MarkdownHint } from "@/components/ui/markdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  VALID_STATUSES,
  type RequestStatus,
} from "@/lib/status-workflow";

const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
const PROJECT_TYPES = ["Presentation", "Document", "Video", "Website", "Graphics", "UI/UX", "Other"] as const;
const BRANDING_DIRECTIONS = ["NStarX", "SHI", "NStarX + SHI", "Not sure", "Other"] as const;
const ASSIGNEES = ["Shantanu", "Sujay"] as const;

interface Attachment {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

interface ActivityEntry {
  id: number;
  actorEmail: string;
  actorName: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

interface Comment {
  id: number;
  actorName: string;
  actorEmail: string;
  content: string;
  createdAt: string;
}

interface AdminRequest {
  id: number;
  publicReference: string;
  fullName: string;
  email: string;
  projectType: string;
  brandingDirection: string;
  projectTitle: string;
  description: string;
  desiredDeadline: string | null;
  priority: string;
  status: RequestStatus;
  dueDate: string | null;
  internalNotes: string;
  assignee: string;
  driveUrl: string | null;
  submittedAt: string;
}

interface RequestDetailProps {
  request: AdminRequest;
  attachments: Attachment[];
}

function statusClasses(status: RequestStatus) {
  switch (status) {
    case "Submitted":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "Not Started":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "In Progress":
      return "bg-brand-purple/10 text-brand-purple border-brand-purple/20";
    case "In Review":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "Completed":
      return "bg-brand-purple/10 text-brand-purple border-brand-purple/20";
    case "Rejected":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function priorityClasses(priority: string) {
  switch (priority) {
    case "Low":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "Medium":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "High":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "Urgent":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function formatActivityValue(field: string, value: string | null): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "due_date") return formatDate(value);
  return value;
}

export function RequestDetail({ request, attachments }: RequestDetailProps) {
  const [requestData, setRequestData] = React.useState(request);
  const [attachmentsData] = React.useState(attachments);

  const [selectedStatus, setSelectedStatus] = React.useState<RequestStatus>(request.status);
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = React.useState(false);
  const [busyStatus, setBusyStatus] = React.useState(false);

  const [selectedPriority, setSelectedPriority] = React.useState(request.priority);
  const [prioritySaving, setPrioritySaving] = React.useState(false);
  const [priorityMessage, setPriorityMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const [dueDate, setDueDate] = React.useState<Date | undefined>(
    request.dueDate ? new Date(request.dueDate) : undefined
  );
  const [dueDateSaving, setDueDateSaving] = React.useState(false);
  const [dueDateMessage, setDueDateMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const [notes, setNotes] = React.useState(request.internalNotes);
  const [notesSaving, setNotesSaving] = React.useState(false);
  const [notesMessage, setNotesMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const [assignee, setAssignee] = React.useState(request.assignee);
  const [assigneeSaving, setAssigneeSaving] = React.useState(false);
  const [assigneeMessage, setAssigneeMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const [driveUrl, setDriveUrl] = React.useState(request.driveUrl ?? "");
  const [driveUrlSaving, setDriveUrlSaving] = React.useState(false);
  const [driveUrlMessage, setDriveUrlMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const [commentDraft, setCommentDraft] = React.useState("");
  const [commentSaving, setCommentSaving] = React.useState(false);
  const [commentMessage, setCommentMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = React.useState(true);

  const [activity, setActivity] = React.useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = React.useState(true);
  const [activityError, setActivityError] = React.useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const [editMode, setEditMode] = React.useState(false);
  const [descriptionPreview, setDescriptionPreview] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [draft, setDraft] = React.useState<{
    projectTitle: string;
    description: string;
    projectType: string;
    priority: string;
    status: RequestStatus;
    dueDate: string | null;
    assignee: string;
    brandingDirection: string;
    driveUrl: string | null;
    internalNotes: string;
  }>({
    projectTitle: request.projectTitle,
    description: request.description,
    projectType: request.projectType,
    priority: request.priority,
    status: request.status,
    dueDate: request.dueDate,
    assignee: request.assignee,
    brandingDirection: request.brandingDirection,
    driveUrl: request.driveUrl,
    internalNotes: request.internalNotes,
  });

  const router = useRouter();

  React.useEffect(() => {
    loadActivity();
    loadComments();
  }, [requestData.id]);

  async function loadActivity() {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const response = await fetch(`/api/admin/requests/${requestData.id}/activity`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setActivityError(data.error || `Could not load activity log (${response.status}).`);
        return;
      }
      setActivity((data.entries || []).slice().reverse());
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : "Network error loading activity log.");
    } finally {
      setActivityLoading(false);
    }
  }

  async function loadComments() {
    setCommentsLoading(true);
    try {
      const response = await fetch(`/api/admin/requests/${requestData.id}/comments`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      setComments((data.comments || []).slice().reverse());
    } finally {
      setCommentsLoading(false);
    }
  }

  async function postComment() {
    if (!commentDraft.trim()) return;
    setCommentSaving(true);
    setCommentMessage(null);
    try {
      const response = await fetch(`/api/admin/requests/${requestData.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentDraft.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCommentMessage({ type: "error", text: data.error || `Save failed (${response.status}).` });
        return;
      }
      setCommentDraft("");
      setCommentMessage({ type: "success", text: "Comment added." });
      await loadComments();
      setTimeout(() => setCommentMessage(null), 2000);
    } catch (err) {
      setCommentMessage({ type: "error", text: err instanceof Error ? err.message : "Network error." });
    } finally {
      setCommentSaving(false);
    }
  }

  async function updateAssignee() {
    setAssigneeMessage(null);
    setAssigneeSaving(true);
    try {
      const response = await fetch(`/api/admin/requests/${requestData.id}/assignee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAssigneeMessage({ type: "error", text: data.error || `Update failed (${response.status}).` });
        return;
      }
      setRequestData((prev) => ({ ...prev, assignee }));
      setAssigneeMessage({ type: "success", text: "Assignee updated." });
      await loadActivity();
      setTimeout(() => setAssigneeMessage(null), 2000);
    } catch (err) {
      setAssigneeMessage({ type: "error", text: err instanceof Error ? err.message : "Network error." });
    } finally {
      setAssigneeSaving(false);
    }
  }

  async function updateDriveUrl() {
    setDriveUrlMessage(null);
    setDriveUrlSaving(true);
    const next = driveUrl.trim() || null;
    try {
      const response = await fetch(`/api/admin/requests/${requestData.id}/drive-url`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveUrl: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDriveUrlMessage({ type: "error", text: data.error || `Update failed (${response.status}).` });
        return;
      }
      setRequestData((prev) => ({ ...prev, driveUrl: next }));
      setDriveUrlMessage({ type: "success", text: "Drive link updated." });
      await loadActivity();
      setTimeout(() => setDriveUrlMessage(null), 2000);
    } catch (err) {
      setDriveUrlMessage({ type: "error", text: err instanceof Error ? err.message : "Network error." });
    } finally {
      setDriveUrlSaving(false);
    }
  }

  async function updateStatus(nextStatus?: RequestStatus) {
    const target = nextStatus ?? selectedStatus;
    setStatusError(null);
    setStatusSuccess(false);

    setBusyStatus(true);
    try {
      const response = await fetch(`/api/admin/requests/${requestData.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatusError(data.error || `Update failed (${response.status}).`);
        return;
      }
      setRequestData((prev) => ({ ...prev, status: target }));
      if (nextStatus) setSelectedStatus(nextStatus);
      setStatusSuccess(true);
      await loadActivity();
      setTimeout(() => setStatusSuccess(false), 2000);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setBusyStatus(false);
    }
  }

  async function deleteRequest() {
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      const response = await fetch(`/api/admin/requests/${requestData.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDeleteError(data.error || `Delete failed (${response.status}).`);
        return;
      }
      router.push("/dashboard/requests");
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function updatePriority() {
    setPriorityMessage(null);
    setPrioritySaving(true);
    try {
      const response = await fetch(`/api/admin/requests/${requestData.id}/priority`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: selectedPriority }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPriorityMessage({ type: "error", text: data.error || `Update failed (${response.status}).` });
        return;
      }
      setRequestData((prev) => ({ ...prev, priority: selectedPriority }));
      setPriorityMessage({ type: "success", text: "Priority updated." });
      await loadActivity();
      setTimeout(() => setPriorityMessage(null), 2000);
    } catch (err) {
      setPriorityMessage({ type: "error", text: err instanceof Error ? err.message : "Network error." });
    } finally {
      setPrioritySaving(false);
    }
  }

  async function updateDueDate(nextDate: Date | undefined) {
    setDueDate(nextDate);
    const nextString = nextDate ? nextDate.toISOString().slice(0, 10) : null;
    setDueDateMessage(null);
    setDueDateSaving(true);
    try {
      const response = await fetch(`/api/admin/requests/${requestData.id}/due-date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: nextString }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDueDateMessage({ type: "error", text: data.error || `Update failed (${response.status}).` });
        return;
      }
      setRequestData((prev) => ({ ...prev, dueDate: nextString }));
      setDueDateMessage({ type: "success", text: "Due date updated." });
      await loadActivity();
      setTimeout(() => setDueDateMessage(null), 2000);
    } catch (err) {
      setDueDateMessage({ type: "error", text: err instanceof Error ? err.message : "Network error." });
    } finally {
      setDueDateSaving(false);
    }
  }

  async function saveNotes() {
    setNotesMessage(null);
    setNotesSaving(true);
    try {
      const response = await fetch(`/api/admin/requests/${requestData.id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotesMessage({ type: "error", text: data.error || `Save failed (${response.status}).` });
        return;
      }
      setRequestData((prev) => ({ ...prev, internalNotes: notes }));
      setNotesMessage({ type: "success", text: "Notes saved." });
      await loadActivity();
      setTimeout(() => setNotesMessage(null), 2000);
    } catch (err) {
      setNotesMessage({ type: "error", text: err instanceof Error ? err.message : "Network error." });
    } finally {
      setNotesSaving(false);
    }
  }

  function startEdit() {
    setDraft({
      projectTitle: requestData.projectTitle,
      description: requestData.description,
      projectType: requestData.projectType,
      priority: requestData.priority,
      status: requestData.status,
      dueDate: requestData.dueDate,
      assignee: requestData.assignee,
      brandingDirection: requestData.brandingDirection,
      driveUrl: requestData.driveUrl,
      internalNotes: requestData.internalNotes,
    });
    setDescriptionPreview(false);
    setSaveMessage(null);
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setSaveMessage(null);
    setDescriptionPreview(false);
  }

  async function saveEdits() {
    setSaveMessage(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/requests/${requestData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectTitle: draft.projectTitle,
          description: draft.description,
          projectType: draft.projectType,
          priority: draft.priority,
          status: draft.status,
          dueDate: draft.dueDate,
          assignee: draft.assignee,
          brandingDirection: draft.brandingDirection,
          driveUrl: draft.driveUrl,
          internalNotes: draft.internalNotes,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveMessage({ type: "error", text: data.error || `Save failed (${response.status}).` });
        return;
      }
      setRequestData((prev) => ({
        ...prev,
        projectTitle: draft.projectTitle,
        description: draft.description,
        projectType: draft.projectType,
        priority: draft.priority,
        status: draft.status,
        dueDate: draft.dueDate,
        assignee: draft.assignee,
        brandingDirection: draft.brandingDirection,
        driveUrl: draft.driveUrl,
        internalNotes: draft.internalNotes,
      }));
      setSelectedStatus(draft.status);
      setSelectedPriority(draft.priority);
      setAssignee(draft.assignee);
      setDueDate(draft.dueDate ? new Date(draft.dueDate) : undefined);
      setDriveUrl(draft.driveUrl ?? "");
      setNotes(draft.internalNotes);
      setSaveMessage({ type: "success", text: "Request updated." });
      await loadActivity();
      setTimeout(() => {
        setSaveMessage(null);
        setEditMode(false);
      }, 1500);
    } catch (err) {
      setSaveMessage({ type: "error", text: err instanceof Error ? err.message : "Network error." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/dashboard/requests"
            className="inline-flex items-center gap-1 text-sm text-brand-purple hover:text-brand-purple-dark hover:underline mb-2 min-h-11"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to requests
          </Link>
          <h1 className="font-heading text-2xl md:text-3xl text-brand-ink break-words">
            {requestData.projectTitle}
          </h1>
          <p className="text-sm text-brand-ink/60 mt-1">
            {requestData.publicReference} · Submitted {formatDate(requestData.submittedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium",
              statusClasses(requestData.status)
            )}
          >
            {requestData.status}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium",
              priorityClasses(requestData.priority)
            )}
          >
            {requestData.priority}
          </span>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-700 border-slate-200 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        {/* Main details */}
        <div className="space-y-4 md:space-y-6 lg:col-span-2">
          <section className="rounded-[4px] border border-brand-zebra bg-white p-4 md:p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="font-heading text-lg text-brand-ink">Request details</h2>
              {!editMode ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startEdit}
                  className="min-h-9"
                >
                  <Pencil className="h-4 w-4 mr-1.5" />
                  Edit
                </Button>
              ) : null}
            </div>

            {!editMode ? (
              <>
                <dl className="grid gap-3 md:gap-4 sm:grid-cols-2">
                  <DetailItem label="Requester" value={requestData.fullName} />
                  <DetailItem label="Email" value={requestData.email} />
                  <DetailItem label="Project type" value={requestData.projectType} />
                  {requestData.brandingDirection ? (
                    <DetailItem label="Branding direction" value={requestData.brandingDirection} />
                  ) : null}
                  {requestData.driveUrl ? (
                    <div className="sm:col-span-2">
                      <DetailItem
                        label="Google Drive link"
                        value={
                          <a
                            href={requestData.driveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-brand-purple hover:underline break-all"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            <span className="break-all">{requestData.driveUrl}</span>
                          </a>
                        }
                      />
                    </div>
                  ) : null}
                  <DetailItem
                    label="Desired deadline"
                    value={formatDate(requestData.desiredDeadline)}
                  />
                  <DetailItem label="Assignee" value={requestData.assignee} />
                  <DetailItem label="Submitted" value={formatDateTime(requestData.submittedAt)} />
                </dl>
                <div className="mt-4 md:mt-5">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-brand-ink/60 mb-1">
                    Description
                  </dt>
                  <dd className="text-brand-ink/90 leading-relaxed">
                    <Markdown>{requestData.description}</Markdown>
                  </dd>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-projectTitle">Project Title</Label>
                  <Input
                    id="edit-projectTitle"
                    value={draft.projectTitle}
                    onChange={(e) => setDraft((d) => ({ ...d, projectTitle: e.target.value }))}
                    className="bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-projectType">Project Type</Label>
                    <Select
                      value={draft.projectType}
                      onValueChange={(v) => setDraft((d) => ({ ...d, projectType: v }))}
                    >
                      <SelectTrigger id="edit-projectType" className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-brand-zebra">
                        {PROJECT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-brandingDirection">Branding Direction</Label>
                    <Select
                      value={draft.brandingDirection}
                      onValueChange={(v) => setDraft((d) => ({ ...d, brandingDirection: v }))}
                    >
                      <SelectTrigger id="edit-brandingDirection" className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-brand-zebra">
                        {BRANDING_DIRECTIONS.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-description">Project Description</Label>
                    <div className="flex rounded-[4px] border border-brand-zebra overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setDescriptionPreview(false)}
                        className={cn(
                          "px-3 py-1 text-xs font-medium",
                          !descriptionPreview ? "bg-brand-gray text-white" : "bg-white text-brand-ink hover:bg-brand-gray-light"
                        )}
                      >
                        Write
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescriptionPreview(true)}
                        className={cn(
                          "px-3 py-1 text-xs font-medium",
                          descriptionPreview ? "bg-brand-gray text-white" : "bg-white text-brand-ink hover:bg-brand-gray-light"
                        )}
                      >
                        <Eye className="h-3 w-3 mr-1 inline" />
                        Preview
                      </button>
                    </div>
                  </div>
                  {descriptionPreview ? (
                    <div className="rounded-[4px] border border-brand-zebra bg-white p-3 min-h-[120px]">
                      <Markdown>{draft.description}</Markdown>
                    </div>
                  ) : (
                    <Textarea
                      id="edit-description"
                      value={draft.description}
                      onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                      rows={6}
                      className="bg-white resize-none"
                    />
                  )}
                  <MarkdownHint />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-priority">Priority</Label>
                    <Select
                      value={draft.priority}
                      onValueChange={(v) => setDraft((d) => ({ ...d, priority: v }))}
                    >
                      <SelectTrigger id="edit-priority" className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-brand-zebra">
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={draft.status}
                      onValueChange={(v) => setDraft((d) => ({ ...d, status: v as RequestStatus }))}
                    >
                      <SelectTrigger id="edit-status" className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-brand-zebra">
                        {VALID_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-assignee">Assignee</Label>
                    <Select
                      value={draft.assignee}
                      onValueChange={(v) => setDraft((d) => ({ ...d, assignee: v }))}
                    >
                      <SelectTrigger id="edit-assignee" className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-brand-zebra">
                        {ASSIGNEES.map((a) => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Due date</Label>
                    <EditDueDate
                      value={draft.dueDate ? new Date(draft.dueDate) : undefined}
                      onChange={(date) => {
                        const next = date ? date.toISOString().slice(0, 10) : null;
                        setDraft((d) => ({ ...d, dueDate: next }));
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-driveUrl">Google Drive link</Label>
                  <Input
                    id="edit-driveUrl"
                    type="url"
                    value={draft.driveUrl ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, driveUrl: e.target.value || null }))}
                    placeholder="https://drive.google.com/..."
                    className="bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-internalNotes">Internal notes</Label>
                  <Textarea
                    id="edit-internalNotes"
                    value={draft.internalNotes}
                    onChange={(e) => setDraft((d) => ({ ...d, internalNotes: e.target.value }))}
                    rows={4}
                    className="bg-white resize-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button onClick={saveEdits} disabled={saving}>
                    {saving ? (
                      <>
                        <Save className="mr-2 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save changes
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                    Cancel
                  </Button>
                </div>
                {saveMessage && (
                  <MessageBox type={saveMessage.type} text={saveMessage.text} />
                )}
              </div>
            )}
          </section>

          <section className="rounded-[4px] border border-brand-zebra bg-white p-4 md:p-5">
            <h2 className="font-heading text-lg text-brand-ink mb-3 md:mb-4 inline-flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Attachments
            </h2>
            {attachmentsData.length === 0 ? (
              <p className="text-sm text-brand-ink/60">No attachments.</p>
            ) : (
              <ul className="divide-y divide-brand-zebra">
                {attachmentsData.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-2.5 md:py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-brand-ink/40 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-brand-ink truncate" title={a.originalFilename}>
                          {a.originalFilename}
                        </p>
                        <p className="text-xs text-brand-ink/60">{formatFileSize(a.sizeBytes)} · {a.mimeType}</p>
                      </div>
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="shrink-0 w-full sm:w-auto"
                    >
                      <a
                        href={`/api/admin/requests/${requestData.id}/attachments/${a.id}`}
                        download={a.originalFilename}
                        className="inline-flex items-center justify-center gap-1.5"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Comments */}
          <section className="rounded-[4px] border border-brand-zebra bg-white p-4 md:p-5 space-y-4">
            <h2 className="font-heading text-lg text-brand-ink inline-flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comments
            </h2>
            <div className="space-y-4 max-h-[24rem] overflow-y-auto pr-1">
              {commentsLoading ? (
                <p className="text-sm text-brand-ink/50">Loading comments…</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-brand-ink/60">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="rounded-[4px] bg-brand-canvas p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-brand-ink truncate">{c.actorName || c.actorEmail}</span>
                      <span className="text-xs text-brand-ink/50 shrink-0">{relativeTime(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-brand-ink/90 whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2 pt-2 border-t border-brand-zebra">
              <Textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Add a comment…"
                rows={3}
                className="bg-white border-brand-zebra focus-visible:ring-brand-purple-light resize-none"
              />
              <Button
                onClick={postComment}
                disabled={commentSaving || !commentDraft.trim()}
                className="w-full"
              >
                {commentSaving ? "Posting…" : "Post Comment"}
              </Button>
              {commentMessage && (
                <MessageBox type={commentMessage.type} text={commentMessage.text} />
              )}
            </div>
          </section>

          <section className="rounded-[4px] border border-brand-zebra bg-white p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg text-brand-ink">Activity log</h2>
              {activityLoading && (
                <span className="text-xs text-brand-ink/50">Loading…</span>
              )}
            </div>
            {activityError ? (
              <div className="rounded-[4px] bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {activityError}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-sm text-brand-ink/60">No activity yet.</p>
            ) : (
              <ul className="space-y-4 max-h-[24rem] overflow-y-auto pr-1">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex gap-3 text-sm">
                    <div className="mt-1 h-2 w-2 rounded-full bg-brand-purple shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-brand-ink">
                        <span className="font-bold">{entry.actorName || entry.actorEmail}</span>{" "}
                        changed{" "}
                        <span className="font-medium">{fieldLabel(entry.field)}</span>
                      </p>
                      <p className="text-brand-ink/70 mt-0.5 break-words">
                        {formatActivityValue(entry.field, entry.oldValue)} →{" "}
                        {formatActivityValue(entry.field, entry.newValue)}
                      </p>
                      <p className="text-xs text-brand-ink/50 mt-1">
                        {formatDateTime(entry.createdAt)} · {relativeTime(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Sidebar controls */}
        <div className="space-y-4 md:space-y-6 lg:col-span-1">
          <section className="rounded-[4px] border border-brand-zebra bg-white p-4 md:p-5 space-y-4 md:space-y-5">
            <h2 className="font-heading text-lg text-brand-ink">Manage request</h2>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={selectedStatus}
                disabled={busyStatus}
                onValueChange={(v) => {
                  setSelectedStatus(v as RequestStatus);
                  setStatusError(null);
                  setStatusSuccess(false);
                  updateStatus(v as RequestStatus);
                }}
              >
                <SelectTrigger id="status" className="bg-white border-brand-zebra focus:ring-brand-purple-light hover:border-brand-purple-light data-[state=open]:border-brand-purple-light">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-white border-brand-zebra">
                  {VALID_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => updateStatus()}
                disabled={busyStatus}
                className="w-full"
              >
                {busyStatus ? "Updating…" : "Update Status"}
              </Button>
              {statusError && (
                <div className="rounded-[4px] bg-red-50 p-2.5 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {statusError}
                </div>
              )}
              {statusSuccess && (
                <div className="rounded-[4px] bg-brand-purple/10 p-2.5 text-sm text-brand-purple flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Status updated.
                </div>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={selectedPriority}
                disabled={prioritySaving}
                onValueChange={(v) => setSelectedPriority(v)}
              >
                <SelectTrigger id="priority" className="bg-white border-brand-zebra focus:ring-brand-purple-light hover:border-brand-purple-light data-[state=open]:border-brand-purple-light">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent className="bg-white border-brand-zebra">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={updatePriority}
                disabled={prioritySaving || selectedPriority === requestData.priority}
                variant="outline"
                className="w-full"
              >
                {prioritySaving ? "Saving…" : "Update Priority"}
              </Button>
              {priorityMessage && (
                <MessageBox type={priorityMessage.type} text={priorityMessage.text} />
              )}
            </div>

            {/* Assignee */}
            <div className="space-y-2">
              <Label htmlFor="assignee">Assignee</Label>
              <Select
                value={assignee}
                disabled={assigneeSaving}
                onValueChange={(v) => setAssignee(v)}
              >
                <SelectTrigger id="assignee" className="bg-white border-brand-zebra focus:ring-brand-purple-light hover:border-brand-purple-light data-[state=open]:border-brand-purple-light">
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent className="bg-white border-brand-zebra">
                  {ASSIGNEES.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={updateAssignee}
                disabled={assigneeSaving || assignee === requestData.assignee}
                variant="outline"
                className="w-full"
              >
                {assigneeSaving ? "Saving…" : "Update Assignee"}
              </Button>
              {assigneeMessage && (
                <MessageBox type={assigneeMessage.type} text={assigneeMessage.text} />
              )}
            </div>

            {/* Drive URL */}
            <div className="space-y-2">
              <Label htmlFor="drive-url">Google Drive link</Label>
              <div className="flex gap-2">
                <Input
                  id="drive-url"
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  className="bg-white border-brand-zebra focus-visible:ring-brand-purple-light"
                />
              </div>
              <Button
                onClick={updateDriveUrl}
                disabled={driveUrlSaving || driveUrl.trim() === (requestData.driveUrl ?? "")}
                variant="outline"
                className="w-full"
              >
                {driveUrlSaving ? "Saving…" : "Update Drive Link"}
              </Button>
              {driveUrlMessage && (
                <MessageBox type={driveUrlMessage.type} text={driveUrlMessage.text} />
              )}
            </div>

            {/* Due date */}
            <div className="space-y-2">
              <Label htmlFor="due-date">Due date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="due-date"
                    variant="outline"
                    disabled={dueDateSaving}
                    className={cn(
                      "w-full justify-start text-left font-normal border-brand-zebra bg-white",
                      !dueDate && "text-brand-ink/50"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? formatDate(dueDate.toISOString()) : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={updateDueDate}
                  />
                </PopoverContent>
              </Popover>
              {dueDateMessage && (
                <MessageBox type={dueDateMessage.type} text={dueDateMessage.text} />
              )}
            </div>
          </section>

          {/* Internal notes */}
          <section className="rounded-[4px] border border-brand-zebra bg-white p-4 md:p-5 space-y-3">
            <h2 className="font-heading text-lg text-brand-ink">Internal notes</h2>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add admin-only notes…"
              rows={6}
              className="bg-white border-brand-zebra focus-visible:ring-brand-purple-light resize-none"
            />
            <Button
              onClick={saveNotes}
              disabled={notesSaving || notes === requestData.internalNotes}
              className="w-full"
            >
              {notesSaving ? (
                <>
                  <Save className="mr-2 h-4 w-4" /> Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Save Notes
                </>
              )}
            </Button>
            {notesMessage && (
              <MessageBox type={notesMessage.type} text={notesMessage.text} />
            )}
          </section>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteError(null);
        }}
      >
        <DialogContent className="sm:max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-brand-ink">Delete request?</DialogTitle>
            <DialogDescription className="text-brand-ink/70">
              This will permanently remove{" "}
              <strong className="text-brand-ink">{requestData.projectTitle}</strong>{" "}
              ({requestData.publicReference}) and all related attachments and
              activity history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-[4px] bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {deleteError}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteError(null);
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={deleteRequest}
              disabled={deleteBusy}
              className="w-full sm:w-auto"
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-brand-ink/60 mb-1">
        {label}
      </dt>
      <dd className="text-sm text-brand-ink/90">{value}</dd>
    </div>
  );
}

function MessageBox({ type, text }: { type: "success" | "error"; text: string }) {
  return (
    <div
      className={cn(
        "rounded-[4px] p-2.5 text-sm flex items-center gap-2",
        type === "success" ? "bg-brand-purple/10 text-brand-purple" : "bg-red-50 text-red-700"
      )}
    >
      {type === "success" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      {text}
    </div>
  );
}

function EditDueDate({
  value,
  onChange,
}: {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className={cn(
            "w-full justify-start text-left font-normal border-brand-zebra bg-white",
            !value && "text-brand-ink/50"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? formatDate(value.toISOString()) : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
