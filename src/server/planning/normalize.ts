import type {
  AdHocInput,
  BlockType,
  FixedEventInput,
  ProjectInput,
  SchedulingMode,
} from "./types";

export interface PlanningItem {
  id: string;
  title: string;
  source: "project" | "fixed_event" | "ad_hoc";
  isLocked: boolean;
  blockType: BlockType;
  schedulingMode?: SchedulingMode;
  projectId: string | null;
  date?: string;
  startTime?: string;
  endTime?: string;
  deadline: string | null;
  estimatedHoursRemaining: number | null;
  importanceWeight: number;
  urgencyBoost: number;
  requiresDeepFocus: boolean;
}

export function normalizeInputs(input: {
  projects: ProjectInput[];
  fixedEvents: FixedEventInput[];
  adHoc: AdHocInput[];
  refDate: string;
}): PlanningItem[] {
  const items: PlanningItem[] = [];

  for (const p of input.projects.filter((x) => x.status === "active")) {
    items.push({
      id: p.id,
      title: p.name,
      source: "project",
      isLocked: false,
      blockType: p.requiresDeepFocus ? "deep_work" : "execution",
      schedulingMode: p.schedulingMode,
      projectId: p.id,
      deadline: p.deadline,
      estimatedHoursRemaining: p.estimatedHoursRemaining,
      importanceWeight: p.importanceWeight,
      urgencyBoost: 0,
      requiresDeepFocus: p.requiresDeepFocus,
    });
  }

  for (const e of input.fixedEvents) {
    const blockType: BlockType =
      e.eventType === "meeting"
        ? "meeting"
        : e.eventType === "obligation"
          ? "obligation"
          : "appointment";
    items.push({
      id: e.id,
      title: e.title,
      source: "fixed_event",
      isLocked: true,
      blockType,
      projectId: e.projectId,
      date: e.date,
      startTime: e.startTime,
      endTime: e.endTime,
      deadline: null,
      estimatedHoursRemaining: null,
      importanceWeight: 5,
      urgencyBoost: 0,
      requiresDeepFocus: false,
    });
  }

  for (const a of input.adHoc) {
    if (a.expiresAt && a.expiresAt < input.refDate) continue;
    items.push({
      id: a.id,
      title: a.title,
      source: "ad_hoc",
      isLocked: false,
      blockType: "execution",
      projectId: a.projectId,
      deadline: null,
      estimatedHoursRemaining: null,
      importanceWeight: 5,
      urgencyBoost: Number(a.urgencyBoost),
      requiresDeepFocus: false,
    });
  }

  return items;
}
