import type { Project } from "../../../../generated/prisma";
import type { ProjectDraft } from "~/server/planning/types";

export function dbProjectToDraft(project: Project): ProjectDraft {
  return {
    name: project.name,
    projectType: project.projectType as ProjectDraft["projectType"],
    effortSize: project.effortSize as ProjectDraft["effortSize"],
    importanceLevel: project.importanceLevel,
    urgencyLevel: project.urgencyLevel as ProjectDraft["urgencyLevel"],
    urgencyOverride: project.urgencyOverride,
    focusDemand: project.focusDemand as ProjectDraft["focusDemand"],
    overImmersionRisk: project.overImmersionRisk as ProjectDraft["overImmersionRisk"],
    flexibility: project.flexibility as ProjectDraft["flexibility"],
    deadline: project.deadline ? project.deadline.toISOString().split("T")[0]! : null,
    estimatedHoursRemaining: project.estimatedHoursRemaining
      ? Number(project.estimatedHoursRemaining)
      : null,
  };
}
