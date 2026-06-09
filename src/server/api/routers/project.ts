import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { dbProjectToDraft } from "~/server/api/routers/project-mappers";
import {
  analyzeProjectIntelligence,
  applyIntelligenceToProject,
} from "~/server/planning/project-intelligence";
import { getProjectIntelligenceCards, regeneratePlan } from "~/server/planning/service";
import { getWeekStart } from "~/server/planning/week-utils";

export const projectDraftSchema = z.object({
  name: z.string().min(1),
  projectType: z.enum(["client", "personal", "maintenance", "learning", "emergency"]).default("personal"),
  effortSize: z.enum(["small", "medium", "large"]).default("medium"),
  importanceLevel: z.number().min(1).max(5).default(3),
  urgencyLevel: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  urgencyOverride: z.boolean().default(false),
  focusDemand: z.enum(["low", "medium", "high"]).default("medium"),
  overImmersionRisk: z.enum(["low", "medium", "high"]).default("medium"),
  flexibility: z.enum(["fixed", "flexible"]).default("flexible"),
  deadline: z.string().nullable().optional(),
  estimatedHoursRemaining: z.number().nullable().optional(),
  notes: z.string().default(""),
});

function draftFromInput(input: z.infer<typeof projectDraftSchema>) {
  return {
    name: input.name,
    projectType: input.projectType,
    effortSize: input.effortSize,
    importanceLevel: input.importanceLevel,
    urgencyLevel: input.urgencyLevel,
    urgencyOverride: input.urgencyOverride,
    focusDemand: input.focusDemand,
    overImmersionRisk: input.overImmersionRisk,
    flexibility: input.flexibility,
    deadline: input.deadline ?? null,
    estimatedHoursRemaining: input.estimatedHoursRemaining ?? null,
  };
}

export const projectRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.project.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { updatedAt: "desc" },
    });
  }),

  intelligenceCards: protectedProcedure.query(async ({ ctx }) => {
    return getProjectIntelligenceCards(ctx.db, ctx.session.user.id);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.project.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
        include: {
          fixedEvents: { orderBy: [{ date: "asc" }, { startTime: "asc" }] },
          adHocItems: { orderBy: { createdAt: "desc" } },
          planningLearning: true,
        },
      });

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      const weekStart = new Date(getWeekStart());
      const weeklyAllocation = await ctx.db.weeklyAllocation.findFirst({
        where: {
          projectId: project.id,
          weeklyPlan: { userId: ctx.session.user.id, weekStart },
        },
        select: { plannedHours: true, priorityScore: true, driftPenalty: true },
      });

      const draft = dbProjectToDraft(project);
      const intelligence = analyzeProjectIntelligence(draft);

      return {
        project,
        intelligence,
        weeklyAllocation: weeklyAllocation
          ? {
              plannedHours: Number(weeklyAllocation.plannedHours),
              priorityScore: Number(weeklyAllocation.priorityScore),
              driftPenalty: Number(weeklyAllocation.driftPenalty),
            }
          : null,
      };
    }),

  previewIntelligence: protectedProcedure.input(projectDraftSchema).query(async ({ input }) => {
    return analyzeProjectIntelligence(draftFromInput(input));
  }),

  create: protectedProcedure.input(projectDraftSchema).mutation(async ({ ctx, input }) => {
    const draft = draftFromInput(input);
    const intelligence = analyzeProjectIntelligence(draft);
    const derived = applyIntelligenceToProject(draft, intelligence);

    const project = await ctx.db.project.create({
      data: {
        userId: ctx.session.user.id,
        name: input.name,
        notes: input.notes,
        deadline: input.deadline ? new Date(input.deadline) : null,
        ...derived,
      },
    });
    await regeneratePlan(ctx.db, ctx.session.user.id);
    return { project, intelligence };
  }),

  update: protectedProcedure
    .input(
      z
        .object({
          id: z.string().min(1),
          status: z.enum(["active", "paused", "done"]).optional(),
        })
        .merge(projectDraftSchema.partial())
    )
    .mutation(async ({ ctx, input }) => {
      const { id, deadline, status, ...rest } = input;
      const existing = await ctx.db.project.findFirst({
        where: { id, userId: ctx.session.user.id },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      const draft = {
        name: rest.name ?? existing.name,
        projectType: (rest.projectType ?? existing.projectType) as z.infer<
          typeof projectDraftSchema
        >["projectType"],
        effortSize: (rest.effortSize ?? existing.effortSize) as z.infer<
          typeof projectDraftSchema
        >["effortSize"],
        importanceLevel: rest.importanceLevel ?? existing.importanceLevel,
        urgencyLevel: (rest.urgencyLevel ?? existing.urgencyLevel) as z.infer<
          typeof projectDraftSchema
        >["urgencyLevel"],
        urgencyOverride: rest.urgencyOverride ?? existing.urgencyOverride,
        focusDemand: (rest.focusDemand ?? existing.focusDemand) as z.infer<
          typeof projectDraftSchema
        >["focusDemand"],
        overImmersionRisk: (rest.overImmersionRisk ?? existing.overImmersionRisk) as z.infer<
          typeof projectDraftSchema
        >["overImmersionRisk"],
        flexibility: (rest.flexibility ?? existing.flexibility) as z.infer<
          typeof projectDraftSchema
        >["flexibility"],
        deadline:
          deadline !== undefined
            ? deadline
            : existing.deadline
              ? existing.deadline.toISOString().split("T")[0]!
              : null,
        estimatedHoursRemaining:
          rest.estimatedHoursRemaining !== undefined
            ? rest.estimatedHoursRemaining
            : existing.estimatedHoursRemaining
              ? Number(existing.estimatedHoursRemaining)
              : null,
      };

      const intelligence = analyzeProjectIntelligence(draft);
      const derived = applyIntelligenceToProject(draft, intelligence);

      const project = await ctx.db.project.update({
        where: { id },
        data: {
          ...(rest.name !== undefined ? { name: rest.name } : {}),
          ...(rest.notes !== undefined ? { notes: rest.notes } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
          ...derived,
        },
      });
      await regeneratePlan(ctx.db, ctx.session.user.id);
      return { project, intelligence };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.project.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
        select: { id: true },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      await ctx.db.project.delete({ where: { id: input.id } });
      await regeneratePlan(ctx.db, ctx.session.user.id);
      return { ok: true };
    }),
});
