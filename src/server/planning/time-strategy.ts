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

export function computeSuggestedDailyHours(
  compositeScore: number,
  maxDailyCap: number,
  settings: CapacityConfig
): number {
  const base = settings.dailyCapacityHours * (compositeScore / 100);
  return Math.round(Math.min(maxDailyCap, Math.max(0.5, base)) * 10) / 10;
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
