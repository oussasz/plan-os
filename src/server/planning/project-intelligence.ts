import { buildAntiDrowningWarnings, computeMaxDailyCap } from "./anti-drowning";
import {
  computeAutoUrgencyFromDeadline,
  deriveIntelligenceFromLayers,
  resolveEstimatedHours,
} from "./signal-layers";
import {
  computeSuggestedSessions,
  derivePreferredTimeOfDay,
  requiresDeepFocus,
} from "./time-strategy";
import type {
  CapacityConfig,
  LearningState,
  PriorityBand,
  ProjectDraft,
  ProjectIntelligenceResult,
} from "./types";
import { DEFAULT_CAPACITY } from "./types";

function toPriorityBand(score: number): PriorityBand {
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export { computeAutoUrgencyFromDeadline as computeAutoUrgency };
export { resolveEstimatedHours };

export function analyzeProjectIntelligence(
  draft: ProjectDraft,
  settings: CapacityConfig = DEFAULT_CAPACITY,
  refDate?: string,
  learning?: LearningState
): ProjectIntelligenceResult {
  const today = refDate ?? new Date().toISOString().split("T")[0]!;
  const layers = deriveIntelligenceFromLayers(draft, settings, today, learning);

  const maxDailyCap = computeMaxDailyCap(draft, settings, layers);
  const suggestedDailyHours = Math.min(layers.suggestedDailyHours, maxDailyCap);
  const schedulingMode = layers.nature.schedulingMode;
  const preferredTimeOfDay = derivePreferredTimeOfDay(draft.focusDemand, draft.projectType);
  const suggestedSessions = computeSuggestedSessions(suggestedDailyHours, settings.blockMinutes);
  const estimatedHours = resolveEstimatedHours(draft);
  const warnings = buildAntiDrowningWarnings(draft, maxDailyCap, layers);

  const reasons: string[] = [];
  if (layers.external.effectiveUrgency === "critical" && layers.nature.needsDailyWork) {
    reasons.push("Urgent deadline — daily pace required");
  } else if (layers.external.effectiveUrgency === "critical" && !layers.nature.needsDailyWork) {
    reasons.push("Urgent but batchable — spread across days");
  } else if (draft.importanceLevel >= 4) {
    reasons.push("High real value");
  } else if (!layers.nature.needsDailyWork) {
    reasons.push("Batch scheduling — no daily pressure needed");
  } else {
    reasons.push("Balanced focus");
  }

  if (draft.focusDemand === "low") reasons.push("Low focus slot");
  if (draft.projectType === "maintenance") reasons.push("Maintenance window");
  if (layers.fitsWithoutCramming) reasons.push("Deadline fits without cramming");

  const priorityScore = layers.priorityScore;

  return {
    priorityBand: toPriorityBand(priorityScore),
    compositeScore: priorityScore,
    priorityScore,
    suggestedDailyHours,
    suggestedSessions,
    preferredTimeOfDay,
    maxDailyCap,
    schedulingMode,
    estimatedHours,
    requiresDeepFocus: requiresDeepFocus(draft.focusDemand),
    autoUrgencyLevel: layers.external.autoUrgencyLevel,
    warnings,
    layers: {
      external: {
        score: layers.external.score,
        timePressure: layers.external.timePressure,
        importanceNorm: layers.external.importanceNorm,
        hoursPerDayRequired: layers.external.hoursPerDayRequired,
        daysLeft: layers.external.daysLeft,
        effectiveUrgency: layers.external.effectiveUrgency,
        fitsWithoutCramming: layers.fitsWithoutCramming,
      },
      nature: {
        score: layers.nature.score,
        sustainableDailyCap: layers.nature.sustainableDailyCap,
        natureDampener: layers.nature.natureDampener,
        needsDailyWork: layers.nature.needsDailyWork,
        schedulingMode: layers.nature.schedulingMode,
      },
      behavioral: {
        score: layers.behavioral.score,
        multiplier: layers.behavioral.multiplier,
        behavioralCap: layers.behavioral.behavioralCap,
        overfocusStreak: layers.behavioral.overfocusStreak,
        neglectDays: layers.behavioral.neglectDays,
      },
    },
    scoreBreakdown: {
      importance: Math.round(layers.external.importanceNorm * 30),
      urgency: Math.round(layers.external.timePressure * 25),
      deadlinePressure: Math.round(layers.external.timePressure * 20),
      focusDemand: Math.round(layers.nature.score * 0.1),
      flexibilityPenalty: draft.flexibility === "flexible" ? 5 : 0,
      riskAdjustment: Math.round((layers.behavioral.multiplier - 1) * 20),
    },
    reasons,
  };
}

export function applyIntelligenceToProject(
  draft: ProjectDraft,
  intelligence: ProjectIntelligenceResult
) {
  return {
    projectType: draft.projectType,
    effortSize: draft.effortSize,
    importanceLevel: draft.importanceLevel,
    importanceWeight: draft.importanceLevel * 2,
    urgencyLevel: draft.urgencyOverride ? draft.urgencyLevel : intelligence.autoUrgencyLevel,
    urgencyOverride: draft.urgencyOverride,
    focusDemand: draft.focusDemand,
    overImmersionRisk: draft.overImmersionRisk,
    flexibility: draft.flexibility,
    schedulingMode: intelligence.schedulingMode,
    estimatedHoursRemaining: intelligence.estimatedHours,
    maxDailyHours: intelligence.maxDailyCap,
    requiresDeepFocus: intelligence.requiresDeepFocus,
  };
}
