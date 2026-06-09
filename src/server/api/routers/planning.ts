import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  getMonthPlan,
  getTodayPlan,
  getWeekPlan,
  regeneratePlan,
} from "~/server/planning/service";

export const planningRouter = createTRPCRouter({
  getToday: protectedProcedure.query(async ({ ctx }) => {
    return getTodayPlan(ctx.db, ctx.session.user.id);
  }),

  getWeek: protectedProcedure.query(async ({ ctx }) => {
    return getWeekPlan(ctx.db, ctx.session.user.id);
  }),

  getMonth: protectedProcedure.query(async ({ ctx }) => {
    return getMonthPlan(ctx.db, ctx.session.user.id);
  }),

  regenerate: protectedProcedure
    .input(z.object({ fromDate: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      return regeneratePlan(ctx.db, ctx.session.user.id, input?.fromDate);
    }),
});
