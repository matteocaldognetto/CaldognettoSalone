import type { AppRouter } from "@repo/api";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";

// Build links array conditionally based on environment
const links = [];

// Add logger link in development for debugging
if (import.meta.env.DEV) {
  links.push(
    loggerLink({
      enabled: (opts) =>
        (process.env.NODE_ENV === "development" &&
          typeof window !== "undefined") ||
        (opts.direction === "down" && opts.result instanceof Error),
    }),
  );
}

// Add HTTP batch link for actual requests
links.push(
  httpBatchLink({
    url: `${import.meta.env.VITE_API_URL || "/api"}/trpc`,
    transformer: superjson,
    // Custom headers for request tracking
    headers() {
      return {
        "x-trpc-source": "react-app",
      };
    },
    // Include credentials for authentication
    fetch(url, options) {
      return fetch(url, {
        ...options,
        credentials: "include",
      });
    },
  }),
);

export const queryClient = new QueryClient();

export const trpcClient: ReturnType<typeof createTRPCClient<AppRouter>> = createTRPCClient<AppRouter>({
  links,
});

export const api: ReturnType<typeof createTRPCOptionsProxy<AppRouter>> = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
