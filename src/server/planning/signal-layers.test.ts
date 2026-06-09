import { describe, expect, it } from "vitest";

import {
  analyzeProjectIntelligence,
} from "./project-intelligence";
import {
  computeAutoUrgencyFromDeadline,
  computeExternalPressure,
  computeDeadlineCurve,
  deriveIntelligenceFromLayers,
  resolveEstimatedHours,
} from "./signal-layers";
import { DEFAULT_CAPACITY } from "./types";
import type { ProjectDraft } from "./types";

const userExampleDraft: ProjectDraft = {
  name: "Small low-focus project",
  projectType: "personal",
  effortSize: "small",
  importanceLevel: 3,
  urgencyLevel: "critical",
  urgencyOverride: true,
  focusDemand: "low",
  overImmersionRisk: "low",
  flexibility: "flexible",
  deadline: "2026-06-12",
  estimatedHoursRemaining: 8,
};

const refDate = "2026-06-09";

describe("signal-layers", () => {
  it("deduplicates urgency and deadline into single timePressure", () => {
    const estimated = resolveEstimatedHours(userExampleDraft);
    const external = computeExternalPressure(userExampleDraft, estimated, refDate);

    const urgencyNorm = 1;
    const deadlineCurve = computeDeadlineCurve(userExampleDraft.deadline, refDate);
    expect(external.timePressure).toBe(Math.max(urgencyNorm, deadlineCurve));
    expect(external.timePressure).toBeLessThanOrEqual(1);
  });

  it("user example: low daily suggestion and priority below old inflated score", () => {
    const layers = deriveIntelligenceFromLayers(
      userExampleDraft,
      DEFAULT_CAPACITY,
      refDate
    );
    const intel = analyzeProjectIntelligence(userExampleDraft, DEFAULT_CAPACITY, refDate);

    expect(layers.external.hoursPerDayRequired).toBeCloseTo(2.7, 0);
    expect(intel.suggestedDailyHours).toBeGreaterThanOrEqual(0.5);
    expect(intel.suggestedDailyHours).toBeLessThanOrEqual(2);
    expect(intel.priorityScore).toBeLessThan(65);
    expect(intel.maxDailyCap).toBeLessThanOrEqual(2);
  });

  it("deadline inflation guard caps pressure when work fits without cramming", () => {
    const draft: ProjectDraft = {
      ...userExampleDraft,
      deadline: "2026-07-09",
      urgencyLevel: "critical",
      urgencyOverride: true,
    };
    const layers = deriveIntelligenceFromLayers(draft, DEFAULT_CAPACITY, refDate);
    expect(layers.fitsWithoutCramming).toBe(true);
    expect(layers.external.timePressure).toBeLessThanOrEqual(0.55);
  });

  it("auto urgency from deadline does not stack with manual override path", () => {
    const auto = computeAutoUrgencyFromDeadline(userExampleDraft, refDate);
    expect(auto).toBe("critical");
    const estimated = resolveEstimatedHours(userExampleDraft);
    const withOverride = computeExternalPressure(userExampleDraft, estimated, refDate);
    const withoutOverride = computeExternalPressure(
      { ...userExampleDraft, urgencyOverride: false },
      estimated,
      refDate
    );
    expect(withOverride.timePressure).toBe(withoutOverride.timePressure);
  });
});
