import { db, pool } from "./lib/db.ts";
import { requests } from "./lib/schema.ts";
import { desc } from "drizzle-orm";

const rows = await db.query.requests.findMany({
  orderBy: [desc(requests.submittedAt)],
  limit: 40,
});

console.table(rows.map((r) => ({
  id: r.id,
  title: r.projectTitle,
  status: r.status,
  priority: r.priority,
  department: r.department,
  type: r.projectType,
})));

await pool.end();
