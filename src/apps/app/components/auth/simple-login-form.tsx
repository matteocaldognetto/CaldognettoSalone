import { auth } from "@/lib/auth";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@repo/ui";
import { Bike } from "lucide-react";
import { useState } from "react";

interface SimpleLoginFormProps {
  onSuccess?: () => void;
  initialMode?: "signin" | "signup";
}

export function SimpleLoginForm({
  onSuccess,
  initialMode = "signin",
}: SimpleLoginFormProps) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        // Sign up
        const result = await auth.signUp.email({
          email,
          password,
          name,
        });

        if (result.error) {
          setError(result.error.message || "Failed to sign up");
          setIsLoading(false);
          return;
        }
      } else {
        // Sign in
        const result = await auth.signIn.email({
          email,
          password,
        });

        if (result.error) {
          setError(result.error.message || "Failed to sign in");
          setIsLoading(false);
          return;
        }
      }

      // Success
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground">
            <Bike className="h-6 w-6" />
          </div>
        </div>
        <CardTitle>
          {mode === "signup" ? "Create Account" : "Welcome Back"}
        </CardTitle>
        <CardDescription>
          {mode === "signup"
            ? "Sign up to start recording trips and reporting path conditions"
            : "Sign in to your Best Bike Paths account"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                disabled={isLoading}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              disabled={isLoading}
            />
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? "Please wait..."
              : mode === "signup"
                ? "Sign Up"
                : "Sign In"}
          </Button>

          <div className="text-center text-sm">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  className="text-primary hover:underline"
                  disabled={isLoading}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                  className="text-primary hover:underline"
                  disabled={isLoading}
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
