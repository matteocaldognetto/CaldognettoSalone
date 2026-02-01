import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { RouteFinder } from "../../components/routes/route-finder";

// Define search schema for URL params
const routesSearchSchema = z.object({
  startStreet: z.string().optional(),
  endStreet: z.string().optional(),
}).strict();

export const Route = createFileRoute("/(app)/routes")({
  validateSearch: (search: Record<string, unknown>) => routesSearchSchema.parse(search),
  component: RoutesPage,
});

function RoutesPage() {
  return (
    <div className="h-full w-full">
      <RouteFinder />
    </div>
  );
}
