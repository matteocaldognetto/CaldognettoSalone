import { schema as Db } from "@repo/db";
import { betterAuth } from "better-auth";
import type { DB } from "better-auth/adapters/drizzle";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Env } from "./env";

/**
 * Environment variables required for authentication configuration.
 */
type AuthEnv = Pick<Env, "APP_ORIGIN" | "BETTER_AUTH_SECRET">;

/**
 * Creates a Better Auth instance configured for simple email/password authentication.
 *
 * Key behaviors:
 * - Email and password authentication only (no OAuth, no passkeys)
 * - No email verification required (demo/prototype mode)
 * - Sessions stored in database with automatic expiration
 * - Custom ID generation disabled (uses UUIDv7 from schema)
 *
 * @param db Drizzle database instance - must include user, session, identity, verification tables
 * @param env Environment variables containing auth secret
 * @returns Configured Better Auth instance
 *
 * @example
 * ```ts
 * const auth = createAuth(database, {
 *   BETTER_AUTH_SECRET: "your-secret-key",
 *   APP_ORIGIN: "http://localhost:5173"
 * });
 * ```
 */
export function createAuth(
  db: DB,
  env: AuthEnv,
): ReturnType<typeof betterAuth> {
  return betterAuth({
    baseURL: `${env.APP_ORIGIN}/api/auth`,
    trustedOrigins: [env.APP_ORIGIN],
    secret: env.BETTER_AUTH_SECRET,

    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        identity: Db.identity,
        session: Db.session,
        user: Db.user,
        verification: Db.verification,
      },
    }),

    account: {
      modelName: "identity",
    },

    // Email and password authentication (no verification required)
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      // No sendResetPassword - users must contact support for password reset
    },

    // No email verification for demo
    emailVerification: {
      sendVerificationEmail: undefined,
      autoSignInAfterVerification: false,
    },

    // No social providers
    socialProviders: {},

    // No plugins (no anonymous, no organization, no passkey, no OTP)
    plugins: [],

    advanced: {
      database: {
        generateId: false, // Use UUIDv7 from schema
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
