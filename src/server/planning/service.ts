import type { Prisma, PrismaClient } from "../../../generated/prisma";
import { packDay } from "./day-packer";
import { generatePlan } from "./engine";
import { analyzeExecution, computeLearningUpdates } from "./feedback";
import { scoreProjects } from "./scoring";
import type {
  AdHocInput,
  CapacityConfig,
  FixedEventInput,
  LearningState,
  ProjectInput,
} from "./types";
import { DEFAULT_CAPACITY } from "./types";
import {
  addDays,
  formatMinutesAsTime,
  getDayOfWeek,
  getNowMinutesInTimezone,
  getRemainingWeekDates,
  getTodayInTimezone,
  getWeekStart,
  parseTimeToMinutes,
  roundUpMinutes,
} from "./week-utils";

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function parseCapacity(raw: {
  dailyCapacityHours: { toNumber(): number };
  workStartTime: string;
  blockMinutes: number;
  breakMinutes: number;
  lunchMinutes: number;
  lunchStartTime: string;
  maxProjectSharePct: number;
  maxContextSwitches: number;
  bufferMinutes: number;
  workDays: unknown;
  weekdayHours: unknown;
  timezone: string;
}): CapacityConfig {
  return {
    dailyCapacityHours: Number(raw.dailyCapacityHours),
    workStartTime: raw.workStartTime,
    blockMinutes: raw.blockMinutes,
    breakMinutes: raw.breakMinutes,
    lunchMinutes: raw.lunchMinutes,
    lunchStartTime: raw.lunchStartTime,
    maxProjectSharePct: raw.maxProjectSharePct,
    maxContextSwitches: raw.maxContextSwitches,
    bufferMinutes: raw.bufferMinutes,
    workDays: raw.workDays as number[],
    weekdayHours: raw.weekdayHours as Record<string, number>,
    timezone: raw.timezone,
  };
}

async function loadEngineInputs(db: PrismaClient, userId: string) {
  const [settings, projects, fixedEvents, adHoc, learning] = await Promise.all([
    db.capacitySettings.findUnique({ where: { userId } }),
    db.project.findMany({ where: { userId } }),
    db.fixedEvent.findMany({ where: { userId } }),
    db.adHocItem.findMany({ where: { userId } }),
    db.planningLearning.findMany({ where: { userId } }),
  ]);

  const capacity = settings ? parseCapacity(settings) : DEFAULT_CAPACITY;

  const projectInputs: ProjectInput[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    projectType: p.projectType as ProjectInput["projectType"],
    status: p.status,
    schedulingMode: p.schedulingMode as ProjectInput["schedulingMode"],
    effortSize: (p.effortSize ?? "medium") as ProjectInput["effortSize"],
    importanceLevel: p.importanceLevel ?? Math.ceil(p.importanceWeight / 2),
    importanceWeight: p.importanceWeight,
    urgencyLevel: (p.urgencyLevel ?? "medium") as ProjectInput["urgencyLevel"],
    urgencyOverride: p.urgencyOverride ?? false,
    focusDemand: (p.focusDemand ?? (p.requiresDeepFocus ? "high" : "medium")) as ProjectInput["focusDemand"],
    overImmersionRisk: (p.overImmersionRisk ?? "medium") as ProjectInput["overImmersionRisk"],
    flexibility: (p.flexibility ?? "flexible") as ProjectInput["flexibility"],
    deadline: p.deadline ? toDateStr(p.deadline) : null,
    estimatedHoursRemaining: p.estimatedHoursRemaining ? Number(p.estimatedHoursRemaining) : null,
    maxDailyHours: p.maxDailyHours ? Number(p.maxDailyHours) : null,
    requiresDeepFocus: p.requiresDeepFocus,
    preferredTimeOfDay:
      p.focusDemand === "high"
        ? "morning"
        : p.focusDemand === "low" || p.projectType === "maintenance"
          ? "afternoon"
          : "flexible",
  }));

  const fixedInputs: FixedEventInput[] = fixedEvents.map((e) => ({
    id: e.id,
    title: e.title,
    eventType: e.eventType,
    date: toDateStr(e.date),
    startTime: e.startTime,
    endTime: e.endTime,
    projectId: e.projectId,
  }));

  const adHocInputs: AdHocInput[] = adHoc.map((a) => ({
    id: a.id,
    title: a.title,
    urgencyBoost: Number(a.urgencyBoost),
    expiresAt: a.expiresAt ? toDateStr(a.expiresAt) : null,
    projectId: a.projectId,
  }));

  const learningInputs: LearningState[] = learning.map((l) => ({
    projectId: l.projectId,
    overfocusStreak: l.overfocusStreak,
    neglectDays: l.neglectDays,
    driftPenaltyMultiplier: Number(l.driftPenaltyMultiplier),
    avgActualShare: Number(l.avgActualShare),
    lastTouchedAt: l.lastTouchedAt ? toDateStr(l.lastTouchedAt) : null,
  }));

  return { capacity, projectInputs, fixedInputs, adHocInputs, learningInputs };
}

