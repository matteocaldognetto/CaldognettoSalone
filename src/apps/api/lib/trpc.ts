import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { flattenError, ZodError } from "zod";
import type { TRPCContext } from "./context.js";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? flattenError(error.cause) : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authentication
 * Throws UNAUTHORIZED error if user is not authenticated
 * Use non-null assertion on ctx.user within procedures
 */
export const protectedProcedure: typeof t.procedure = t.procedure.use(
  ({ ctx, next }) => {
    if (!ctx.session || !ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        session: ctx.session,
      },
    });
  },
);
