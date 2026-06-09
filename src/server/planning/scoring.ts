import type {
  AdHocInput,
  CapacityConfig,
  FixedEventInput,
  LearningState,
  ProjectInput,
  ScoredProject,
} from "./types";
import { daysBetween } from "./week-utils";

function levelToNorm(level: string): number {
  const map: Record<string, number> = {
    low: 0.25,
    medium: 0.5,
    high: 0.75,
    critical: 1,
  };
  return map[level] ?? 0.5;
}

function focusToNorm(demand: string): number {
  const map: Record<string, number> = { low: 0.3, medium: 0.6, high: 1 };
  return map[demand] ?? 0.5;
}

function computeUrgency(project: ProjectInput, refDate: string): number {
  const fromLevel = levelToNorm(project.urgencyLevel);
  if (!project.deadline) return Math.max(fromLevel, 0.1);
  const daysLeft = daysBetween(refDate, project.deadline);
  const fromDeadline =
    daysLeft < 0 ? 1 : daysLeft <= 3 ? 0.95 : daysLeft <= 7 ? 0.85 : daysLeft <= 14 ? 0.65 : daysLeft <= 30 ? 0.4 : 0.15;
  return Math.max(fromLevel, fromDeadline);
}

function computeImportance(project: ProjectInput): number {
  return Math.min(1, project.importanceLevel / 5);
}

function computeHistorical(learning: LearningState | undefined, refDate: string): number {
  if (!learning) return 0.5;
  if (learning.neglectDays >= 5) return 1;
  if (learning.neglectDays >= 3) return 0.75;
  if (learning.lastTouchedAt) {
    const days = daysBetween(learning.lastTouchedAt, refDate);
    if (days >= 5) return 0.9;
    if (days >= 3) return 0.6;
  }
  return 0.3;
}

function computeFairness(
  projectId: string,
  activeCount: number,
  learning: LearningState | undefined
): number {
  const fairShare = activeCount > 0 ? 100 / activeCount : 100;
  const actualShare = learning?.avgActualShare ?? 0;
  if (actualShare <= fairShare) return 1;
  return Math.max(0.2, 1 - (actualShare - fairShare) / 50);
}

function computeDependency(
  project: ProjectInput,
  fixedEvents: FixedEventInput[],
  refDate: string
): number {
  const weekEnd = new Date(refDate);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const linked = fixedEvents.filter(
    (e) => e.projectId === project.id && e.date >= refDate && e.date <= weekEnd.toISOString().split("T")[0]!
  );
  if (linked.length > 0) return Math.min(1, 0.5 + linked.length * 0.15);
  if (project.projectType === "client" || project.projectType === "emergency") return 0.5;
  if (project.projectType === "maintenance") return 0.2;
  return 0.1;
}

function computeRiskPenalty(project: ProjectInput): number {
  if (project.focusDemand === "high" && project.overImmersionRisk === "high") return 0.7;
  if (project.overImmersionRisk === "high") return 0.8;
  if (project.overImmersionRisk === "medium") return 0.9;
  return 1;
}

export function scoreProjects(
  projects: ProjectInput[],
  learning: LearningState[],
  fixedEvents: FixedEventInput[],
  adHoc: AdHocInput[],
  refDate: string
): ScoredProject[] {
  const active = projects.filter((p) => p.status === "active");
  const learningMap = new Map(learning.map((l) => [l.projectId, l]));
  const adHocBoost = new Map<string, number>();
  for (const a of adHoc) {
    if (a.expiresAt && a.expiresAt < refDate) continue;
    if (a.projectId) {
      adHocBoost.set(a.projectId, (adHocBoost.get(a.projectId) ?? 0) + Number(a.urgencyBoost));
    }
  }

  return active.map((project) => {
    const state = learningMap.get(project.id);
    const driftPenalty = state?.driftPenaltyMultiplier ?? 1;
    const urgency = Math.min(1, computeUrgency(project, refDate) + (adHocBoost.get(project.id) ?? 0));
    const importance = computeImportance(project);
    const effortFit = focusToNorm(project.focusDemand);
    const context = project.focusDemand === "high" ? 0.85 : project.focusDemand === "medium" ? 0.55 : 0.35;
    const fairness = computeFairness(project.id, active.length, state);
    const dependency = computeDependency(project, fixedEvents, refDate);
    const historical = computeHistorical(state, refDate);
    const riskPenalty = computeRiskPenalty(project);
    const flexibilityFactor = project.flexibility === "flexible" ? 0.92 : 1;

    const raw =
      (urgency * 0.22 +
        importance * 0.18 +
        effortFit * 0.12 +
        context * 0.1 +
        fairness * 0.15 +
        dependency * 0.13 +
        historical * 0.1) *
      riskPenalty *
      flexibilityFactor;

    return {
      project,
      score: Math.max(0.01, raw * driftPenalty),
      urgency,
      importance,
      effortFit,
      context,
      fairness,
      dependency,
      historical,
      driftPenalty,
    };
  });
}

export function distributeWeeklyHours(
  scored: ScoredProject[],
  totalCapacity: number,
  settings: CapacityConfig
): { projectId: string; hours: number; priorityScore: number; driftPenalty: number }[] {
  if (scored.length === 0 || totalCapacity <= 0) return [];

  const maxWeeklyPerProject = totalCapacity * (settings.maxProjectSharePct / 100);
  const totalScore = scored.reduce((s, a) => s + a.score, 0);

  const raw = scored.map((s) => {
    let hours = (s.score / totalScore) * totalCapacity;
    const maxDaily = s.project.maxDailyHours ?? settings.dailyCapacityHours * (settings.maxProjectSharePct / 100);
    hours = Math.min(hours, maxWeeklyPerProject, maxDaily * 5);
    if (s.historical >= 0.75 && hours < 2) hours = 2;
    return {
      projectId: s.project.id,
      hours,
      priorityScore: s.score,
      driftPenalty: s.driftPenalty,
    };
  });

  let total = raw.reduce((s, r) => s + r.hours, 0);
  if (total > totalCapacity) {
    const scale = totalCapacity / total;
    for (const item of raw) item.hours *= scale;
  }

  return raw.map((r) => ({
    ...r,
    hours: Math.round(r.hours * 10) / 10,
  }));
}