export async function ensureCapacitySettings(db: PrismaClient, userId: string) {
  return db.capacitySettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

function buildProjectReasons(
  projectInputs: ProjectInput[],
  learningInputs: LearningState[],
  fixedInputs: FixedEventInput[],
  adHocInputs: AdHocInput[],
  refDate: string
) {
  const active = projectInputs.filter((p) => p.status === "active");
  const scored = scoreProjects(active, learningInputs, fixedInputs, adHocInputs, refDate);
  return new Map(
    scored.map((s) => {
      if (s.urgency >= 0.7) return [s.project.id, "Urgent deadline"];
      if (s.historical >= 0.7) return [s.project.id, "Neglected — catch up"];
      if (s.project.focusDemand === "low") return [s.project.id, "Low focus slot"];
      if (s.project.overImmersionRisk === "high") return [s.project.id, "Capped — anti-drowning"];
      if (s.importance >= 0.7) return [s.project.id, "High real value"];
      return [s.project.id, "Balanced focus"];
    })
  );
}

function blockWorkHours(startTime: string, endTime: string): number {
  return (parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime)) / 60;
}

function isWorkBlock(blockType: string): boolean {
  return blockType !== "break" && blockType !== "lunch" && blockType !== "buffer";
}

export async function regeneratePlan(
  db: PrismaClient,
  userId: string,
  fromDate?: string,
  asOfMinutes?: number
) {
  await ensureCapacitySettings(db, userId);
  const { capacity, projectInputs, fixedInputs, adHocInputs, learningInputs } =
    await loadEngineInputs(db, userId);

  const refDate = getTodayInTimezone(capacity.timezone);
  const effectiveAsOf =
    asOfMinutes ?? roundUpMinutes(getNowMinutesInTimezone(capacity.timezone), 15);

  const result = generatePlan({
    projects: projectInputs,
    fixedEvents: fixedInputs,
    adHoc: adHocInputs,
    learning: learningInputs,
    settings: capacity,
    refDate,
    fromDate,
    asOfMinutes: effectiveAsOf,
  });

  if (!result) return null;

  const monthStart = new Date(result.monthStart);
  await db.monthlyPlan.upsert({
    where: { userId_monthStart: { userId, monthStart } },
    create: {
      userId,
      monthStart,
      projectBudgets: result.monthBudgets as unknown as Prisma.InputJsonValue,
      weekMilestones: result.weekMilestones as unknown as Prisma.InputJsonValue,
    },
    update: {
      projectBudgets: result.monthBudgets as unknown as Prisma.InputJsonValue,
      weekMilestones: result.weekMilestones as unknown as Prisma.InputJsonValue,
      generatedAt: new Date(),
    },
  });

  const weekStart = new Date(result.weekStart);
  const weeklyPlan = await db.weeklyPlan.upsert({
    where: { userId_weekStart: { userId, weekStart } },
    create: {
      userId,
      weekStart,
      totalCapacityHours: result.totalCapacityHours,
    },
    update: {
      totalCapacityHours: result.totalCapacityHours,
      generatedAt: new Date(),
    },
  });

  await db.weeklyAllocation.deleteMany({ where: { weeklyPlanId: weeklyPlan.id } });
  for (const a of result.weeklyAllocations) {
    await db.weeklyAllocation.create({
      data: {
        weeklyPlanId: weeklyPlan.id,
        projectId: a.projectId,
        plannedHours: a.plannedHours,
        priorityScore: a.priorityScore,
        driftPenalty: a.driftPenalty,
      },
    });
  }

  const replanFrom = fromDate ?? result.weekStart;
  for (const day of result.dailyPlans) {
    if (day.date < replanFrom) continue;

    const date = new Date(day.date);
    const dailyPlan = await db.dailyPlan.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        weeklyPlanId: weeklyPlan.id,
        date,
        totalCapacityHours: day.totalCapacityHours,
      },
      update: {
        weeklyPlanId: weeklyPlan.id,
        totalCapacityHours: day.totalCapacityHours,
        generatedAt: new Date(),
      },
    });

    await db.scheduleBlock.deleteMany({ where: { dailyPlanId: dailyPlan.id } });
    for (const b of day.blocks) {
      await db.scheduleBlock.create({
        data: {
          dailyPlanId: dailyPlan.id,
          startTime: b.startTime,
          endTime: b.endTime,
          blockType: b.blockType,
          projectId: b.projectId,
          fixedEventId: b.fixedEventId,
          isLocked: b.isLocked,
          sortOrder: b.sortOrder,
          reasonShort: b.reasonShort,
        },
      });
    }
  }

  return result;
}

