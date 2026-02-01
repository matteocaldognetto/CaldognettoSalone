import { Button } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import {
  Bike,
  LogOut,
  Navigation,
  Route as RouteIcon,
  User,
} from "lucide-react";
import type { ReactNode } from "react";
import { signOut, useSessionQuery } from "../lib/queries/session";

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session } = useSessionQuery();
  const isAuthenticated = session?.user != null;

  const handleSignOut = async () => {
    await signOut(queryClient, { redirect: false });
    router.navigate({ to: "/routes" });
  };

  const navItems = isAuthenticated
    ? [
        { to: "/routes", label: "Find Route", icon: Navigation },
        { to: "/trips", label: "My Paths", icon: RouteIcon },
        { to: "/report", label: "Report Path", icon: Bike },
      ]
    : [
        { to: "/routes", label: "Find Route", icon: Navigation },
      ];

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="flex h-16 items-center px-6 gap-6">
          {/* Logo */}
          <Link
            to="/routes"
            className="flex items-center gap-2 font-bold text-lg"
          >
            <Bike className="h-6 w-6" />
            Best Bike Paths
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <Link key={item.to} to={item.to}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link to="/settings">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    {session.user.name || session.user.email}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  search={{ redirect: "/routes", mode: "signin" }}
                >
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link
                  to="/login"
                  search={{ redirect: "/routes", mode: "signup" }}
                >
                  <Button size="sm">Sign Up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}
