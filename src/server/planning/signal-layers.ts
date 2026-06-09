import type {
  CapacityConfig,
  EffortSize,
  FocusDemand,
  LearningState,
  OverImmersionRisk,
  ProjectDraft,
  ProjectType,
  SchedulingMode,
  UrgencyLevel,
} from "./types";
import { EFFORT_HOURS } from "./types";
import { daysBetween } from "./week-utils";

export type LayerInput = Pick<
  ProjectDraft,
  | "projectType"
  | "effortSize"
  | "importanceLevel"
  | "urgencyLevel"
  | "urgencyOverride"
  | "focusDemand"
  | "overImmersionRisk"
  | "flexibility"
  | "deadline"
  | "estimatedHoursRemaining"
>;

function urgencyToNorm(level: UrgencyLevel): number {
  const map: Record<UrgencyLevel, number> = {
    low: 0.25,
    medium: 0.5,
    high: 0.75,
    critical: 1,
  };
  return map[level];
}

export function computeDeadlineCurve(deadline: string | null, refDate: string): number {
  if (!deadline) return 0.1;
  const daysLeft = daysBetween(refDate, deadline);
  if (daysLeft < 0) return 1;
  if (daysLeft <= 3) return 0.95;
  if (daysLeft <= 7) return 0.85;
  if (daysLeft <= 14) return 0.65;
  if (daysLeft <= 30) return 0.4;
  return 0.15;
}

