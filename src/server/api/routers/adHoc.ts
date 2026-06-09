import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { regeneratePlan } from "~/server/planning/service";

export const adHocRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.adHocItem.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        urgencyBoost: z.number().min(0).max(1).default(0.5),
        expiresAt: z.string().optional(),
        projectId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.adHocItem.create({
        data: {
          userId: ctx.session.user.id,
          title: input.title,
          urgencyBoost: input.urgencyBoost,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          projectId: input.projectId,
        },
      });
      await regeneratePlan(ctx.db, ctx.session.user.id);
      return item;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.adHocItem.delete({
        where: { id: input.id, userId: ctx.session.user.id },
      });
      await regeneratePlan(ctx.db, ctx.session.user.id);
      return { ok: true };
    }),
});
