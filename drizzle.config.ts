import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    host: process.env.DATABASE_HOST ?? "localhost",
    port: Number(process.env.DATABASE_PORT ?? "5432"),
    database: process.env.DATABASE_NAME ?? "nstarx_intake",
    user: process.env.DATABASE_USER ?? "nstarx_app",
    password: process.env.DATABASE_PASSWORD ?? "change_me",
  },
});