export function computeAutoUrgencyFromDeadline(
  draft: Pick<ProjectDraft, "deadline" | "projectType">,
  refDate: string
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

function projectTypeBoost(projectType: ProjectType): number {
  if (projectType === "emergency") return 0.15;
  if (projectType === "client") return 0.08;
  return 0;
}

export interface ExternalPressureLayer {
  score: number;
  timePressure: number;
  importanceNorm: number;
  typeBoost: number;
  hoursPerDayRequired: number;
  daysLeft: number | null;
  effectiveUrgency: UrgencyLevel;
  autoUrgencyLevel: UrgencyLevel;
  fitsWithoutCramming: boolean;
}

export function computeExternalPressure(
  draft: LayerInput,
  estimatedHours: number,
  refDate: string
): ExternalPressureLayer {
  const autoUrgencyLevel = computeAutoUrgencyFromDeadline(draft, refDate);
  const effectiveUrgency = draft.urgencyOverride ? draft.urgencyLevel : autoUrgencyLevel;

  const urgencyNorm = urgencyToNorm(effectiveUrgency);
  const deadlineCurve = computeDeadlineCurve(draft.deadline, refDate);
  const timePressure = Math.max(urgencyNorm, deadlineCurve);

  const importanceNorm = draft.importanceLevel / 5;
  const typeBoost = projectTypeBoost(draft.projectType);

  let daysLeft: number | null = null;
  let hoursPerDayRequired = 0;
  if (draft.deadline) {
    daysLeft = Math.max(1, daysBetween(refDate, draft.deadline));
    hoursPerDayRequired = estimatedHours / daysLeft;
  } else if (estimatedHours > 0) {
    hoursPerDayRequired = estimatedHours / 14;
  }

  const externalPressure = Math.min(
    1,
    timePressure * 0.55 + importanceNorm * 0.35 + typeBoost
  );

  return {
    score: Math.round(externalPressure * 100),
    timePressure,
    importanceNorm,
    typeBoost,
    hoursPerDayRequired: Math.round(hoursPerDayRequired * 10) / 10,
    daysLeft,
    effectiveUrgency,
    autoUrgencyLevel,
    fitsWithoutCramming: false,
  };
}

function effortFocusCap(effortSize: EffortSize, focusDemand: FocusDemand): number {
  const effortBase: Record<EffortSize, number> = { small: 1.5, medium: 2.5, large: 4 };
  const focusMult: Record<FocusDemand, number> = { low: 0.85, medium: 1, high: 1.15 };
  return Math.round(effortBase[effortSize] * focusMult[focusDemand] * 10) / 10;
}

function natureIntensity(effortSize: EffortSize, focusDemand: FocusDemand): number {
  const effortNorm: Record<EffortSize, number> = { small: 0.35, medium: 0.6, large: 0.85 };
  const focusNorm: Record<FocusDemand, number> = { low: 0.3, medium: 0.6, high: 1 };
  return effortNorm[effortSize] * 0.5 + focusNorm[focusDemand] * 0.5;
}

export interface WorkNatureLayer {
  score: number;
  sustainableDailyCap: number;
  natureDampener: number;
  needsDailyWork: boolean;
  schedulingMode: SchedulingMode;
  effortSize: EffortSize;
  focusDemand: FocusDemand;
}

export function computeWorkNature(
  draft: LayerInput,
  hoursPerDayRequired: number,
  daysLeft: number | null,
  estimatedHours: number
): WorkNatureLayer {
  const sustainableDailyCap = effortFocusCap(draft.effortSize, draft.focusDemand);
  const intensity = natureIntensity(draft.effortSize, draft.focusDemand);
  const natureDampener = Math.max(0.4, Math.min(1, 0.5 + intensity * 0.5));

  const minMeaningfulDaily = 1;
  const canSpread =
    daysLeft != null &&
    daysLeft > estimatedHours / minMeaningfulDaily &&
    hoursPerDayRequired < minMeaningfulDaily;
  const needsDailyWork = !canSpread && hoursPerDayRequired >= 0.5;

  let schedulingMode: SchedulingMode = "flexible";
  if (draft.flexibility === "fixed") schedulingMode = "batch";
  else if (draft.effortSize === "large") schedulingMode = "spread";
  else if (!needsDailyWork) schedulingMode = "batch";

  const flexibilityFactor = draft.flexibility === "flexible" ? 0.92 : 1;
  const typeFactor =
    draft.projectType === "maintenance" ? 0.85 : draft.projectType === "learning" ? 0.95 : 1;

  return {
    score: Math.round(intensity * flexibilityFactor * typeFactor * 100),
    sustainableDailyCap,
    natureDampener,
    needsDailyWork,
    schedulingMode,
    effortSize: draft.effortSize,
    focusDemand: draft.focusDemand,
  };
}

export interface BehavioralRiskLayer {
  score: number;
  multiplier: number;
  behavioralCap: number;
  overImmersionRisk: OverImmersionRisk;
  neglectDays: number;
  overfocusStreak: number;
}

export function computeBehavioralRisk(
  draft: Pick<ProjectDraft, "focusDemand" | "overImmersionRisk">,
  learning?: LearningState,
  settingsDefaultCap?: number
): BehavioralRiskLayer {
  const defaultCap = settingsDefaultCap ?? 4;
  let multiplier = 1;
  let riskScore = 0.5;
  let behavioralCap = defaultCap;

  if (draft.focusDemand === "high" && draft.overImmersionRisk === "high") {
    behavioralCap = 2;
    riskScore = 0.9;
    multiplier = 0.55;
  } else if (draft.overImmersionRisk === "high") {
    behavioralCap = 3;
    riskScore = 0.75;
    multiplier = 0.7;
  } else if (draft.overImmersionRisk === "medium") {
    behavioralCap = 3.5;
    riskScore = 0.55;
    multiplier = 0.85;
  } else if (draft.focusDemand === "high") {
    behavioralCap = 3;
    riskScore = 0.6;
    multiplier = 0.9;
  }

  const neglectDays = learning?.neglectDays ?? 0;
  const overfocusStreak = learning?.overfocusStreak ?? 0;

  if (learning) {
    multiplier *= learning.driftPenaltyMultiplier;
    if (overfocusStreak >= 2) {
      multiplier *= Math.max(0.5, 1 - overfocusStreak * 0.1);
      riskScore = Math.min(1, riskScore + 0.15);
      behavioralCap = Math.min(behavioralCap, 2.5);
    }
    if (learning.avgActualShare > 35) {
      multiplier *= 0.85;
      riskScore = Math.min(1, riskScore + 0.1);
    }
    if (neglectDays >= 3) {
      riskScore = Math.max(riskScore, 0.65);
    }
  }

  multiplier = Math.max(0.3, Math.min(1, multiplier));

  return {
    score: Math.round(riskScore * 100),
    multiplier,
    behavioralCap,
    overImmersionRisk: draft.overImmersionRisk,
    neglectDays,
    overfocusStreak,
  };
}

export interface SignalLayersResult {
  external: ExternalPressureLayer;
  nature: WorkNatureLayer;
  behavioral: BehavioralRiskLayer;
  priorityScore: number;
  maxDailyCap: number;
  suggestedDailyHours: number;
  fitsWithoutCramming: boolean;
}

export function applyDeadlineInflationGuard(
  external: ExternalPressureLayer,
  nature: WorkNatureLayer,
  estimatedHours: number
): { external: ExternalPressureLayer; fitsWithoutCramming: boolean } {
  if (external.daysLeft == null) {
    return { external, fitsWithoutCramming: false };
  }

  const daysNeeded = Math.ceil(estimatedHours / nature.sustainableDailyCap);
  const fitsWithoutCramming = external.daysLeft >= daysNeeded;

  if (fitsWithoutCramming) {
    const cappedTimePressure = Math.min(external.timePressure, 0.55);
    const cappedExternal = Math.min(
      1,
      cappedTimePressure * 0.55 + external.importanceNorm * 0.35 + external.typeBoost
    );
    return {
      external: {
        ...external,
        timePressure: cappedTimePressure,
        score: Math.round(cappedExternal * 100),
        fitsWithoutCramming: true,
      },
      fitsWithoutCramming: true,
    };
  }

  return { external: { ...external, fitsWithoutCramming: false }, fitsWithoutCramming: false };
}

export function computeSuggestedDailyFromLayers(
  external: ExternalPressureLayer,
  nature: WorkNatureLayer,
  behavioral: BehavioralRiskLayer,
  settings: CapacityConfig
): { suggestedDailyHours: number; maxDailyCap: number } {
  const settingsCap =
    settings.dailyCapacityHours * (settings.maxProjectSharePct / 100);

  const maxDailyCap = Math.round(
    Math.min(settingsCap, nature.sustainableDailyCap, behavioral.behavioralCap) * 10
  ) / 10;

  const paceBased =
    external.hoursPerDayRequired > 0
      ? external.hoursPerDayRequired
      : nature.sustainableDailyCap * 0.5;

  let suggested = Math.min(paceBased, maxDailyCap) * nature.natureDampener;
  suggested *= behavioral.multiplier;

  if (!nature.needsDailyWork) {
    suggested = Math.min(suggested, nature.sustainableDailyCap * 0.75);
  }

  suggested = Math.round(Math.max(0.5, suggested) * 10) / 10;
  return { suggestedDailyHours: Math.min(suggested, maxDailyCap), maxDailyCap };
}

export function computePriorityScore(
  external: ExternalPressureLayer,
  nature: WorkNatureLayer,
  behavioral: BehavioralRiskLayer
): number {
  const externalNorm = external.score / 100;
  const natureNorm = nature.score / 100;
  const behavioralNorm = behavioral.score / 100;

  const raw =
    externalNorm * 0.35 + natureNorm * 0.25 + behavioralNorm * 0.4;
  const adjusted = raw * behavioral.multiplier;

  return Math.round(Math.min(100, Math.max(0, adjusted * 100)));
}

export function resolveEstimatedHours(draft: LayerInput): number {
  if (draft.estimatedHoursRemaining != null && draft.estimatedHoursRemaining > 0) {
    return draft.estimatedHoursRemaining;
  }
  return EFFORT_HOURS[draft.effortSize];
}

export function deriveIntelligenceFromLayers(
  draft: LayerInput,
  settings: CapacityConfig,
  refDate: string,
  learning?: LearningState
): SignalLayersResult {
  const estimatedHours = resolveEstimatedHours(draft);
  const settingsCap = settings.dailyCapacityHours * (settings.maxProjectSharePct / 100);

  let external = computeExternalPressure(draft, estimatedHours, refDate);
  const nature = computeWorkNature(
    draft,
    external.hoursPerDayRequired,
    external.daysLeft,
    estimatedHours
  );
  const behavioral = computeBehavioralRisk(draft, learning, settingsCap);

  const guard = applyDeadlineInflationGuard(external, nature, estimatedHours);
  external = guard.external;

  const { suggestedDailyHours, maxDailyCap } = computeSuggestedDailyFromLayers(
    external,
    nature,
    behavioral,
    settings
  );

  const priorityScore = computePriorityScore(external, nature, behavioral);

  return {
    external,
    nature,
    behavioral,
    priorityScore,
    maxDailyCap,
    suggestedDailyHours,
    fitsWithoutCramming: guard.fitsWithoutCramming,
  };
}

/** Weekly allocation score (0–1) using shared layers + fairness/dependency/historical. */
export function computeWeeklyLayerScore(input: {
  layers: SignalLayersResult;
  fairness: number;
  dependency: number;
  historical: number;
  adHocBoost: number;
}): number {
  const layers = input.layers;

  const externalNorm = layers.external.score / 100;
  const natureNorm = layers.nature.score / 100;
  const behavioralNorm = layers.behavioral.multiplier;

  const splittablePenalty = layers.nature.needsDailyWork ? 1 : 0.75;

  const raw =
    (externalNorm * 0.28 +
      natureNorm * 0.12 +
      input.fairness * 0.15 +
      input.dependency * 0.13 +
      input.historical * 0.1 +
      behavioralNorm * 0.22) *
    splittablePenalty;

  return Math.max(0.01, Math.min(1, raw + input.adHocBoost * 0.1));
}
