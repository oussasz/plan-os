import {
  applyContractRuntimeAdjustments,
  buildAllocationContracts,
  type AllocationContract,
} from "./allocation-contract";
import { analyzeProjectIntelligence } from "./project-intelligence";
import type {
  CapacityConfig,
  LearningState,
  PriorityBand,
  ProjectInput,
} from "./types";
import { DEFAULT_CAPACITY } from "./types";
import { daysBetween } from "./week-utils";

export type FocusLoadLevel = "normal" | "heavy" | "overloaded";
export type TrendDirection = "up" | "down" | "stable";
export type RiskLevel = "low" | "medium" | "high";

export interface ExecutionSnapshot {
  projectId: string;
  plannedHours: number;
  actualHours: number;
}

export interface ReallocationRecord {
  projectId: string;
  projectName: string;
  beforeHours: number;
  afterHours: number;
  reason: string;
}

export interface DriftAlert {
  projectId: string;
  projectName: string;
  sharePct: number;
  message: string;
  action: string;
}

export interface SmartSuggestion {
  id: string;
  severity: "info" | "warning" | "critical";
  projectId?: string;
  message: string;
}

export interface PlannedVsActualRow {
  projectId: string;
  projectName: string;
  plannedHours: number;
  actualHours: number;
  varianceHours: number;
  variancePct: number | null;
}

export interface ProjectIntelligenceCard {
  projectId: string;
  name: string;
  status: string;
  priorityScore: number;
  priorityBand: PriorityBand;
  overloadRisk: RiskLevel;
  suggestedHoursToday: number;
  suggestedHoursWeek: number;
  burnoutRisk: RiskLevel;
  trend: TrendDirection;
  plannedHoursToday: number;
  actualHoursToday: number;
  plannedHoursWeek: number;
  actualHoursWeek: number;
  needsDailyWork: boolean;
  hoursPerDayRequired: number;
  schedulingMode: string;
  suggestions: string[];
}

