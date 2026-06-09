import { distributeWeeklyHours, scoreProjects } from "./scoring";
import { packDay } from "./day-packer";
import type {
  AdHocInput,
  CapacityConfig,
  EngineResult,
  FixedEventInput,
  LearningState,
  MonthlyBudget,
  ProjectInput,
  WeekMilestone,
} from "./types";
import {
  addDays,
  getDayOfWeek,
  getMonthStart,
  getRemainingWeekDates,
  getWeekDates,
  getWeekStart,
} from "./week-utils";

export interface EngineContext {
  projects: ProjectInput[];
  fixedEvents: FixedEventInput[];
  adHoc: AdHocInput[];
  learning: LearningState[];
  settings: CapacityConfig;
  refDate: string;
  fromDate?: string;
  /** Local minutes-from-midnight; applied when packing refDate so today starts at now. */
  asOfMinutes?: number;
}

export function generatePlan(context: EngineContext): EngineResult | null {
  const { projects, fixedEvents, adHoc, learning, settings, refDate, fromDate, asOfMinutes } = context;
  const active = projects.filter((p) => p.status === "active");
  if (active.length === 0) return null;

  const weekStart = getWeekStart(new Date(refDate));
  const monthStart = getMonthStart(new Date(refDate));
  const replanFrom = fromDate ?? weekStart;

  const planDates = getRemainingWeekDates(weekStart, replanFrom).filter((d) => {
    const dow = getDayOfWeek(d);
    return settings.workDays.includes(dow) && (settings.weekdayHours[String(dow)] ?? 0) > 0;
  });

  const totalCapacity = planDates.reduce(
    (sum, d) => sum + (settings.weekdayHours[String(getDayOfWeek(d))] ?? settings.dailyCapacityHours),
    0
  );

  const scored = scoreProjects(active, learning, fixedEvents, adHoc, refDate, settings);
  const weeklyAllocations = distributeWeeklyHours(scored, totalCapacity, settings);

  const monthWeeks = 4;
  const monthCapacity = totalCapacity * (30 / 7);
  const monthBudgets: MonthlyBudget[] = weeklyAllocations.map((a) => {
    const project = active.find((p) => p.id === a.projectId)!;
    return {
      projectId: a.projectId,
      projectName: project.name,
      hoursBudget: Math.round(a.hours * (monthWeeks / Math.max(1, planDates.length / 5)) * 10) / 10,
      milestoneNote: project.deadline ? `Deadline ${project.deadline}` : "Steady progress",
    };
  });

  const weekMilestones: WeekMilestone[] = weeklyAllocations.slice(0, 5).map((a) => {
    const project = active.find((p) => p.id === a.projectId)!;
    return {
      weekStart,
      projectId: a.projectId,
      note: `${Math.round(a.hours)}h — ${project.name}`,
    };
  });

  const remainingByProject = new Map(weeklyAllocations.map((a) => [a.projectId, a.hours]));
  const projectReasons = new Map(
    scored.map((s) => {
      if (s.urgency >= 0.7) return [s.project.id, "Urgent deadline"];
      if (s.historical >= 0.7) return [s.project.id, "Neglected — catch up"];
      if (s.project.focusDemand === "low") return [s.project.id, "Low focus slot"];
      if (s.project.overImmersionRisk === "high") return [s.project.id, "Capped — anti-drowning"];
      if (s.importance >= 0.7) return [s.project.id, "High real value"];
      return [s.project.id, "Balanced focus"];
    })
  );

  const dailyPlans: EngineResult["dailyPlans"] = [];
  let sortOrder = 0;

  for (const date of planDates) {
    const dow = getDayOfWeek(date);
    const dayCapacity = settings.weekdayHours[String(dow)] ?? settings.dailyCapacityHours;
    const dayRemaining = new Map(remainingByProject);

    const { blocks } = packDay({
      date,
      dayCapacityHours: dayCapacity,
      remainingHours: dayRemaining,
      projects: active,
      fixedEvents,
      settings,
      sortOrderStart: sortOrder,
      projectReasons,
      effectiveStartMinutes: date === refDate ? asOfMinutes : undefined,
    });

    sortOrder += blocks.length;
    for (const b of blocks) {
      if (b.projectId && b.blockType !== "break" && b.blockType !== "buffer" && b.blockType !== "lunch") {
        const start = b.startTime.split(":").map(Number);
        const end = b.endTime.split(":").map(Number);
        const hours = ((end[0]! * 60 + end[1]!) - (start[0]! * 60 + start[1]!)) / 60;
        const cur = remainingByProject.get(b.projectId) ?? 0;
        remainingByProject.set(b.projectId, Math.max(0, cur - hours));
      }
    }

    dailyPlans.push({
      date,
      totalCapacityHours: dayCapacity,
      blocks,
    });
  }

  return {
    monthStart,
    monthBudgets,
    weekMilestones,
    weekStart,
    totalCapacityHours: totalCapacity,
    weeklyAllocations: weeklyAllocations.map((a) => ({
      projectId: a.projectId,
      plannedHours: a.hours,
      priorityScore: a.priorityScore,
      driftPenalty: a.driftPenalty,
    })),
    dailyPlans,
  };
}

export function getPlannedHoursForDate(
  result: EngineResult,
  date: string
): Map<string, number> {
  const day = result.dailyPlans.find((d) => d.date === date);
  const map = new Map<string, number>();
  if (!day) return map;
  for (const b of day.blocks) {
    if (!b.projectId || b.blockType === "break" || b.blockType === "lunch" || b.blockType === "buffer") continue;
    const [sh, sm] = b.startTime.split(":").map(Number);
    const [eh, em] = b.endTime.split(":").map(Number);
    const hours = ((eh! * 60 + em!) - (sh! * 60 + sm!)) / 60;
    map.set(b.projectId, (map.get(b.projectId) ?? 0) + hours);
  }
  return map;
}
