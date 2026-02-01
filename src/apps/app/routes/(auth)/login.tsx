import { SimpleLoginForm } from "@/components/auth/simple-login-form";
import { getSafeRedirectUrl } from "@/lib/auth-config";
import { invalidateSession, sessionQueryOptions } from "@/lib/queries/session";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/login")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.fetchQuery(sessionQueryOptions());
    if (session?.user && session?.session) {
      throw redirect({ to: "/routes" });
    }
  },
  component: LoginPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect: string; mode?: string } => {
    return {
      redirect: getSafeRedirectUrl(search.redirect),
      mode: typeof search.mode === "string" ? search.mode : undefined,
    };
  },
});

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { redirect, mode } = Route.useSearch();

  async function handleSuccess() {
    await invalidateSession(queryClient);
    navigate({ to: redirect }).catch(() => {
      window.location.href = redirect;
    });
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <SimpleLoginForm
          onSuccess={handleSuccess}
          initialMode={mode === "signin" || mode === "signup" ? mode : "signin"}
        />
      </div>
    </div>
  );
}
