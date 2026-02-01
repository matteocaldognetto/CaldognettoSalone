import { eq, schema } from "@repo/db";
import { z } from "zod";
import { protectedProcedure, router } from "../lib/trpc.js";

const { user } = schema;

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return {
      id: ctx.user!.id,
      email: ctx.user!.email,
      name: ctx.user!.name,
    };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [updatedUser] = await ctx.db
        .update(user)
        .set({
          name: input.name,
        })
        .where(eq(user.id, ctx.user!.id))
        .returning();

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
      };
    }),
});
