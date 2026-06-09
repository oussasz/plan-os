import { buildAllocationContract } from "./allocation-contract";
import { buildAntiDrowningWarnings } from "./anti-drowning";
import {
  computeAutoUrgencyFromDeadline,
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
  PreferredTimeOfDay,
  PriorityBand,
  ProjectDraft,
  ProjectInput,
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

function draftToProjectInput(draft: ProjectDraft, preferredTimeOfDay: PreferredTimeOfDay): ProjectInput {
  return {
    id: "preview",
    name: draft.name,
    projectType: draft.projectType,
    status: "active",
    schedulingMode: "flexible",
    effortSize: draft.effortSize,
    importanceLevel: draft.importanceLevel,
    importanceWeight: draft.importanceLevel * 2,
    urgencyLevel: draft.urgencyLevel,
    urgencyOverride: draft.urgencyOverride,
    focusDemand: draft.focusDemand,
    overImmersionRisk: draft.overImmersionRisk,
    flexibility: draft.flexibility,
    deadline: draft.deadline,
    estimatedHoursRemaining: draft.estimatedHoursRemaining,
    maxDailyHours: null,
    requiresDeepFocus: requiresDeepFocus(draft.focusDemand),
    preferredTimeOfDay,
  };
}

export function analyzeProjectIntelligence(
  draft: ProjectDraft,
  settings: CapacityConfig = DEFAULT_CAPACITY,
  refDate?: string,
  learning?: LearningState
): ProjectIntelligenceResult {
  const today = refDate ?? new Date().toISOString().split("T")[0]!;
  const preferredTimeOfDay = derivePreferredTimeOfDay(draft.focusDemand, draft.projectType);
  const contract = buildAllocationContract(
    draftToProjectInput(draft, preferredTimeOfDay),
    settings,
    today,
    learning
  );

  const maxDailyCap = contract.maxSafeDailyCap;
  const suggestedDailyHours = contract.executionDailyHours;
  const schedulingMode = contract.schedulingMode;
  const suggestedSessions = computeSuggestedSessions(suggestedDailyHours, settings.blockMinutes);
  const estimatedHours = contract.estimatedHoursRemaining;
  const warnings = buildAntiDrowningWarnings(draft, maxDailyCap, {
    external: contract.layers.external,
    nature: contract.layers.nature,
    behavioral: contract.layers.behavioral,
    fitsWithoutCramming: contract.layers.external.fitsWithoutCramming,
  });

  const reasons: string[] = [];
  if (contract.layers.external.effectiveUrgency === "critical" && contract.needsDailyWork) {
    reasons.push("Urgent deadline — daily pace required");
  } else if (contract.layers.external.effectiveUrgency === "critical" && !contract.needsDailyWork) {
    reasons.push("Urgent but batchable — spread across days");
  } else if (draft.importanceLevel >= 4) {
    reasons.push("High real value");
  } else if (!contract.needsDailyWork) {
    reasons.push("Batch scheduling — no daily pressure needed");
  } else {
    reasons.push("Balanced focus");
  }

  if (draft.focusDemand === "low") reasons.push("Low focus slot");
  if (draft.projectType === "maintenance") reasons.push("Maintenance window");
  if (contract.layers.external.fitsWithoutCramming) reasons.push("Deadline fits without cramming");

  const priorityScore = contract.priorityScore;

  return {
    priorityBand: toPriorityBand(priorityScore),
    compositeScore: priorityScore,
    priorityScore,
    suggestedDailyHours,
    executionDailyHours: suggestedDailyHours,
    suggestedSessions,
    preferredTimeOfDay,
    maxDailyCap,
    schedulingMode,
    estimatedHours,
    requiresDeepFocus: requiresDeepFocus(draft.focusDemand),
    autoUrgencyLevel: computeAutoUrgencyFromDeadline(draft, today),
    warnings,
    layers: contract.layers,
    scoreBreakdown: {
      importance: Math.round(contract.layers.external.importanceNorm * 30),
      urgency: Math.round(contract.layers.external.timePressure * 25),
      deadlinePressure: Math.round(contract.layers.external.timePressure * 20),
      focusDemand: Math.round(contract.layers.nature.score * 0.1),
      flexibilityPenalty: draft.flexibility === "flexible" ? 5 : 0,
      riskAdjustment: Math.round((contract.layers.behavioral.multiplier - 1) * 20),
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
