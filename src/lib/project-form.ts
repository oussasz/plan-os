import type { RouterOutputs } from "~/trpc/react";

export type ProjectRecord = RouterOutputs["project"]["list"][number];

export type ProjectDraftForm = {
  name: string;
  projectType: "client" | "personal" | "maintenance" | "learning" | "emergency";
  effortSize: "small" | "medium" | "large";
  importanceLevel: 1 | 2 | 3 | 4 | 5;
  urgencyLevel: "low" | "medium" | "high" | "critical";
  urgencyOverride: boolean;
  focusDemand: "low" | "medium" | "high";
  overImmersionRisk: "low" | "medium" | "high";
  flexibility: "fixed" | "flexible";
  deadline: string;
  hours: string;
  notes: string;
  status: "active" | "paused" | "done";
};

export const INITIAL_PROJECT_FORM: ProjectDraftForm = {
  name: "",
  projectType: "personal",
  effortSize: "medium",
  importanceLevel: 3,
  urgencyLevel: "medium",
  urgencyOverride: false,
  focusDemand: "medium",
  overImmersionRisk: "medium",
  flexibility: "flexible",
  deadline: "",
  hours: "",
  notes: "",
  status: "active",
};

export function toDraftInput(form: ProjectDraftForm) {
  return {
    name: form.name,
    projectType: form.projectType,
    effortSize: form.effortSize,
    importanceLevel: form.importanceLevel,
    urgencyLevel: form.urgencyLevel,
    urgencyOverride: form.urgencyOverride,
    focusDemand: form.focusDemand,
    overImmersionRisk: form.overImmersionRisk,
    flexibility: form.flexibility,
    deadline: form.deadline || null,
    estimatedHoursRemaining: form.hours ? Number(form.hours) : null,
    notes: form.notes,
  };
}

export function projectToForm(project: ProjectRecord): ProjectDraftForm {
  return {
    name: project.name,
    projectType: project.projectType as ProjectDraftForm["projectType"],
    effortSize: project.effortSize as ProjectDraftForm["effortSize"],
    importanceLevel: project.importanceLevel as ProjectDraftForm["importanceLevel"],
    urgencyLevel: project.urgencyLevel as ProjectDraftForm["urgencyLevel"],
    urgencyOverride: project.urgencyOverride,
    focusDemand: project.focusDemand as ProjectDraftForm["focusDemand"],
    overImmersionRisk: project.overImmersionRisk as ProjectDraftForm["overImmersionRisk"],
    flexibility: project.flexibility as ProjectDraftForm["flexibility"],
    deadline: project.deadline ? project.deadline.toISOString().split("T")[0]! : "",
    hours: project.estimatedHoursRemaining ? String(Number(project.estimatedHoursRemaining)) : "",
    notes: project.notes ?? "",
    status: project.status as ProjectDraftForm["status"],
  };
}

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  client: "Client Work",
  personal: "Personal",
  maintenance: "Maintenance",
  learning: "Learning",
  emergency: "Emergency",
};
