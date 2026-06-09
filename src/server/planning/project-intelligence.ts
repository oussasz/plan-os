import { buildAntiDrowningWarnings, computeMaxDailyCap } from "./anti-drowning";
import {
  computeSuggestedDailyHours,
  computeSuggestedSessions,
  derivePreferredTimeOfDay,
  deriveSchedulingMode,
  requiresDeepFocus,
} from "./time-strategy";
import type {
  CapacityConfig,
  PriorityBand,
  ProjectDraft,
  ProjectIntelligenceResult,
  UrgencyLevel,
} from "./types";
import { DEFAULT_CAPACITY, EFFORT_HOURS } from "./types";
import { daysBetween, getToday } from "./week-utils";

function levelToNorm(level: UrgencyLevel): number {
  const map: Record<UrgencyLevel, number> = {
    low: 0.25,
    medium: 0.5,
    high: 0.75,
    critical: 1,
  };
  return map[level];
}

function focusToNorm(demand: ProjectDraft["focusDemand"]): number {
  const map = { low: 0.3, medium: 0.6, high: 1 };
  return map[demand];
}

export function computeAutoUrgency(
  draft: Pick<ProjectDraft, "deadline" | "projectType">,
  refDate = getToday()
): UrgencyLevel {
  if (draft.projectType === "emergency") return "critical";
  if (!draft.deadline) return draft.projectType === "client" ? "medium" : "low";

  const daysLeft = daysBetween(refDate, draft.deadline);
  if (daysLeft < 0) return "critical";
  if (daysLeft <= 3) return "critical";
  if (daysLeft <= 7) return "high";
  if (daysLeft <= 14) return "medium";
  return "low";
}

function computeDeadlinePressure(deadline: string | null, refDate: string): number {
  if (!deadline) return 0.1;
  const daysLeft = daysBetween(refDate, deadline);
  if (daysLeft < 0) return 1;
  if (daysLeft <= 3) return 0.95;
  if (daysLeft <= 7) return 0.85;
  if (daysLeft <= 14) return 0.65;
  if (daysLeft <= 30) return 0.4;
  return 0.15;
}

function computeRiskAdjustment(
  focusDemand: ProjectDraft["focusDemand"],
  overImmersionRisk: ProjectDraft["overImmersionRisk"]
): number {
  if (focusDemand === "high" && overImmersionRisk === "high") return -8;
  if (overImmersionRisk === "high") return -5;
  if (overImmersionRisk === "medium") return -2;
  return 0;
}

function toPriorityBand(score: number): PriorityBand {
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function resolveEstimatedHours(draft: ProjectDraft): number {
  if (draft.estimatedHoursRemaining != null && draft.estimatedHoursRemaining > 0) {
    return draft.estimatedHoursRemaining;
  }
  return EFFORT_HOURS[draft.effortSize];
}

export function analyzeProjectIntelligence(
  draft: ProjectDraft,
  settings: CapacityConfig = DEFAULT_CAPACITY,
  refDate = getToday()
): ProjectIntelligenceResult {
  const autoUrgencyLevel = computeAutoUrgency(draft, refDate);
  const effectiveUrgency = draft.urgencyOverride ? draft.urgencyLevel : autoUrgencyLevel;

  const importanceNorm = draft.importanceLevel / 5;
  const urgencyNorm = levelToNorm(effectiveUrgency);
  const deadlinePressure = computeDeadlinePressure(draft.deadline, refDate);
  const focusNorm = focusToNorm(draft.focusDemand);
  const flexibilityPenalty = draft.flexibility === "flexible" ? 5 : 0;
  const riskAdjustment = computeRiskAdjustment(draft.focusDemand, draft.overImmersionRisk);

  const compositeScore = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        importanceNorm * 30 +
          urgencyNorm * 25 +
          deadlinePressure * 20 +
          focusNorm * 10 -
          flexibilityPenalty +
          riskAdjustment
      )
    )
  );

  const maxDailyCap = computeMaxDailyCap(draft, settings);
  const schedulingMode = deriveSchedulingMode(draft.effortSize, draft.flexibility);
  const preferredTimeOfDay = derivePreferredTimeOfDay(draft.focusDemand, draft.projectType);
  const suggestedDailyHours = computeSuggestedDailyHours(compositeScore, maxDailyCap, settings);
  const suggestedSessions = computeSuggestedSessions(suggestedDailyHours, settings.blockMinutes);
  const estimatedHours = resolveEstimatedHours(draft);
  const warnings = buildAntiDrowningWarnings(draft, maxDailyCap);

  const reasons: string[] = [];
  if (effectiveUrgency === "critical" || deadlinePressure >= 0.85) {
    reasons.push("Urgent deadline");
  } else if (draft.importanceLevel >= 4) {
    reasons.push("High real value");
  } else if (draft.flexibility === "flexible") {
    reasons.push("Can be postponed");
  } else {
    reasons.push("Balanced focus");
  }

  if (draft.focusDemand === "low") reasons.push("Low focus slot");
  if (draft.projectType === "maintenance") reasons.push("Maintenance window");

  return {
    priorityBand: toPriorityBand(compositeScore),
    compositeScore,
    suggestedDailyHours,
    suggestedSessions,
    preferredTimeOfDay,
    maxDailyCap,
    schedulingMode,
    estimatedHours,
    requiresDeepFocus: requiresDeepFocus(draft.focusDemand),
    autoUrgencyLevel,
    warnings,
    scoreBreakdown: {
      importance: Math.round(importanceNorm * 30),
      urgency: Math.round(urgencyNorm * 25),
      deadlinePressure: Math.round(deadlinePressure * 20),
      focusDemand: Math.round(focusNorm * 10),
      flexibilityPenalty,
      riskAdjustment,
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
