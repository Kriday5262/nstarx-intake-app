import {
  pgEnum,
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  date,
  uuid,
} from "drizzle-orm/pg-core";

export const projectTypeEnum = pgEnum("project_type", [
  "Deck Redesign",
  "Document Branding",
  "Video Creation",
  "Website Work",
  "Other",
]);

export const priorityEnum = pgEnum("priority", [
  "Low",
  "Medium",
  "High",
  "Urgent",
]);

export const statusEnum = pgEnum("status", [
  "Submitted",
  "In Review",
  "Planned",
  "In Progress",
  "Completed",
  "Rejected",
]);

export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  publicReference: varchar("public_reference", { length: 32 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  department: varchar("department", { length: 255 }).notNull(),
  projectType: projectTypeEnum("project_type").notNull(),
  projectTitle: varchar("project_title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  desiredDeadline: date("desired_deadline"),
  priority: priorityEnum("priority").default("Medium").notNull(),
  status: statusEnum("status").default("Submitted").notNull(),
  dueDate: date("due_date"),
  internalNotes: text("internal_notes"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const attachments = pgTable("attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => requests.id, { onDelete: "cascade" }),
  originalFilename: varchar("original_filename", { length: 500 }).notNull(),
  storedPath: varchar("stored_path", { length: 1000 }).notNull(),
  mimeType: varchar("mime_type", { length: 255 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
});

export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => requests.id, { onDelete: "cascade" }),
  actorEmail: varchar("actor_email", { length: 255 }).notNull(),
  field: varchar("field", { length: 255 }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id")
    .notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  tokenSignature: varchar("token_signature", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
