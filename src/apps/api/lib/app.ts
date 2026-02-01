/**
 * Core Hono application for the API.
 *
 * This module contains the pure API routing logic that can be used across
 * different deployment environments (local development, Cloudflare Workers, etc.).
 * The app expects database and auth to be initialized upstream via middleware.
 *
 */

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";
import { pathReportRouter } from "../routers/path-report.js";
import { pathRouter } from "../routers/path.js";
import { routingRouter } from "../routers/routing.js";
import { streetRouter } from "../routers/street.js";
import { tripRouter } from "../routers/trip.js";
import { userRouter } from "../routers/user.js";
import type { AppContext } from "./context.js";
import { router } from "./trpc.js";

// tRPC API router
const appRouter = router({
  user: userRouter,
  trips: tripRouter,
  path: pathRouter,
  pathReport: pathReportRouter,
  street: streetRouter,
  routing: routingRouter,
});

// Log loaded routes for debugging
console.log("🚀 tRPC routes loaded:", Object.keys(appRouter._def.procedures));

// HTTP router
const app = new Hono<AppContext>();

app.get("/", (c) => c.redirect("/api"));

// Root endpoint with API information
app.get("/api", (c) => {
  return c.json({
    name: "@repo/api",
    version: "0.0.0",
    endpoints: {
      trpc: "/api/trpc",
      auth: "/api/auth",
      health: "/health",
    },
    documentation: {
      trpc: "https://trpc.io",
      auth: "https://www.better-auth.com",
    },
  });
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// OSRM proxy route - proxies routing requests to Open Source Routing Machine
app.get("/api/osrm/route/:profile/:coordinates", async (c) => {
  const profile = c.req.param("profile");
  const coordinates = c.req.param("coordinates");

  // Validate profile (bike, car, foot)
  if (!["bike", "car", "foot"].includes(profile)) {
    c.status(400);
    return c.json({ error: "Invalid routing profile" });
  }

  // Validate coordinates format (lon1,lat1;lon2,lat2)
  const coordPattern = /^-?\d+\.?\d*,-?\d+\.?\d*;-?\d+\.?\d*,-?\d+\.?\d*$/;
  if (!coordPattern.test(coordinates)) {
    c.status(400);
    return c.json({ error: "Invalid coordinates format" });
  }

  try {
    const url = new URL(
      `https://router.project-osrm.org/route/v1/${profile}/${coordinates}`,
    );

    // Pass through query parameters
    const searchParams = c.req.query();
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string") {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      c.status(response.status as any);
      return c.json({
        error: `OSRM error: ${response.status}`,
        details: errorText.substring(0, 300),
      });
    }

    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error("[OSRM Proxy] Error:", error);
    c.status(500);
    return c.json({
      error: "Failed to fetch route from OSRM",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Authentication routes
app.on(["GET", "POST"], "/api/auth/*", (c) => {
  const auth = c.get("auth");
  if (!auth) {
    return c.json({ error: "Authentication service not initialized" }, 503);
  }
  return auth.handler(c.req.raw);
});

// tRPC API routes
app.use("/api/trpc/*", (c) => {
  return fetchRequestHandler({
    req: c.req.raw,
    router: appRouter,
    endpoint: "/api/trpc",
    async createContext({ req, resHeaders, info }) {
      const db = c.get("db");
      const dbDirect = c.get("dbDirect");
      const auth = c.get("auth");

      if (!db) {
        throw new Error("Database not available in context");
      }

      if (!dbDirect) {
        throw new Error("Direct database not available in context");
      }

      if (!auth) {
        throw new Error("Authentication service not available in context");
      }

      const sessionData = await auth.api.getSession({
        headers: req.headers,
      });

      return {
        req,
        res: c.res,
        resHeaders,
        info,
        env: c.env,
        db,
        dbDirect,
        session: sessionData?.session ?? null,
        user: sessionData?.user ?? null,
        cache: new Map(),
      };
    },
    batching: {
      enabled: true,
    },
    onError({ error, path }) {
      console.error("tRPC error on path", path, ":", error);
    },
  });
});

export { appRouter };
export type AppRouter = typeof appRouter;
export default app;
