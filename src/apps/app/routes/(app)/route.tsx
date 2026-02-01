import { Layout } from "@/components/layout";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)")({
  // No authentication required - paths page is public
  // Individual routes will check auth as needed
  component: AppLayout,
});

function AppLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