export interface CognitiveDayState {
  focusLoad: FocusLoadLevel;
  focusLoadLabel: string;
  focusLoadDetail: string;
  scheduledHoursRemaining: number;
  availableHoursRemaining: number;
  utilizationPct: number;
  driftAlerts: DriftAlert[];
  suggestions: SmartSuggestion[];
  plannedVsActual: PlannedVsActualRow[];
  reallocations: ReallocationRecord[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function projectNameMap(projects: ProjectInput[]): Map<string, string> {
  return new Map(projects.map((p) => [p.id, p.name]));
}

/** Cap any single project above contract maxSafeDailyCap (or global share fallback). */
export function enforceAntiDrift(input: {
  remainingHours: Map<string, number>;
  projects: ProjectInput[];
  dayCapacityHours: number;
  settings: CapacityConfig;
  contracts?: Map<string, AllocationContract>;
}): { capped: Map<string, number>; alerts: DriftAlert[] } {
  const { remainingHours, projects, dayCapacityHours, settings, contracts } = input;
  const maxShare = settings.maxProjectSharePct / 100;
  const defaultMaxHours = dayCapacityHours * maxShare;
  const capped = new Map(remainingHours);
  const alerts: DriftAlert[] = [];
  const names = projectNameMap(projects);

  let total = [...capped.values()].reduce((s, h) => s + h, 0);
  if (total <= 0) return { capped, alerts };

  const overflow: { projectId: string; excess: number }[] = [];
  for (const [projectId, hours] of capped) {
    const maxHours = contracts?.get(projectId)?.maxSafeDailyCap ?? defaultMaxHours;
    if (hours > maxHours) {
      const excess = hours - maxHours;
      capped.set(projectId, round1(maxHours));
      overflow.push({ projectId, excess });
      const sharePct = Math.round((hours / total) * 100);
      alerts.push({
        projectId,
        projectName: names.get(projectId) ?? projectId,
        sharePct,
        message: `STOP: over-focus detected — ${sharePct}% of today (max ${settings.maxProjectSharePct}%)`,
        action: `Capped at ${round1(maxHours)}h and redistributed ${round1(excess)}h`,
      });
    }
  }

  if (overflow.length === 0) return { capped, alerts };

  const recipients = [...capped.entries()].filter(
    ([id, h]) => h > 0 && !overflow.some((o) => o.projectId === id)
  );
  const freed = overflow.reduce((s, o) => s + o.excess, 0);
  if (recipients.length > 0) {
    const perRecipient = freed / recipients.length;
    for (const [id, h] of recipients) {
      capped.set(id, round1(h + perRecipient));
    }
  }

  return { capped, alerts };
}

export function computeFocusLoad(input: {
  scheduledHoursRemaining: number;
  availableHoursRemaining: number;
  activeProjectCount: number;
  fixedEventCount: number;
}): Pick<CognitiveDayState, "focusLoad" | "focusLoadLabel" | "focusLoadDetail" | "utilizationPct"> {
  const { scheduledHoursRemaining, availableHoursRemaining, activeProjectCount, fixedEventCount } =
    input;
  const available = Math.max(0.5, availableHoursRemaining);
  const utilizationPct = Math.round((scheduledHoursRemaining / available) * 100);

  let focusLoad: FocusLoadLevel = "normal";
  let focusLoadLabel = "Normal Load";
  let focusLoadDetail = "Capacity is balanced for today.";

  if (utilizationPct > 100 || scheduledHoursRemaining > availableHoursRemaining + 0.5) {
    focusLoad = "overloaded";
    focusLoadLabel = "Overloaded";
    focusLoadDetail = `Scheduled ${round1(scheduledHoursRemaining)}h in ${round1(availableHoursRemaining)}h remaining — reduce scope or defer.`;
  } else if (utilizationPct >= 85 || activeProjectCount >= 5) {
    focusLoad = "heavy";
    focusLoadLabel = "Heavy Load";
    focusLoadDetail = `${utilizationPct}% of remaining capacity booked${fixedEventCount > 0 ? ` with ${fixedEventCount} fixed event(s)` : ""}.`;
  } else if (utilizationPct < 40 && activeProjectCount > 0) {
    focusLoadDetail = `Light schedule — ${round1(availableHoursRemaining - scheduledHoursRemaining)}h open for catch-up.`;
  }

  return { focusLoad, focusLoadLabel, focusLoadDetail, utilizationPct };
}

export function detectDriftFromBlocks(input: {
  plannedByProject: Map<string, number>;
  projects: ProjectInput[];
  dayCapacityHours: number;
  settings: CapacityConfig;
  contracts?: Map<string, AllocationContract>;
}): DriftAlert[] {
  const total = [...input.plannedByProject.values()].reduce((s, h) => s + h, 0);
  if (total <= 0) return [];
  const maxShare = input.settings.maxProjectSharePct;
  const defaultCap = input.dayCapacityHours * (maxShare / 100);
  const names = projectNameMap(input.projects);
  const alerts: DriftAlert[] = [];

  for (const [projectId, hours] of input.plannedByProject) {
    const cap = input.contracts?.get(projectId)?.maxSafeDailyCap ?? defaultCap;
    const sharePct = Math.round((hours / total) * 100);
    if (hours > cap + 0.1 || sharePct > maxShare) {
      alerts.push({
        projectId,
        projectName: names.get(projectId) ?? projectId,
        sharePct,
        message: `STOP: over-focus detected — ${names.get(projectId)} at ${round1(hours)}h (cap ${round1(cap)}h)`,
        action: `Redistribute below ${round1(cap)}h safe cap`,
      });
    }
  }
  return alerts;
}

export function buildSmartSuggestions(input: {
  projects: ProjectInput[];
  learning: LearningState[];
  weekExecution: ExecutionSnapshot[];
  contracts: Map<string, AllocationContract>;
  today: string;
  driftAlerts: DriftAlert[];
  reallocations: ReallocationRecord[];
}): SmartSuggestion[] {
  const { projects, learning, weekExecution, contracts, today, driftAlerts, reallocations } = input;
  const suggestions: SmartSuggestion[] = [];
  const learningMap = new Map(learning.map((l) => [l.projectId, l]));
  const execMap = new Map(weekExecution.map((e) => [e.projectId, e]));

  for (const alert of driftAlerts) {
    suggestions.push({
      id: `drift-${alert.projectId}`,
      severity: "critical",
      projectId: alert.projectId,
      message: `${alert.message}. ${alert.action}`,
    });
  }

  for (const project of projects.filter((p) => p.status === "active")) {
    const state = learningMap.get(project.id);
    const intel = analyzeProjectIntelligence(
      {
        name: project.name,
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
      },
      DEFAULT_CAPACITY,
      today,
      state
    );

    if (!intel.layers.nature.needsDailyWork && project.deadline) {
      suggestions.push({
        id: `batch-${project.id}`,
        severity: "info",
        projectId: project.id,
        message: `${project.name} does not need daily work — batch scheduling recommended (${intel.layers.external.hoursPerDayRequired}h/day pace).`,
      });
    }

    if (project.deadline) {
      const daysLeft = daysBetween(today, project.deadline);
      const hoursLeft = project.estimatedHoursRemaining ?? intel.estimatedHours;
      const hoursPerDayNeeded = intel.layers.external.hoursPerDayRequired;
      if (daysLeft > 0 && intel.layers.nature.needsDailyWork && hoursPerDayNeeded > intel.suggestedDailyHours * 1.5) {
        suggestions.push({
          id: `risk-${project.id}`,
          severity: "warning",
          projectId: project.id,
          message: `${project.name} is risky — needs ${round1(hoursPerDayNeeded)}h/day but only ${intel.suggestedDailyHours}h suggested. Will take longer than expected.`,
        });
      }
      if (daysLeft > 0 && intel.layers.nature.needsDailyWork && hoursLeft / intel.suggestedDailyHours > daysLeft * 1.2) {
        suggestions.push({
          id: `split-${project.id}`,
          severity: "warning",
          projectId: project.id,
          message: `${project.name} should be split — ${round1(hoursLeft)}h remaining in ${daysLeft} days exceeds sustainable pace.`,
        });
      }
    }

    const exec = execMap.get(project.id);
    const contract = contracts.get(project.id);

    if (state && state.neglectDays >= 3) {
      suggestions.push({
        id: `neglect-${project.id}`,
        severity: "warning",
        projectId: project.id,
        message: `${project.name} needs attention — neglected ${state.neglectDays} days.`,
      });
    }

    if (exec && exec.plannedHours > 0 && exec.actualHours < exec.plannedHours * 0.6) {
      suggestions.push({
        id: `slow-${project.id}`,
        severity: "info",
        projectId: project.id,
        message: `${project.name} is behind pace — priority may decrease this week unless catch-up happens.`,
      });
    }

    if (contract && contract.driftPenalty < 0.85) {
      suggestions.push({
        id: `penalty-${project.id}`,
        severity: "info",
        projectId: project.id,
        message: `${project.name} priority reduced by learning loop (drift ×${contract.driftPenalty}).`,
      });
    }
  }

  for (const r of reallocations.slice(0, 3)) {
    suggestions.push({
      id: `realloc-${r.projectId}`,
      severity: r.afterHours > r.beforeHours ? "warning" : "info",
      projectId: r.projectId,
      message: `Reallocated ${r.projectName}: ${r.beforeHours}h → ${r.afterHours}h (${r.reason})`,
    });
  }

  const seen = new Set<string>();
  return suggestions.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

function computeTrend(
  plannedWeek: number,
  actualWeek: number,
  learning?: LearningState
): TrendDirection {
  if (actualWeek > plannedWeek * 1.15) return "up";
  if (actualWeek < plannedWeek * 0.7 && plannedWeek > 0) return "down";
  if (learning && learning.neglectDays >= 2) return "down";
  if (learning && learning.overfocusStreak >= 2) return "up";
  return "stable";
}

function riskFromSignals(
  overImmersionRisk: string,
  focusDemand: string,
  overfocusStreak: number
): RiskLevel {
  if (overImmersionRisk === "high" && focusDemand === "high") return "high";
  if (overImmersionRisk === "high" || overfocusStreak >= 2) return "medium";
  return "low";
}

export function buildProjectIntelligenceCards(input: {
  projects: ProjectInput[];
  learning: LearningState[];
  weekExecution: ExecutionSnapshot[];
  todayExecution: ExecutionSnapshot[];
  todayPlanned: Map<string, number>;
  weekPlanned: Map<string, number>;
  contracts: Map<string, AllocationContract>;
  settings: CapacityConfig;
  today: string;
}): ProjectIntelligenceCard[] {
  const {
    projects,
    learning,
    weekExecution,
    todayExecution,
    todayPlanned,
    weekPlanned,
    contracts,
    settings,
    today,
  } = input;

  const learningMap = new Map(learning.map((l) => [l.projectId, l]));
  const weekExecMap = new Map(weekExecution.map((e) => [e.projectId, e]));
  const todayExecMap = new Map(todayExecution.map((e) => [e.projectId, e]));

  return projects
    .filter((p) => p.status === "active")
    .map((project) => {
      const state = learningMap.get(project.id);
      const draft = {
        name: project.name,
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
      const intel = analyzeProjectIntelligence(draft, settings, today, state);
      const contract = contracts.get(project.id);
      const weekExec = weekExecMap.get(project.id);
      const todayExec = todayExecMap.get(project.id);

      const plannedHoursWeek = weekPlanned.get(project.id) ?? 0;
      const actualHoursWeek = weekExec?.actualHours ?? 0;
      const plannedHoursToday = todayPlanned.get(project.id) ?? 0;
      const actualHoursToday = todayExec?.actualHours ?? 0;

      const cardSuggestions: string[] = [];
      if (!intel.layers.nature.needsDailyWork) {
        cardSuggestions.push(
          `Batch recommended — ${intel.layers.external.hoursPerDayRequired}h/day pace, no daily work needed`
        );
      }
      if (intel.warnings.length > 0) cardSuggestions.push(...intel.warnings.slice(0, 2));
      if (state && state.overfocusStreak >= 2) {
        cardSuggestions.push("Over-focus streak — system is pulling hours back");
      }
      if (project.deadline) {
        const daysLeft = daysBetween(today, project.deadline);
        const hoursLeft = project.estimatedHoursRemaining ?? intel.estimatedHours;
        if (daysLeft > 0 && hoursLeft / daysLeft > intel.suggestedDailyHours) {
          cardSuggestions.push("At risk of taking longer than expected");
        }
      }

      return {
        projectId: project.id,
        name: project.name,
        status: project.status,
        priorityScore: contract?.priorityScore ?? intel.priorityScore,
        priorityBand: intel.priorityBand,
        overloadRisk: riskFromSignals(
          project.overImmersionRisk,
          project.focusDemand,
          state?.overfocusStreak ?? 0
        ),
        suggestedHoursToday: contract?.executionDailyHours ?? intel.suggestedDailyHours,
        suggestedHoursWeek: round1(weekPlanned.get(project.id) ?? (contract?.executionDailyHours ?? intel.suggestedDailyHours) * 5),
        burnoutRisk: riskFromSignals(
          project.overImmersionRisk,
          project.focusDemand,
          state?.overfocusStreak ?? 0
        ),
        trend: computeTrend(plannedHoursWeek, actualHoursWeek, state),
        plannedHoursToday: round1(plannedHoursToday),
        actualHoursToday: round1(actualHoursToday),
        plannedHoursWeek: round1(plannedHoursWeek),
        actualHoursWeek: round1(actualHoursWeek),
        needsDailyWork: intel.layers.nature.needsDailyWork,
        hoursPerDayRequired: intel.layers.external.hoursPerDayRequired,
        schedulingMode: intel.schedulingMode,
        suggestions: cardSuggestions.slice(0, 3),
      };
    });
}

export function buildCognitiveDayState(input: {
  projects: ProjectInput[];
  learning: LearningState[];
  weekExecution: ExecutionSnapshot[];
  todayExecution: ExecutionSnapshot[];
  todayPlanned: Map<string, number>;
  todayBlocksPlannedRemaining: Map<string, number>;
  contracts: Map<string, AllocationContract>;
  settings: CapacityConfig;
  today: string;
  scheduledHoursRemaining: number;
  availableHoursRemaining: number;
  fixedEventCount: number;
  reallocations: ReallocationRecord[];
  driftAlerts: DriftAlert[];
}): CognitiveDayState {
  const focus = computeFocusLoad({
    scheduledHoursRemaining: input.scheduledHoursRemaining,
    availableHoursRemaining: input.availableHoursRemaining,
    activeProjectCount: input.projects.filter((p) => p.status === "active").length,
    fixedEventCount: input.fixedEventCount,
  });

  const todayExecMap = new Map(input.todayExecution.map((e) => [e.projectId, e]));
  const names = projectNameMap(input.projects);

  const plannedVsActual: PlannedVsActualRow[] = [];
  for (const [projectId, planned] of input.todayPlanned) {
    const actual = todayExecMap.get(projectId)?.actualHours ?? 0;
    const variance = round1(actual - planned);
    plannedVsActual.push({
      projectId,
      projectName: names.get(projectId) ?? projectId,
      plannedHours: round1(planned),
      actualHours: round1(actual),
      varianceHours: variance,
      variancePct: planned > 0 ? Math.round((variance / planned) * 100) : null,
    });
  }

  const blockDrift = detectDriftFromBlocks({
    plannedByProject: input.todayBlocksPlannedRemaining,
    projects: input.projects,
    dayCapacityHours: input.settings.dailyCapacityHours,
    settings: input.settings,
    contracts: input.contracts,
  });

  const allDrift = [...input.driftAlerts, ...blockDrift].filter(
    (a, i, arr) => arr.findIndex((x) => x.projectId === a.projectId) === i
  );

  const suggestions = buildSmartSuggestions({
    projects: input.projects,
    learning: input.learning,
    weekExecution: input.weekExecution,
    contracts: input.contracts,
    today: input.today,
    driftAlerts: allDrift,
    reallocations: input.reallocations,
  });

  return {
    ...focus,
    scheduledHoursRemaining: round1(input.scheduledHoursRemaining),
    availableHoursRemaining: round1(input.availableHoursRemaining),
    driftAlerts: allDrift,
    suggestions,
    plannedVsActual: plannedVsActual.sort((a, b) => b.plannedHours - a.plannedHours),
    reallocations: input.reallocations,
  };
}

export function getActiveAllocationContracts(
  projects: ProjectInput[],
  learning: LearningState[],
  settings: CapacityConfig,
  refDate: string
): Map<string, AllocationContract> {
  return buildAllocationContracts(projects, learning, settings, refDate);
}

export { applyContractRuntimeAdjustments };
