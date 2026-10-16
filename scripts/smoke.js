const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");

const { sql } = require("drizzle-orm");
const { pgTable, serial, integer, varchar, text, timestamp, date, uuid, pgEnum } = require("drizzle-orm/pg-core");

const projectTypeEnum = pgEnum("project_type", [
  "Deck Redesign",
  "Document Branding",
  "Video Creation",
  "Website Work",
  "Other",
]);

const priorityEnum = pgEnum("priority", ["Low", "Medium", "High", "Urgent"]);
const statusEnum = pgEnum("status", [
  "Submitted",
  "In Review",
  "Planned",
  "In Progress",
  "Completed",
  "Rejected",
]);

const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  publicReference: varchar("public_reference", { length: 32 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
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

const attachments = pgTable("attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => requests.id, { onDelete: "cascade" }),
  originalFilename: varchar("original_filename", { length: 500 }).notNull(),
  storedPath: varchar("stored_path", { length: 1000 }).notNull(),
  mimeType: varchar("mime_type", { length: 255 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
});

const activityLog = pgTable("activity_log", {
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

const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const schema = { requests, attachments, activityLog, adminUsers };

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? "5432"),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: process.env.DATABASE_SSL === "true" ? true : false,
});

const db = drizzle(pool, { schema });

async function main() {
  const year = new Date().getFullYear();
  const suffix = `${Date.now()}`.slice(-4);
  const [request] = await db
    .insert(schema.requests)
    .values({
      publicReference: `NS-${year}-${suffix}`,
      fullName: "Test User",
      email: "test@example.com",
      projectType: "Website Work",
      projectTitle: "Smoke test request",
      description: "Round-trip Drizzle query verification.",
      priority: "Medium",
      status: "Submitted",
    })
    .returning();

  console.log("Inserted request:", request.id, request.publicReference);

  const [attachment] = await db
    .insert(schema.attachments)
    .values({
      requestId: request.id,
      originalFilename: "smoke.txt",
      storedPath: "/uploads/smoke.txt",
      mimeType: "text/plain",
      sizeBytes: 12,
    })
    .returning();

  console.log("Inserted attachment:", attachment.id);

  await db.insert(schema.activityLog).values({
    requestId: request.id,
    actorEmail: "admin@nstarxinc.com",
    field: "status",
    oldValue: null,
    newValue: "Submitted",
  });

  const roundTrip = await db.query.requests.findFirst({
    where: (r, { eq }) => eq(r.id, request.id),
  });

  const attachmentsRows = await db
    .select()
    .from(schema.attachments)
    .where(sql`${schema.attachments.requestId} = ${request.id}`);

  const activityRows = await db
    .select()
    .from(schema.activityLog)
    .where(sql`${schema.activityLog.requestId} = ${request.id}`);

  console.log("Round-trip request:", JSON.stringify(roundTrip, null, 2));
  console.log("Round-trip attachments:", JSON.stringify(attachmentsRows, null, 2));
  console.log("Round-trip activity:", JSON.stringify(activityRows, null, 2));

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
