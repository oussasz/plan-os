export type BlockType =
  | "deep_work"
  | "execution"
  | "admin"
  | "meeting"
  | "break"
  | "buffer"
  | "lunch"
  | "appointment"
  | "obligation";

export type SchedulingMode = "batch" | "spread" | "flexible";
export type ProjectType = "client" | "personal" | "maintenance" | "learning" | "emergency";
export type EffortSize = "small" | "medium" | "large";
export type UrgencyLevel = "low" | "medium" | "high" | "critical";
export type FocusDemand = "low" | "medium" | "high";
export type OverImmersionRisk = "low" | "medium" | "high";
export type Flexibility = "fixed" | "flexible";
export type PriorityBand = "high" | "medium" | "low";
export type PreferredTimeOfDay = "morning" | "afternoon" | "flexible";

export const EFFORT_HOURS: Record<EffortSize, number> = {
  small: 8,
  medium: 24,
  large: 60,
};

export interface CapacityConfig {
  dailyCapacityHours: number;
  workStartTime: string;
  blockMinutes: number;
  breakMinutes: number;
  lunchMinutes: number;
  lunchStartTime: string;
  maxProjectSharePct: number;
  maxContextSwitches: number;
  bufferMinutes: number;
  workDays: number[];
  weekdayHours: Record<string, number>;
  timezone: string;
}

export interface ProjectDraft {
  name: string;
  projectType: ProjectType;
  effortSize: EffortSize;
  importanceLevel: number;
  urgencyLevel: UrgencyLevel;
  urgencyOverride: boolean;
  focusDemand: FocusDemand;
  overImmersionRisk: OverImmersionRisk;
  flexibility: Flexibility;
  deadline: string | null;
  estimatedHoursRemaining: number | null;
}

export interface ProjectInput {
  id: string;
  name: string;
  projectType: ProjectType;
  status: string;
  schedulingMode: SchedulingMode;
  effortSize: EffortSize;
  importanceLevel: number;
  importanceWeight: number;
  urgencyLevel: UrgencyLevel;
  urgencyOverride: boolean;
  focusDemand: FocusDemand;
  overImmersionRisk: OverImmersionRisk;
  flexibility: Flexibility;
  deadline: string | null;
  estimatedHoursRemaining: number | null;
  maxDailyHours: number | null;
  requiresDeepFocus: boolean;
  preferredTimeOfDay: PreferredTimeOfDay;
}

export interface ProjectIntelligenceResult {
  priorityBand: PriorityBand;
  compositeScore: number;
  suggestedDailyHours: number;
  suggestedSessions: number;
  preferredTimeOfDay: PreferredTimeOfDay;
  maxDailyCap: number;
  schedulingMode: SchedulingMode;
  estimatedHours: number;
  requiresDeepFocus: boolean;
  autoUrgencyLevel: UrgencyLevel;
  warnings: string[];
  scoreBreakdown: {
    importance: number;
    urgency: number;
    deadlinePressure: number;
    focusDemand: number;
    flexibilityPenalty: number;
    riskAdjustment: number;
  };
  reasons: string[];
}

export interface FixedEventInput {
  id: string;
  title: string;
  eventType: string;
  date: string;
  startTime: string;
  endTime: string;
  projectId: string | null;
}

export interface AdHocInput {
  id: string;
  title: string;
  urgencyBoost: number;
  expiresAt: string | null;
  projectId: string | null;
}

export interface LearningState {
  projectId: string;
  overfocusStreak: number;
  neglectDays: number;
  driftPenaltyMultiplier: number;
  avgActualShare: number;
  lastTouchedAt: string | null;
}

export interface ScoredProject {
  project: ProjectInput;
  score: number;
  urgency: number;
  importance: number;
  effortFit: number;
  context: number;
  fairness: number;
  dependency: number;
  historical: number;
  driftPenalty: number;
}

export interface PackedBlock {
  startTime: string;
  endTime: string;
  blockType: BlockType;
  projectId: string | null;
  fixedEventId: string | null;
  isLocked: boolean;
  sortOrder: number;
  reasonShort: string;
}

export interface WeeklyAllocationResult {
  projectId: string;
  plannedHours: number;
  priorityScore: number;
  driftPenalty: number;
}

export interface MonthlyBudget {
  projectId: string;
  projectName: string;
  hoursBudget: number;
  milestoneNote: string;
}

export interface WeekMilestone {
  weekStart: string;
  projectId: string;
  note: string;
}

export interface EngineResult {
  monthStart: string;
  monthBudgets: MonthlyBudget[];
  weekMilestones: WeekMilestone[];
  weekStart: string;
  totalCapacityHours: number;
  weeklyAllocations: WeeklyAllocationResult[];
  dailyPlans: {
    date: string;
    totalCapacityHours: number;
    blocks: PackedBlock[];
  }[];
}

export const DEFAULT_CAPACITY: CapacityConfig = {
  dailyCapacityHours: 10,
  workStartTime: "09:00",
  blockMinutes: 90,
  breakMinutes: 15,
  lunchMinutes: 60,
  lunchStartTime: "12:30",
  maxProjectSharePct: 40,
  maxContextSwitches: 3,
  bufferMinutes: 60,
  workDays: [1, 2, 3, 4, 5],
  weekdayHours: { "1": 10, "2": 10, "3": 10, "4": 10, "5": 10, "6": 0, "7": 0 },
  timezone: "Africa/Algiers",
};
