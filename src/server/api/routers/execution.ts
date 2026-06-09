import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { submitDailyCloseOut } from "~/server/planning/service";

export const executionRouter = createTRPCRouter({
  submitDaily: protectedProcedure
    .input(
      z.object({
        date: z.string(),
        actuals: z.array(
          z.object({
            projectId: z.string(),
            actualHours: z.number().min(0),
            notes: z.string().optional(),
          })
        ),
        totalWastedHours: z.number().min(0).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return submitDailyCloseOut(ctx.db, ctx.session.user.id, input);
    }),
});
