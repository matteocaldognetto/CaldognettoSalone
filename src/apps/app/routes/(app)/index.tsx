import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/")({
  // Redirect to routes page - this is the main landing page (route finder)
  beforeLoad: () => {
    throw redirect({ to: "/routes" });
  },
});
