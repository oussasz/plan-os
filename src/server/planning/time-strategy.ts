import type {
  CapacityConfig,
  FocusDemand,
  PreferredTimeOfDay,
  ProjectDraft,
  ProjectType,
  SchedulingMode,
} from "./types";

export function deriveSchedulingMode(
  effortSize: ProjectDraft["effortSize"],
  flexibility: ProjectDraft["flexibility"]
): SchedulingMode {
  if (flexibility === "fixed") return "batch";
  if (effortSize === "large") return "spread";
  return "flexible";
}

export function derivePreferredTimeOfDay(
  focusDemand: FocusDemand,
  projectType: ProjectType
): PreferredTimeOfDay {
  if (focusDemand === "high") return "morning";
  if (projectType === "maintenance" || focusDemand === "low") return "afternoon";
  return "flexible";
}

export function computeSuggestedDailyHours(input: {
  hoursPerDayRequired: number;
  sustainableDailyCap: number;
  maxDailyCap: number;
  natureDampener: number;
  behavioralMultiplier: number;
  needsDailyWork: boolean;
  settings: CapacityConfig;
}): number {
  const paceBased =
    input.hoursPerDayRequired > 0
      ? input.hoursPerDayRequired
      : input.sustainableDailyCap * 0.5;

  let suggested = Math.min(paceBased, input.maxDailyCap) * input.natureDampener;
  suggested *= input.behavioralMultiplier;

  if (!input.needsDailyWork) {
    suggested = Math.min(suggested, input.sustainableDailyCap * 0.75);
  }

  return Math.round(Math.max(0.5, suggested) * 10) / 10;
}

export function computeSuggestedSessions(
  suggestedDailyHours: number,
  blockMinutes: number
): number {
  if (suggestedDailyHours <= 0) return 0;
  return Math.ceil((suggestedDailyHours * 60) / blockMinutes);
}

export function requiresDeepFocus(focusDemand: FocusDemand): boolean {
  return focusDemand === "high" || focusDemand === "medium";
}