async function repackTodayPlan(db: PrismaClient, userId: string) {
  const { capacity, projectInputs, fixedInputs, adHocInputs, learningInputs } =
    await loadEngineInputs(db, userId);

  const timezone = capacity.timezone;
  const today = getTodayInTimezone(timezone);
  const nowMinutes = roundUpMinutes(getNowMinutesInTimezone(timezone), 15);
  const weekStart = getWeekStart(new Date(`${today}T12:00:00`));

  const weekly = await db.weeklyPlan.findUnique({
    where: { userId_weekStart: { userId, weekStart: new Date(weekStart) } },
    include: {
      allocations: true,
      dailyPlans: { include: { blocks: true } },
    },
  });

  if (!weekly) {
    await regeneratePlan(db, userId, today, nowMinutes);
    return;
  }

  const remainingByProject = new Map<string, number>();
  for (const a of weekly.allocations) {
    remainingByProject.set(a.projectId, Number(a.plannedHours));
  }

  for (const d of getRemainingWeekDates(weekStart, weekStart)) {
    if (d >= today) break;
    const day = weekly.dailyPlans.find((dp) => toDateStr(dp.date) === d);
    if (!day) continue;
    for (const b of day.blocks) {
      if (!b.projectId || !isWorkBlock(b.blockType)) continue;
      const cur = remainingByProject.get(b.projectId) ?? 0;
      remainingByProject.set(b.projectId, Math.max(0, cur - blockWorkHours(b.startTime, b.endTime)));
    }
  }

  const todayPlan = weekly.dailyPlans.find((dp) => toDateStr(dp.date) === today);
  if (todayPlan) {
    for (const b of todayPlan.blocks) {
      if (!b.projectId || !isWorkBlock(b.blockType)) continue;
      if (parseTimeToMinutes(b.endTime) > nowMinutes) continue;
      const cur = remainingByProject.get(b.projectId) ?? 0;
      remainingByProject.set(b.projectId, Math.max(0, cur - blockWorkHours(b.startTime, b.endTime)));
    }
  }

  const active = projectInputs.filter((p) => p.status === "active");
  if (active.length === 0) return;

  const projectReasons = buildProjectReasons(
    projectInputs,
    learningInputs,
    fixedInputs,
    adHocInputs,
    today
  );

  const dow = getDayOfWeek(today);
  const dayCapacity = capacity.weekdayHours[String(dow)] ?? capacity.dailyCapacityHours;

  const { blocks } = packDay({
    date: today,
    dayCapacityHours: dayCapacity,
    remainingHours: new Map(remainingByProject),
    projects: active,
    fixedEvents: fixedInputs,
    settings: capacity,
    sortOrderStart: 0,
    projectReasons,
    effectiveStartMinutes: nowMinutes,
  });

  const dailyPlan = await db.dailyPlan.upsert({
    where: { userId_date: { userId, date: new Date(today) } },
    create: {
      userId,
      weeklyPlanId: weekly.id,
      date: new Date(today),
      totalCapacityHours: dayCapacity,
    },
    update: {
      weeklyPlanId: weekly.id,
      totalCapacityHours: dayCapacity,
      generatedAt: new Date(),
    },
  });

  await db.scheduleBlock.deleteMany({ where: { dailyPlanId: dailyPlan.id } });
  for (const b of blocks) {
    await db.scheduleBlock.create({
      data: {
        dailyPlanId: dailyPlan.id,
        startTime: b.startTime,
        endTime: b.endTime,
        blockType: b.blockType,
        projectId: b.projectId,
        fixedEventId: b.fixedEventId,
        isLocked: b.isLocked,
        sortOrder: b.sortOrder,
        reasonShort: b.reasonShort,
      },
    });
  }
}

