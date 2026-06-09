import type { CapacityConfig, FocusDemand, OverImmersionRisk, ProjectDraft } from "./types";

export function computeMaxDailyCap(
  draft: Pick<ProjectDraft, "focusDemand" | "overImmersionRisk">,
  settings: CapacityConfig
): number {
  const defaultCap = settings.dailyCapacityHours * (settings.maxProjectSharePct / 100);

  if (draft.focusDemand === "high" && draft.overImmersionRisk === "high") return 2;
  if (draft.overImmersionRisk === "medium") return 3;
  if (draft.focusDemand === "high") return 3;
  return defaultCap;
}

export function buildAntiDrowningWarnings(
  draft: Pick<ProjectDraft, "focusDemand" | "overImmersionRisk" | "name">,
  maxDailyCap: number
): string[] {
  const warnings: string[] = [];

  if (draft.focusDemand === "high" && draft.overImmersionRisk === "high") {
    warnings.push(
      "This project might consume more of your resources than necessary. Capped at 2h/day with forced switching."
    );
  } else if (draft.overImmersionRisk === "high") {
    warnings.push("High over-immersion risk detected. Daily hours will be limited.");
  } else if (draft.focusDemand === "high") {
    warnings.push("High focus demand — schedule deep-work blocks in the morning with breaks.");
  }

  if (maxDailyCap <= 2) {
    warnings.push(`Max ${maxDailyCap}h/day enforced to prevent drowning.`);
  }

  return warnings;
}
