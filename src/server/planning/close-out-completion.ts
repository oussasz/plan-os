import { EFFORT_HOURS, type EffortSize } from "./types";

export interface CloseOutProjectInput {
  projectId: string;
  actualHours: number;
  plannedHours: number;
  markCompleted: boolean;
  estimatedHoursRemaining: number | null;
  effortSize: EffortSize;
}

export interface CloseOutProjectResult {
  projectId: string;
  status: "active" | "done";
  estimatedHoursRemaining: number | null;
  completed: boolean;
  reason: string;
}

const COMPLETION_THRESHOLD_H = 0.25;

export function resolveCloseOutProjectUpdate(
  input: CloseOutProjectInput
): CloseOutProjectResult {
  const {
    projectId,
    actualHours,
    plannedHours,
    markCompleted,
    estimatedHoursRemaining,
    effortSize,
  } = input;

  if (markCompleted) {
    return {
      projectId,
      status: "done",
      estimatedHoursRemaining: 0,
      completed: true,
      reason:
        actualHours < plannedHours && plannedHours > 0
          ? "Finished early — archived as complete"
          : "Marked complete during close-out",
    };
  }

  const budget =
    estimatedHoursRemaining != null && estimatedHoursRemaining > 0
      ? estimatedHoursRemaining
      : null;

  if (budget != null) {
    const remaining = Math.round((budget - actualHours) * 10) / 10;
    if (remaining <= COMPLETION_THRESHOLD_H) {
      return {
        projectId,
        status: "done",
        estimatedHoursRemaining: 0,
        completed: true,
        reason: `Budget exhausted (${budget}h total, ${actualHours}h today)`,
      };
    }
    return {
      projectId,
      status: "active",
      estimatedHoursRemaining: remaining,
      completed: false,
      reason: `${remaining}h remaining of ${budget}h budget`,
    };
  }

  return {
    projectId,
    status: "active",
    estimatedHoursRemaining: null,
    completed: false,
    reason:
      actualHours > 0
        ? `Logged ${actualHours}h — set hour budget or mark complete to archive (${EFFORT_HOURS[effortSize]}h effort estimate)`
        : "No work logged",
  };
}

/** Suggest marking complete when work was done but under plan with no remaining budget context. */
export function suggestMarkCompleted(input: {
  actualHours: number;
  plannedHours: number;
  estimatedHoursRemaining: number | null;
}): boolean {
  if (input.actualHours <= 0) return false;
  if (input.estimatedHoursRemaining != null && input.estimatedHoursRemaining > 0) {
    const after = input.estimatedHoursRemaining - input.actualHours;
    return after <= COMPLETION_THRESHOLD_H;
  }
  return input.plannedHours > 0 && input.actualHours <= input.plannedHours;
}
