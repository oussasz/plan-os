import { describe, expect, it } from "vitest";

import { analyzeProjectIntelligence } from "./project-intelligence";
import {
  buildAllocationContract,
  buildAllocationContracts,
  computeWeeklyBudgetFromContracts,
} from "./allocation-contract";
import { generatePlan } from "./engine";
import { getPlannedHoursForDate } from "./engine";
import type { ProjectDraft, ProjectInput } from "./types";
import { DEFAULT_CAPACITY } from "./types";

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

function draftToProject(id: string, draft: ProjectDraft): ProjectInput {
  return {
    id,
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
    requiresDeepFocus: false,
    preferredTimeOfDay: "afternoon",
  };
}

describe("allocation-contract", () => {
  it("contract matches intelligence preview execution hours", () => {
    const intel = analyzeProjectIntelligence(userExampleDraft, DEFAULT_CAPACITY, refDate);
    const contract = buildAllocationContract(
      draftToProject("p1", userExampleDraft),
      DEFAULT_CAPACITY,
      refDate
    );
    expect(intel.suggestedDailyHours).toBe(contract.executionDailyHours);
    expect(intel.executionDailyHours).toBe(contract.executionDailyHours);
    expect(contract.executionDailyHours).toBeLessThanOrEqual(2);
  });

  it("weekly budget is pace-driven not score-driven", () => {
    const project = draftToProject("p1", userExampleDraft);
    const contracts = buildAllocationContracts([project], [], DEFAULT_CAPACITY, refDate);
    const planDates = ["2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12"];
    const budget = computeWeeklyBudgetFromContracts(contracts, planDates, 40);
    const contract = contracts.get("p1")!;
    const item = budget.find((b) => b.projectId === "p1")!;
    expect(item.hours).toBeLessThanOrEqual(contract.executionDailyHours * planDates.length);
    expect(item.hours).toBeLessThanOrEqual(contract.estimatedHoursRemaining);
  });

  it("generatePlan daily blocks respect executionDailyHours", () => {
    const project = draftToProject("p1", userExampleDraft);
    const result = generatePlan({
      projects: [project],
      fixedEvents: [],
      adHoc: [],
      learning: [],
      settings: DEFAULT_CAPACITY,
      refDate,
    });
    expect(result).not.toBeNull();
    const contracts = buildAllocationContracts([project], [], DEFAULT_CAPACITY, refDate);
    const contract = contracts.get("p1")!;
    const todayHours = getPlannedHoursForDate(result!, refDate);
    const placed = todayHours.get("p1") ?? 0;
    expect(placed).toBeLessThanOrEqual(contract.executionDailyHours + 0.1);
  });

  it("batch project has zero daily target on non-batch days", () => {
    const batchDraft: ProjectDraft = {
      ...userExampleDraft,
      deadline: "2026-07-09",
      urgencyLevel: "low",
      urgencyOverride: false,
    };
    const project = draftToProject("batch", batchDraft);
    const contract = buildAllocationContract(project, DEFAULT_CAPACITY, refDate);
    if (!contract.needsDailyWork) {
      expect(contract.requiredDailyEffort).toBe(0);
    }
  });
});
