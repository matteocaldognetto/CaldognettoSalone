/**
 * Local development server that emulates Cloudflare Workers runtime with Neon database.
 *
 * WARNING: This file uses getPlatformProxy which requires wrangler.jsonc configuration.
 * Hyperdrive bindings must be configured for both HYPERDRIVE_CACHED and HYPERDRIVE_DIRECT.
 *
 * @example
 * ```bash
 * bun --filter @repo/api dev
 * bun --filter @repo/api dev --env=staging  # Use staging environment config
 * ```
 *
 */

import { drizzle, migrate, schema } from "@repo/db";
import { Hono } from "hono";
import postgres from "postgres";
import api from "./index.js";
import { createAuth } from "./lib/auth.js";
import type { AppContext } from "./lib/context.js";

// [INITIALIZATION]
const app = new Hono<AppContext>();

// Create database connection for local development
// Uses direct PostgreSQL connection (no Hyperdrive in local dev)
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

const db = drizzle(client, { schema });

await migrate(db, { migrationsFolder: "../../db/migrations" });

// [CONTEXT INJECTION]
// Injects database and auth into request context
app.use("*", async (c, next) => {
  // Priority: Cloudflare bindings > process.env > empty string
  // Required for local dev where secrets aren't in wrangler.jsonc
  const secretKeys = [
    "BETTER_AUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "OPENAI_API_KEY",
    "RESEND_API_KEY",
    "RESEND_EMAIL_FROM",
  ] as const;

  const env = {
    ...Object.fromEntries(
      secretKeys.map((key) => [key, process.env[key] ?? ""]),
    ),
    APP_NAME: process.env.APP_NAME || "Best Bike Paths",
    APP_ORIGIN:
      // Prefer origin set by `apps/app` at runtime
      c.req.header("x-forwarded-origin") ||
      process.env.APP_ORIGIN ||
      c.env.APP_ORIGIN ||
      "http://localhost:5173",
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "",
  };

  c.set("db", db);
  c.set("dbDirect", db); // Use same connection for both in local dev
  c.set("auth", createAuth(db, env));
  await next();
});

// Routes from ./index.js mounted at root
app.route("/", api);

export default app;
