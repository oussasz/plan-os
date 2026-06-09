"use client";

import { useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";

import { ProjectDetailDialog } from "~/components/projects/project-detail-dialog";
import { ProjectWizard } from "~/components/projects/project-wizard";
import { Badge } from "~/components/ui/badge";
import { PROJECT_TYPE_LABELS } from "~/lib/project-form";
import { api } from "~/trpc/react";

function priorityBand(level: number): string {
  if (level >= 4) return "high";
  if (level >= 3) return "medium";
  return "low";
}

export default function ProjectsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: projects, isLoading, isError, error } = api.project.list.useQuery();

  function openProject(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  return (
    <main className="px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-violet-600">Projects</p>
          <h1 className="text-2xl font-bold text-slate-900">Work Areas</h1>
        </div>
        <ProjectWizard />
      </header>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      {isError && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error.message}
        </p>
      )}

      {!isLoading && !isError && (projects ?? []).length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
          No projects yet. Tap Add Project to start planning.
        </p>
      )}

      {!isLoading && !isError && (projects ?? []).length > 0 && (
        <ul className="flex flex-col gap-3">
          {(projects ?? []).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => openProject(p.id)}
                className="flex w-full items-center justify-between rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-violet-200"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{p.name}</p>
                    {p.overImmersionRisk === "high" && (
                      <AlertTriangle
                        className="h-4 w-4 text-amber-600"
                        aria-label="High over-immersion risk"
                      />
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {PROJECT_TYPE_LABELS[p.projectType] ?? p.projectType}
                    {p.maxDailyHours ? ` · max ${Number(p.maxDailyHours)}h/day` : ""}
                    {p.deadline ? ` · due ${p.deadline.toISOString().split("T")[0]}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{p.status}</Badge>
                    <Badge variant="default">{priorityBand(p.importanceLevel)} priority</Badge>
                    <Badge variant="secondary">{p.focusDemand} focus</Badge>
                  </div>
                </div>
                <ChevronRight className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ProjectDetailDialog
        projectId={selectedId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedId(null);
        }}
      />
    </main>
  );
}
