import type { LearningState } from "./types";

export interface ActualRow {
  projectId: string;
  plannedHours: number;
  actualHours: number;
}

export interface FeedbackResult {
  efficiencyScore: number;
  totalProductive: number;
  driftProjects: { projectId: string; reason: string }[];
  learningUpdates: LearningState[];
}

export function analyzeExecution(
  actuals: ActualRow[],
  totalWasted: number,
  maxSharePct: number
): FeedbackResult {
  const totalProductive = actuals.reduce((s, a) => s + a.actualHours, 0);
  const totalAll = totalProductive + totalWasted;
  const driftProjects: { projectId: string; reason: string }[] = [];

  for (const a of actuals) {
    const share = totalProductive > 0 ? a.actualHours / totalProductive : 0;
    if (a.plannedHours > 0 && a.actualHours > a.plannedHours * 1.25) {
      driftProjects.push({
        projectId: a.projectId,
        reason: `Over plan by ${Math.round((a.actualHours / a.plannedHours - 1) * 100)}%`,
      });
    } else if (share > maxSharePct / 100) {
      driftProjects.push({
        projectId: a.projectId,
        reason: `Share ${Math.round(share * 100)}% exceeds cap`,
      });
    }
  }

  const variances = actuals
    .filter((a) => a.plannedHours > 0)
    .map((a) => Math.abs(a.actualHours - a.plannedHours) / a.plannedHours);
  const avgVariance = variances.length ? variances.reduce((s, v) => s + v, 0) / variances.length : 0;
  const adherence = Math.max(0, 1 - avgVariance) * 50;
  const productiveRatio = totalAll > 0 ? totalProductive / totalAll : 1;
  const productiveScore = productiveRatio * 30;
  const driftPenalty = Math.max(0, 20 - driftProjects.length * 5);
  const efficiencyScore = Math.round(Math.min(100, adherence + productiveScore + driftPenalty));

  return {
    efficiencyScore,
    totalProductive: Math.round(totalProductive * 10) / 10,
    driftProjects,
    learningUpdates: [],
  };
}

export function computeLearningUpdates(
  actuals: ActualRow[],
  existing: LearningState[],
  refDate: string,
  activeProjectIds: string[]
): LearningState[] {
  const totalActual = actuals.reduce((s, a) => s + a.actualHours, 0);
  const fairShare = activeProjectIds.length > 0 ? 100 / activeProjectIds.length : 100;
  const existingMap = new Map(existing.map((l) => [l.projectId, l]));

  return activeProjectIds.map((projectId) => {
    const prev = existingMap.get(projectId);
    const actual = actuals.find((a) => a.projectId === projectId);
    const actualHours = actual?.actualHours ?? 0;
    const planned = actual?.plannedHours ?? 0;
    const actualShare = totalActual > 0 ? (actualHours / totalActual) * 100 : 0;
    const prevAvg = prev?.avgActualShare ?? 0;
    const newAvg = Math.round(((prevAvg * 3 + actualShare) / 4) * 100) / 100;

    let overfocusStreak = prev?.overfocusStreak ?? 0;
    let neglectDays = prev?.neglectDays ?? 0;
    let multiplier = prev?.driftPenaltyMultiplier ?? 1;

    if (actualHours > 0) neglectDays = 0;
    else neglectDays = (prev?.neglectDays ?? 0) + 1;

    if (newAvg > fairShare + 15 || (planned > 0 && actualHours > planned * 1.25)) {
      overfocusStreak += 1;
      multiplier = Math.max(0.3, multiplier - Math.min(0.4, overfocusStreak * 0.1));
    } else {
      overfocusStreak = 0;
      if (multiplier < 1) multiplier = Math.min(1, multiplier + 0.05);
    }

    return {
      projectId,
      overfocusStreak,
      neglectDays,
      driftPenaltyMultiplier: Math.round(multiplier * 100) / 100,
      avgActualShare: newAvg,
      lastTouchedAt: actualHours > 0 ? refDate : (prev?.lastTouchedAt ?? null),
    };
  });
}
