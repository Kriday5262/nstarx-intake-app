"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  UploadCloud,
  X,
  AlertCircle,
  Calendar as CalendarIcon,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "video/mp4",
  "video/quicktime",
];
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".xlsx", ".png", ".jpg", ".jpeg", ".mp4", ".mov"];

function isAllowedFile(file: File): boolean {
  if (ALLOWED_TYPES.includes(file.type)) return true;
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function IntakeForm() {
  const router = useRouter();
  const [files, setFiles] = React.useState<File[]>([]);
  const [fileErrors, setFileErrors] = React.useState<string[]>([]);
  const [serverErrors, setServerErrors] = React.useState<Record<string, string | string[]>>({});
  const [dragActive, setDragActive] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const handleFiles = React.useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const added = Array.from(incoming);
    const errors: string[] = [];
    const valid: File[] = [];

    if (files.length + added.length > MAX_FILES) {
      errors.push(`You can attach up to ${MAX_FILES} files only.`);
      return;
    }

    for (const file of added) {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} exceeds the 25 MB limit.`);
        continue;
      }
      if (!isAllowedFile(file)) {
        errors.push(`${file.name} is not a supported file type.`);
        continue;
      }
      valid.push(file);
    }

    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
    if (errors.length) setFileErrors(errors);
  }, [files.length]);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };
  const onDragLeave = () => setDragActive(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFileErrors([]);
    setServerErrors({});

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    files.forEach((file, idx) => {
      formData.set(`file_${idx}`, file);
    });

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitting(false);
        setServerErrors(data.errors || {});
        setFileErrors(data.fileErrors || []);
        return;
      }
      router.push(`/success?ref=${encodeURIComponent(data.reference)}`);
    } catch (err) {
      setSubmitting(false);
      setServerErrors({ _form: "Network error. Please try again." });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="fileCount" value={files.length} />

      {files.map((file, idx) => (
        <input
          key={`${file.name}-${idx}`}
          type="hidden"
          name={`fileName_${idx}`}
          value={file.name}
        />
      ))}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name <span className="text-brand-amber">*</span></Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            placeholder="Jane Doe"
            autoComplete="name"
            aria-invalid={Boolean(serverErrors?.fullName)}
            className={cn(
              "bg-white",
              serverErrors?.fullName && "border-brand-amber focus-visible:ring-brand-amber"
            )}
          />
          {serverErrors?.fullName ? (
            <p className="text-sm text-brand-amber flex items-center gap-1">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {serverErrors.fullName}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email <span className="text-brand-amber">*</span></Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="jane.doe@nstarxinc.com"
            autoComplete="email"
            aria-invalid={Boolean(serverErrors?.email)}
            className={cn(
              "bg-white",
              serverErrors?.email && "border-brand-amber focus-visible:ring-brand-amber"
            )}
          />
          {serverErrors?.email ? (
            <p className="text-sm text-brand-amber flex items-center gap-1">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {serverErrors.email}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="projectType">Project Type <span className="text-brand-amber">*</span></Label>
          <Select name="projectType">
            <SelectTrigger
              id="projectType"
              aria-invalid={Boolean(serverErrors?.projectType)}
              className={cn(
                "bg-white hover:border-brand-purple data-[state=open]:border-brand-purple",
                serverErrors?.projectType && "border-brand-amber focus-visible:ring-brand-amber"
              )}
            >
              <SelectValue placeholder="Select a project type" />
            </SelectTrigger>
            <SelectContent className="bg-white border-brand-zebra">
              <SelectItem value="Presentation">Presentation</SelectItem>
              <SelectItem value="Document">Document</SelectItem>
              <SelectItem value="Video">Video</SelectItem>
              <SelectItem value="Website">Website</SelectItem>
              <SelectItem value="Graphics">Graphics</SelectItem>
              <SelectItem value="UI/UX">UI/UX</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {serverErrors?.projectType ? (
            <p className="text-sm text-brand-amber flex items-center gap-1">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {serverErrors.projectType}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="brandingDirection">Branding Direction <span className="text-brand-amber">*</span></Label>
          <Select name="brandingDirection" defaultValue="NStarX">
            <SelectTrigger
              id="brandingDirection"
              aria-invalid={Boolean(serverErrors?.brandingDirection)}
              className={cn(
                "bg-white hover:border-brand-purple data-[state=open]:border-brand-purple",
                serverErrors?.brandingDirection && "border-brand-amber focus-visible:ring-brand-amber"
              )}
            >
              <SelectValue placeholder="Select branding direction" />
            </SelectTrigger>
            <SelectContent className="bg-white border-brand-zebra">
              <SelectItem
                value="NStarX"
                className="cursor-pointer focus:bg-brand-lime/20 focus:text-brand-ink data-[state=checked]:text-brand-purple"
              >
                NStarX
              </SelectItem>
              <SelectItem
                value="SHI"
                className="cursor-pointer focus:bg-brand-lime/20 focus:text-brand-ink data-[state=checked]:text-brand-purple"
              >
                SHI
              </SelectItem>
              <SelectItem
                value="NStarX + SHI"
                className="cursor-pointer focus:bg-brand-lime/20 focus:text-brand-ink data-[state=checked]:text-brand-purple"
              >
                NStarX + SHI
              </SelectItem>
              <SelectItem
                value="Not sure"
                className="cursor-pointer focus:bg-brand-lime/20 focus:text-brand-ink data-[state=checked]:text-brand-purple"
              >
                Not sure
              </SelectItem>
              <SelectItem
                value="Other"
                className="cursor-pointer focus:bg-brand-lime/20 focus:text-brand-ink data-[state=checked]:text-brand-purple"
              >
                Other
              </SelectItem>
            </SelectContent>
          </Select>
          {serverErrors?.brandingDirection ? (
            <p className="text-sm text-brand-amber flex items-center gap-1">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {serverErrors.brandingDirection}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="projectTitle">Project Title <span className="text-brand-amber">*</span>
        </Label>
        <Input
          id="projectTitle"
          name="projectTitle"
          type="text"
          placeholder="Q4 brand refresh deck"
          aria-invalid={Boolean(serverErrors?.projectTitle)}
          className={cn(
            "bg-white",
            serverErrors?.projectTitle && "border-brand-amber focus-visible:ring-brand-amber"
          )}
        />
        {serverErrors?.projectTitle ? (
          <p className="text-sm text-brand-amber flex items-center gap-1">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {serverErrors.projectTitle}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          Project Description <span className="text-brand-amber">*</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Describe the goals, audience, deliverables, and any deadlines or constraints..."
          rows={5}
          aria-invalid={Boolean(serverErrors?.description)}
          className={cn(
            "bg-white resize-none",
            serverErrors?.description && "border-brand-amber focus-visible:ring-brand-amber"
          )}
        />
        <div className="flex justify-between text-xs text-brand-ink/60">
          <span>Minimum 50 characters</span>
          {serverErrors?.description ? (
            <span className="text-brand-amber flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {serverErrors.description}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label>Desired Deadline</Label>
          <DeadlineField error={serverErrors?.desiredDeadline as string} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select name="priority" defaultValue="Medium">
            <SelectTrigger id="priority" className="bg-white hover:border-brand-purple data-[state=open]:border-brand-purple">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent className="bg-white border-brand-zebra">
              <SelectItem
                value="Low"
                className="cursor-pointer focus:bg-brand-lime/20 focus:text-brand-ink data-[state=checked]:text-brand-purple"
              >
                Low
              </SelectItem>
              <SelectItem
                value="Medium"
                className="cursor-pointer focus:bg-brand-lime/20 focus:text-brand-ink data-[state=checked]:text-brand-purple"
              >
                Medium
              </SelectItem>
              <SelectItem
                value="High"
                className="cursor-pointer focus:bg-brand-lime/20 focus:text-brand-ink data-[state=checked]:text-brand-purple"
              >
                High
              </SelectItem>
              <SelectItem
                value="Urgent"
                className="cursor-pointer focus:bg-brand-lime/20 focus:text-brand-ink data-[state=checked]:text-brand-purple"
              >
                Urgent
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>File Attachments</Label>
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "rounded-lg border-2 border-dashed p-6 transition-colors text-center",
            dragActive
              ? "border-brand-purple bg-brand-purple/5"
              : "border-brand-ink/20 bg-white hover:border-brand-purple/50"
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <UploadCloud className="h-8 w-8 text-brand-purple" />
            <p className="text-sm text-brand-ink/80">
              Drag & drop files here or{" "}
              <label className="cursor-pointer text-brand-purple hover:underline">
                browse
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(e) => handleFiles(e.target.files)}
                  accept={ALLOWED_EXTENSIONS.join(",")}
                />
              </label>
            </p>
            <p className="text-xs text-brand-ink/50">
              Up to {MAX_FILES} files. Max 25 MB each. PDF, DOCX, PPTX, XLSX,
              PNG, JPG, MP4, MOV.
            </p>
          </div>
        </div>

        {(fileErrors.length || ((serverErrors.fileErrors as string[])?.length ?? 0) > 0) ? (
          <div className="space-y-1">
            {Array.from(
              new Set([
                ...fileErrors,
                ...((serverErrors.fileErrors as string[]) || []),
              ])
            ).map((err, i) => (
              <p key={i} className="text-sm text-brand-amber flex items-start gap-1">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {err}
              </p>
            ))}
          </div>
        ) : null}

        {files.length ? (
          <ul className="space-y-2">
            {files.map((file, idx) => (
              <li
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between rounded-md border bg-white p-3 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-brand-purple" />
                  <span className="truncate">{file.name}</span>
                  <span className="text-xs text-brand-ink/50 shrink-0">
                    {formatBytes(file.size)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="ml-2 rounded-full p-1 text-brand-ink/50 hover:bg-brand-zebra hover:text-brand-ink"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="driveUrl">Google Drive Link <span className="text-brand-ink/50">(optional)</span>
        </Label>
        <Input
          id="driveUrl"
          name="driveUrl"
          type="url"
          placeholder="https://drive.google.com/drive/folders/..."
          aria-invalid={Boolean(serverErrors?.driveUrl)}
          className={cn(
            "bg-white focus-visible:ring-brand-purple",
            serverErrors?.driveUrl && "border-brand-amber focus-visible:ring-brand-amber"
          )}
        />
        {serverErrors?.driveUrl ? (
          <p className="text-sm text-brand-amber flex items-center gap-1">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {serverErrors.driveUrl}
          </p>
        ) : null}
      </div>

      {serverErrors?._form ? (
        <div className="rounded-md bg-brand-amber/10 p-4 text-sm text-brand-amber border border-brand-amber/20">
          <p className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {serverErrors._form}
          </p>
        </div>
      ) : null}

      <div className="pt-2">
        <Button
          type="submit"
          disabled={submitting}
          className="w-full md:w-auto bg-brand-purple hover:bg-brand-purple-dark text-white"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit request"
          )}
        </Button>
      </div>
    </form>
  );
}

function DeadlineField({ error }: { error?: string }) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(undefined);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className={cn(
            "w-full justify-start text-left font-normal bg-white",
            !date && "text-brand-ink/50",
            error && "border-brand-amber"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-brand-purple" />
          <input type="hidden" name="desiredDeadline" value={date ? format(date, "yyyy-MM-dd") : ""} />
          {date ? format(date, "PPP") : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            setDate(d);
            setOpen(false);
          }}
          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
