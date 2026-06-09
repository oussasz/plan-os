import type { CapacityConfig, FocusDemand, OverImmersionRisk, ProjectDraft } from "./types";
import type { SignalLayersResult } from "./signal-layers";

export function computeMaxDailyCap(
  draft: Pick<ProjectDraft, "effortSize" | "focusDemand" | "overImmersionRisk">,
  settings: CapacityConfig,
  layers?: Pick<SignalLayersResult, "nature" | "behavioral" | "maxDailyCap">
): number {
  if (layers) {
    return layers.maxDailyCap;
  }

  const settingsCap = settings.dailyCapacityHours * (settings.maxProjectSharePct / 100);
  const effortCap: Record<ProjectDraft["effortSize"], number> = {
    small: 1.5,
    medium: 2.5,
    large: 4,
  };
  const base = effortCap[draft.effortSize];

  if (draft.focusDemand === "high" && draft.overImmersionRisk === "high") return Math.min(2, base);
  if (draft.overImmersionRisk === "high") return Math.min(3, base);
  if (draft.focusDemand === "high") return Math.min(3, base);
  return Math.min(settingsCap, base);
}

export function buildAntiDrowningWarnings(
  draft: Pick<ProjectDraft, "focusDemand" | "overImmersionRisk" | "name" | "urgencyOverride" | "urgencyLevel">,
  maxDailyCap: number,
  layers?: Pick<SignalLayersResult, "external" | "nature" | "behavioral" | "fitsWithoutCramming">
): string[] {
  const warnings: string[] = [];

  if (layers) {
    if (!layers.nature.needsDailyWork) {
      warnings.push(
        "Deadline proximity does not require daily work — batch scheduling recommended."
      );
    }
    if (layers.external.timePressure >= 0.75 && layers.nature.natureDampener < 0.7) {
      warnings.push(
        "Urgency dampened by low effort/focus — daily pressure reduced to realistic pace."
      );
    }
    if (draft.urgencyOverride && layers.nature.sustainableDailyCap < layers.external.hoursPerDayRequired) {
      warnings.push(
        "You marked critical urgency, but work nature suggests batching rather than daily cramming."
      );
    }
    if (layers.fitsWithoutCramming) {
      warnings.push("Work fits before deadline without daily overload.");
    }
    if (layers.behavioral.multiplier < 0.85) {
      warnings.push("Behavioral risk active — allocation capped by learning history.");
    }
  }

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

  return [...new Set(warnings)];
}
