import {
  deriveIntelligenceFromLayers,
  computeWeeklyLayerScore,
  type LayerInput,
} from "./signal-layers";
import type {
  AdHocInput,
  CapacityConfig,
  FixedEventInput,
  LearningState,
  ProjectInput,
  ScoredProject,
} from "./types";
import { DEFAULT_CAPACITY } from "./types";
import { daysBetween } from "./week-utils";

function projectToDraft(project: ProjectInput): LayerInput {
  return {
    projectType: project.projectType,
    effortSize: project.effortSize,
    importanceLevel: project.importanceLevel,
    urgencyLevel: project.urgencyLevel,
    urgencyOverride: project.urgencyOverride,
    focusDemand: project.focusDemand,
    overImmersionRisk: project.overImmersionRisk,
    flexibility: project.flexibility,
    deadline: project.deadline,
    estimatedHoursRemaining: project.estimatedHoursRemaining,
  };
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
    (e) =>
      e.projectId === project.id &&
      e.date >= refDate &&
      e.date <= weekEnd.toISOString().split("T")[0]!
  );
  if (linked.length > 0) return Math.min(1, 0.5 + linked.length * 0.15);
  if (project.projectType === "client" || project.projectType === "emergency") return 0.5;
  if (project.projectType === "maintenance") return 0.2;
  return 0.1;
}

export function scoreProjects(
  projects: ProjectInput[],
  learning: LearningState[],
  fixedEvents: FixedEventInput[],
  adHoc: AdHocInput[],
  refDate: string,
  settings: CapacityConfig = DEFAULT_CAPACITY
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
    const draft = projectToDraft(project);
    const layers = deriveIntelligenceFromLayers(draft, settings, refDate, state);

    const fairness = computeFairness(project.id, active.length, state);
    const dependency = computeDependency(project, fixedEvents, refDate);
    const historical = computeHistorical(state, refDate);

    let score = computeWeeklyLayerScore({
      layers,
      fairness,
      dependency,
      historical,
      adHocBoost: adHocBoost.get(project.id) ?? 0,
    });

    if (state && state.neglectDays >= 3) {
      score = Math.min(1, score * 1.12);
    }

    const driftPenalty = state?.driftPenaltyMultiplier ?? 1;
    score = Math.max(0.01, score * driftPenalty);

    return {
      project,
      score,
      urgency: layers.external.timePressure,
      importance: layers.external.importanceNorm,
      effortFit: layers.nature.score / 100,
      context: project.focusDemand === "high" ? 0.85 : project.focusDemand === "medium" ? 0.55 : 0.35,
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
