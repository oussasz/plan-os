import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { regeneratePlan } from "~/server/planning/service";

export const fixedEventRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.fixedEvent.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: { project: { select: { name: true } } },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        eventType: z.enum(["meeting", "appointment", "obligation"]),
        date: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        projectId: z.string().optional(),
        notes: z.string().default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.fixedEvent.create({
        data: {
          userId: ctx.session.user.id,
          title: input.title,
          eventType: input.eventType,
          date: new Date(input.date),
          startTime: input.startTime,
          endTime: input.endTime,
          projectId: input.projectId,
          notes: input.notes,
        },
      });
      await regeneratePlan(ctx.db, ctx.session.user.id);
      return event;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.fixedEvent.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
        select: { id: true },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Fixed event not found" });
      }

      await ctx.db.fixedEvent.delete({ where: { id: input.id } });
      await regeneratePlan(ctx.db, ctx.session.user.id);
      return { ok: true };
    }),
});
