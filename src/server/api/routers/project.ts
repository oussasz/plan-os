import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { regeneratePlan } from "~/server/planning/service";

export const projectRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.project.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { updatedAt: "desc" },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        projectType: z.string().default("personal"),
        schedulingMode: z.enum(["batch", "spread", "flexible"]).default("flexible"),
        importanceWeight: z.number().min(1).max(10).default(5),
        deadline: z.string().optional(),
        estimatedHoursRemaining: z.number().optional(),
        maxDailyHours: z.number().optional(),
        requiresDeepFocus: z.boolean().default(true),
        notes: z.string().default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.project.create({
        data: {
          userId: ctx.session.user.id,
          name: input.name,
          projectType: input.projectType,
          schedulingMode: input.schedulingMode,
          importanceWeight: input.importanceWeight,
          deadline: input.deadline ? new Date(input.deadline) : null,
          estimatedHoursRemaining: input.estimatedHoursRemaining,
          maxDailyHours: input.maxDailyHours,
          requiresDeepFocus: input.requiresDeepFocus,
          notes: input.notes,
        },
      });
      await regeneratePlan(ctx.db, ctx.session.user.id);
      return project;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        status: z.enum(["active", "paused", "done"]).optional(),
        schedulingMode: z.enum(["batch", "spread", "flexible"]).optional(),
        importanceWeight: z.number().min(1).max(10).optional(),
        deadline: z.string().nullable().optional(),
        estimatedHoursRemaining: z.number().nullable().optional(),
        maxDailyHours: z.number().nullable().optional(),
        requiresDeepFocus: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, deadline, ...rest } = input;
      const project = await ctx.db.project.update({
        where: { id, userId: ctx.session.user.id },
        data: {
          ...rest,
          ...(deadline !== undefined
            ? { deadline: deadline ? new Date(deadline) : null }
            : {}),
        },
      });
      await regeneratePlan(ctx.db, ctx.session.user.id);
      return project;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.project.delete({
        where: { id: input.id, userId: ctx.session.user.id },
      });
      await regeneratePlan(ctx.db, ctx.session.user.id);
      return { ok: true };
    }),
});
