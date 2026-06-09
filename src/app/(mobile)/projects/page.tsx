"use client";

import { AlertTriangle } from "lucide-react";

import { ProjectWizard } from "~/components/projects/project-wizard";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

const TYPE_LABELS: Record<string, string> = {
  client: "Client",
  personal: "Personal",
  maintenance: "Maintenance",
  learning: "Learning",
  emergency: "Emergency",
};

function priorityBand(level: number): string {
  if (level >= 4) return "high";
  if (level >= 3) return "medium";
  return "low";
}

export default function ProjectsPage() {
  const { data: projects, isLoading } = api.project.list.useQuery();
  const deleteProject = api.project.delete.useMutation({
    onSuccess: () => void api.useUtils().project.list.invalidate(),
  });

  return (
    <main className="px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-violet-600">Projects</p>
          <h1 className="text-2xl font-bold text-slate-900">Work Areas</h1>
        </div>
        <ProjectWizard />
      </header>

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (projects ?? []).length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
          No projects yet. Tap Add Project to start planning.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {(projects ?? []).map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl border bg-white p-4 shadow-sm"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{p.name}</p>
                  {p.overImmersionRisk === "high" && (
                    <AlertTriangle className="h-4 w-4 text-amber-600" aria-label="High over-immersion risk" />
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {TYPE_LABELS[p.projectType] ?? p.projectType}
                  {p.maxDailyHours ? ` · max ${Number(p.maxDailyHours)}h/day` : ""}
                  {p.deadline ? ` · due ${p.deadline.toISOString().split("T")[0]}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{p.status}</Badge>
                  <Badge variant="default">{priorityBand(p.importanceLevel)} priority</Badge>
                  <Badge variant="secondary">{p.focusDemand} focus</Badge>
                </div>
              </div>
              <button
                type="button"
                className="text-sm text-red-600"
                onClick={() => {
                  if (confirm(`Delete ${p.name}?`)) deleteProject.mutate({ id: p.id });
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