export async function getTodayPlan(db: PrismaClient, userId: string) {
  await ensureCapacitySettings(db, userId);
  const settings = await db.capacitySettings.findUnique({ where: { userId } });
  const timezone = settings?.timezone ?? DEFAULT_CAPACITY.timezone;
  const today = getTodayInTimezone(timezone);
  const nowMinutes = getNowMinutesInTimezone(timezone);

  const closed = await db.executionReport.findUnique({
    where: { userId_date: { userId, date: new Date(today) } },
  });

  if (!closed) {
    await repackTodayPlan(db, userId);
  }

  const plan = await db.dailyPlan.findUnique({
    where: { userId_date: { userId, date: new Date(today) } },
    include: {
      blocks: {
        orderBy: { sortOrder: "asc" },
        include: { project: { select: { name: true } } },
      },
    },
  });

  if (!plan && !closed) {
    await regeneratePlan(db, userId, today, roundUpMinutes(nowMinutes, 15));
    const retry = await db.dailyPlan.findUnique({
      where: { userId_date: { userId, date: new Date(today) } },
      include: {
        blocks: {
          orderBy: { sortOrder: "asc" },
          include: { project: { select: { name: true } } },
        },
      },
    });
    return {
      plan: retry,
      today,
      isClosed: false,
      nowTime: formatMinutesAsTime(nowMinutes),
      nowMinutes,
      timezone,
    };
  }

  return {
    plan,
    today,
    isClosed: !!closed,
    nowTime: formatMinutesAsTime(nowMinutes),
    nowMinutes,
    timezone,
  };
}

export async function getWeekPlan(db: PrismaClient, userId: string) {
  const weekStart = getWeekStart();
  let weekly = await db.weeklyPlan.findUnique({
    where: { userId_weekStart: { userId, weekStart: new Date(weekStart) } },
    include: {
      allocations: { include: { project: { select: { name: true } } } },
      dailyPlans: {
        include: {
          blocks: { orderBy: { sortOrder: "asc" }, include: { project: { select: { name: true } } } },
        },
      },
    },
  });

  if (!weekly) {
    await regeneratePlan(db, userId);
    weekly = await db.weeklyPlan.findUnique({
      where: { userId_weekStart: { userId, weekStart: new Date(weekStart) } },
      include: {
        allocations: { include: { project: { select: { name: true } } } },
        dailyPlans: {
          include: {
            blocks: { orderBy: { sortOrder: "asc" }, include: { project: { select: { name: true } } } },
          },
        },
      },
    });
  }

  return { weekly, weekStart };
}

export async function getMonthPlan(db: PrismaClient, userId: string) {
  const settings = await db.capacitySettings.findUnique({ where: { userId } });
  const timezone = settings?.timezone ?? DEFAULT_CAPACITY.timezone;
  const monthStart = new Date(getTodayInTimezone(timezone).slice(0, 7) + "-01");
  let monthly = await db.monthlyPlan.findUnique({
    where: { userId_monthStart: { userId, monthStart } },
  });

  if (!monthly) {
    await regeneratePlan(db, userId);
    monthly = await db.monthlyPlan.findUnique({
      where: { userId_monthStart: { userId, monthStart } },
    });
  }

  return monthly;
}

