import {
  computeSuggestedDailyFromLayers,
  deriveIntelligenceFromLayers,
  resolveEstimatedHours,
  type LayerInput,
} from "./signal-layers";
import type {
  CapacityConfig,
  EffortSize,
  LearningState,
  ProjectInput,
  SchedulingMode,
  SignalLayerBreakdown,
} from "./types";

export interface AllocationContract {
  projectId: string;
  effortSize: EffortSize;
  requiredDailyEffort: number;
  maxSafeDailyCap: number;
  executionDailyHours: number;
  needsDailyWork: boolean;
  schedulingMode: SchedulingMode;
  estimatedHoursRemaining: number;
  urgencyPressure: number;
  priorityScore: number;
  driftPenalty: number;
  layers: SignalLayerBreakdown;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function projectToLayerInput(project: ProjectInput): LayerInput {
  return {
    projectType: project.projectType,
    effortSize: project.effortSize,
    importanceLevel: project.importanceLevel,
    urgencyLevel: project.urgencyLevel,
    urgencyOverride: project.urgencyOverride,
    focusDemand: project.focusDemand,
    overImmersionRisk: project.overImmersionRisk,
    flexibility: project.flexibility,
    deadline: project.deadline,
    estimatedHoursRemaining: project.estimatedHoursRemaining,
  };
}

function layersToBreakdown(layers: ReturnType<typeof deriveIntelligenceFromLayers>): SignalLayerBreakdown {
  return {
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
  };
}

function batchDaysForEffort(effortSize: EffortSize): number {
  if (effortSize === "small") return 1;
  if (effortSize === "medium") return 2;
  return 2;
}

function recomputeExecutionDaily(
  requiredDailyEffort: number,
  layers: ReturnType<typeof deriveIntelligenceFromLayers>,
  settings: CapacityConfig
): { executionDailyHours: number; maxSafeDailyCap: number } {
  const { maxDailyCap } = computeSuggestedDailyFromLayers(
    layers.external,
    layers.nature,
    layers.behavioral,
    settings
  );

  let execution = layers.suggestedDailyHours;
  if (requiredDailyEffort > layers.external.hoursPerDayRequired) {
    const paceBased = Math.min(requiredDailyEffort, maxDailyCap);
    let suggested = paceBased * layers.nature.natureDampener * layers.behavioral.multiplier;
    if (!layers.nature.needsDailyWork) {
      suggested = Math.min(suggested, layers.nature.sustainableDailyCap * 0.75);
    }
    execution = round1(Math.max(0.5, Math.min(suggested, maxDailyCap)));
  }

  return { executionDailyHours: execution, maxSafeDailyCap: maxDailyCap };
}

export function buildAllocationContract(
  project: ProjectInput,
  settings: CapacityConfig,
  refDate: string,
  learning?: LearningState
): AllocationContract {
  const draft = projectToLayerInput(project);
  const layers = deriveIntelligenceFromLayers(draft, settings, refDate, learning);
  const estimatedHours = resolveEstimatedHours(draft);

  let requiredDailyEffort = layers.external.hoursPerDayRequired;
  if (!layers.nature.needsDailyWork && layers.nature.schedulingMode === "batch") {
    requiredDailyEffort = 0;
  }

  if (learning && learning.neglectDays >= 3) {
    requiredDailyEffort = Math.max(
      requiredDailyEffort,
      Math.min(layers.external.hoursPerDayRequired, layers.maxDailyCap)
    );
  }

  const { executionDailyHours, maxSafeDailyCap } = recomputeExecutionDaily(
    requiredDailyEffort,
    layers,
    settings
  );

  return {
    projectId: project.id,
    effortSize: project.effortSize,
    requiredDailyEffort: round1(requiredDailyEffort),
    maxSafeDailyCap,
    executionDailyHours,
    needsDailyWork: layers.nature.needsDailyWork,
    schedulingMode: layers.nature.schedulingMode,
    estimatedHoursRemaining: estimatedHours,
    urgencyPressure: layers.external.timePressure,
    priorityScore: layers.priorityScore,
    driftPenalty: learning?.driftPenaltyMultiplier ?? 1,
    layers: layersToBreakdown(layers),
  };
}

export function buildAllocationContracts(
  projects: ProjectInput[],
  learning: LearningState[],
  settings: CapacityConfig,
  refDate: string
): Map<string, AllocationContract> {
  const learningMap = new Map(learning.map((l) => [l.projectId, l]));
  const contracts = new Map<string, AllocationContract>();

  for (const project of projects.filter((p) => p.status === "active")) {
    contracts.set(
      project.id,
      buildAllocationContract(project, settings, refDate, learningMap.get(project.id))
    );
  }

  return contracts;
}

export function rankByUrgencyPressure(
  contracts: Map<string, AllocationContract>
): AllocationContract[] {
  return [...contracts.values()].sort((a, b) => b.urgencyPressure - a.urgencyPressure);
}

export interface WeeklyBudgetItem {
  projectId: string;
  hours: number;
  priorityScore: number;
  driftPenalty: number;
}

export function computeWeeklyBudgetFromContracts(
  contracts: Map<string, AllocationContract>,
  planDates: string[],
  totalCapacity: number
): WeeklyBudgetItem[] {
  if (contracts.size === 0 || totalCapacity <= 0 || planDates.length === 0) return [];

  const workDayCount = planDates.length;
  const raw = new Map<string, number>();

  for (const contract of contracts.values()) {
    let weekly: number;
    if (contract.schedulingMode === "batch" && !contract.needsDailyWork) {
      const batchDays = batchDaysForEffort(contract.effortSize);
      weekly = Math.min(
        contract.estimatedHoursRemaining,
        contract.executionDailyHours * batchDays
      );
    } else {
      weekly = Math.min(
        contract.estimatedHoursRemaining,
        contract.executionDailyHours * workDayCount
      );
    }
    raw.set(contract.projectId, round1(Math.max(0, weekly)));
  }

  let total = [...raw.values()].reduce((s, h) => s + h, 0);
  if (total > totalCapacity) {
    const ranked = rankByUrgencyPressure(contracts);
    const allocated = new Map<string, number>();
    let remaining = totalCapacity;

    for (const contract of ranked) {
      const want = raw.get(contract.projectId) ?? 0;
      const give = round1(Math.min(want, remaining));
      allocated.set(contract.projectId, give);
      remaining = round1(Math.max(0, remaining - give));
    }

    for (const [id, hours] of raw) {
      if (!allocated.has(id)) allocated.set(id, 0);
      void hours;
    }
    raw.clear();
    for (const [id, h] of allocated) raw.set(id, h);
  }

  return [...contracts.values()].map((contract) => ({
    projectId: contract.projectId,
    hours: raw.get(contract.projectId) ?? 0,
    priorityScore: contract.priorityScore / 100,
    driftPenalty: contract.driftPenalty,
  }));
}

/** date → projectId → hours target for batch-mode placement */
export function computeBatchDayTargets(
  planDates: string[],
  contracts: Map<string, AllocationContract>,
  weeklyBudget: WeeklyBudgetItem[]
): Map<string, Map<string, number>> {
  const budgetMap = new Map(weeklyBudget.map((b) => [b.projectId, b.hours]));
  const targets = new Map<string, Map<string, number>>();

  for (const contract of contracts.values()) {
    if (contract.schedulingMode !== "batch" || contract.needsDailyWork) continue;

    const weekly = budgetMap.get(contract.projectId) ?? 0;
    if (weekly <= 0) continue;

    const batchDays = batchDaysForEffort(contract.effortSize);
    const dayIndices =
      batchDays === 1
        ? [planDates.length - 1]
        : [Math.max(0, planDates.length - 2), planDates.length - 1];

    const perDay = round1(weekly / dayIndices.length);
    for (const idx of dayIndices) {
      const date = planDates[idx];
      if (!date) continue;
      if (!targets.has(date)) targets.set(date, new Map());
      targets.get(date)!.set(contract.projectId, perDay);
    }
  }

  return targets;
}

export function getDailyExecutionTarget(
  contract: AllocationContract,
  date: string,
  batchDayTargets: Map<string, Map<string, number>>
): number {
  if (contract.schedulingMode === "batch" && !contract.needsDailyWork) {
    return batchDayTargets.get(date)?.get(contract.projectId) ?? 0;
  }
  return contract.executionDailyHours;
}

export function contractReason(contract: AllocationContract): string {
  if (contract.urgencyPressure >= 0.7 && contract.needsDailyWork) return "Urgent deadline";
  if (!contract.needsDailyWork) return "Batch scheduling";
  if (contract.layers.behavioral.neglectDays >= 3) return "Neglected — catch up";
  if (contract.maxSafeDailyCap <= 2) return "Capped — anti-drowning";
  if (contract.layers.external.importanceNorm >= 0.7) return "High real value";
  return "Balanced focus";
}

export interface ContractReallocationRecord {
  projectId: string;
  projectName: string;
  beforeHours: number;
  afterHours: number;
  reason: string;
}

/** Runtime learning overlays on contracts (replaces score-based hour multiplication). */
export function applyContractRuntimeAdjustments(input: {
  contracts: Map<string, AllocationContract>;
  projects: ProjectInput[];
  learning: LearningState[];
  weekExecution: { projectId: string; plannedHours: number; actualHours: number }[];
  settings: CapacityConfig;
  refDate: string;
}): {
  contracts: Map<string, AllocationContract>;
  reallocations: ContractReallocationRecord[];
} {
  const { contracts, projects, learning, weekExecution, settings, refDate } = input;
  const learningMap = new Map(learning.map((l) => [l.projectId, l]));
  const execMap = new Map(weekExecution.map((e) => [e.projectId, e]));
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const adjusted = new Map<string, AllocationContract>();
  const reallocations: ContractReallocationRecord[] = [];

  for (const [projectId, contract] of contracts) {
    const state = learningMap.get(projectId);
    const exec = execMap.get(projectId);
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      adjusted.set(projectId, contract);
      continue;
    }

    let executionDailyHours = contract.executionDailyHours;
    let requiredDailyEffort = contract.requiredDailyEffort;
    const reasons: string[] = [];

    if (exec && exec.plannedHours > 0) {
      const ratio = exec.actualHours / exec.plannedHours;
      if (ratio < 0.5 && exec.plannedHours >= 1) {
        executionDailyHours = round1(executionDailyHours * 0.85);
        reasons.push("Under pace — execution target reduced");
      }
    }

    if (state) {
      if (state.neglectDays >= 3) {
        const boost = Math.min(contract.maxSafeDailyCap, contract.layers.external.hoursPerDayRequired);
        if (boost > executionDailyHours) {
          executionDailyHours = round1(boost);
          requiredDailyEffort = round1(Math.max(requiredDailyEffort, boost));
          reasons.push(`Neglected ${state.neglectDays} days — catch-up boost`);
        }
      }
      if (state.overfocusStreak >= 2) {
        executionDailyHours = round1(executionDailyHours * Math.max(0.5, state.driftPenaltyMultiplier));
        reasons.push("Over-focus streak — execution trimmed");
      } else if (state.driftPenaltyMultiplier < 1) {
        executionDailyHours = round1(executionDailyHours * state.driftPenaltyMultiplier);
        reasons.push("Drift penalty active");
      }
    }

    executionDailyHours = round1(Math.min(executionDailyHours, contract.maxSafeDailyCap));

    const updated: AllocationContract = {
      ...contract,
      requiredDailyEffort,
      executionDailyHours,
    };
    adjusted.set(projectId, updated);

    if (Math.abs(updated.executionDailyHours - contract.executionDailyHours) >= 0.2) {
      reallocations.push({
        projectId,
        projectName: names.get(projectId) ?? projectId,
        beforeHours: contract.executionDailyHours,
        afterHours: updated.executionDailyHours,
        reason: reasons.join("; ") || "Contract runtime adjustment",
      });
    }
  }

  return { contracts: adjusted, reallocations };
}