export async function submitDailyCloseOut(
  db: PrismaClient,
  userId: string,
  input: {
    date: string;
    actuals: { projectId: string; actualHours: number; notes?: string }[];
    totalWastedHours: number;
  }
) {
  const date = new Date(input.date);
  const dailyPlan = await db.dailyPlan.findUnique({
    where: { userId_date: { userId, date } },
    include: { blocks: true },
  });

  const plannedMap = new Map<string, number>();
  if (dailyPlan) {
    for (const b of dailyPlan.blocks) {
      if (!b.projectId) continue;
      const [sh, sm] = b.startTime.split(":").map(Number);
      const [eh, em] = b.endTime.split(":").map(Number);
      const hours = ((eh! * 60 + em!) - (sh! * 60 + sm!)) / 60;
      plannedMap.set(b.projectId, (plannedMap.get(b.projectId) ?? 0) + hours);
    }
  }

  const actuals = input.actuals.map((a) => ({
    projectId: a.projectId,
    plannedHours: plannedMap.get(a.projectId) ?? 0,
    actualHours: a.actualHours,
    notes: a.notes ?? "",
  }));

  const settings = await db.capacitySettings.findUnique({ where: { userId } });
  const maxShare = settings?.maxProjectSharePct ?? 40;

  const feedback = analyzeExecution(
    actuals,
    input.totalWastedHours,
    maxShare
  );

  const projects = await db.project.findMany({
    where: { userId, status: "active" },
    select: { id: true },
  });
  const existingLearning = await db.planningLearning.findMany({ where: { userId } });
  const learningUpdates = computeLearningUpdates(
    actuals,
    existingLearning.map((l) => ({
      projectId: l.projectId,
      overfocusStreak: l.overfocusStreak,
      neglectDays: l.neglectDays,
      driftPenaltyMultiplier: Number(l.driftPenaltyMultiplier),
      avgActualShare: Number(l.avgActualShare),
      lastTouchedAt: l.lastTouchedAt ? toDateStr(l.lastTouchedAt) : null,
    })),
    input.date,
    projects.map((p) => p.id)
  );

  const report = await db.executionReport.upsert({
    where: { userId_date: { userId, date } },
    create: {
      userId,
      dailyPlanId: dailyPlan?.id,
      date,
      totalProductiveHours: feedback.totalProductive,
      totalWastedHours: input.totalWastedHours,
      efficiencyScore: feedback.efficiencyScore,
    },
    update: {
      totalProductiveHours: feedback.totalProductive,
      totalWastedHours: input.totalWastedHours,
      efficiencyScore: feedback.efficiencyScore,
      submittedAt: new Date(),
    },
  });

  await db.executionActual.deleteMany({ where: { reportId: report.id } });
  for (const a of actuals) {
    await db.executionActual.create({
      data: {
        reportId: report.id,
        projectId: a.projectId,
        plannedHours: a.plannedHours,
        actualHours: a.actualHours,
        notes: a.notes,
      },
    });
  }

  for (const l of learningUpdates) {
    await db.planningLearning.upsert({
      where: { projectId: l.projectId },
      create: {
        userId,
        projectId: l.projectId,
        overfocusStreak: l.overfocusStreak,
        neglectDays: l.neglectDays,
        driftPenaltyMultiplier: l.driftPenaltyMultiplier,
        avgActualShare: l.avgActualShare,
        lastTouchedAt: l.lastTouchedAt ? new Date(l.lastTouchedAt) : null,
      },
      update: {
        overfocusStreak: l.overfocusStreak,
        neglectDays: l.neglectDays,
        driftPenaltyMultiplier: l.driftPenaltyMultiplier,
        avgActualShare: l.avgActualShare,
        lastTouchedAt: l.lastTouchedAt ? new Date(l.lastTouchedAt) : null,
      },
    });
  }

  const tomorrow = addDays(input.date, 1);
  await regeneratePlan(db, userId, tomorrow);

  return { report, feedback, learningUpdates };
}
