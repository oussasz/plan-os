"use client";

import { ProjectDialog } from "~/components/projects/project-dialog";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

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
        <ProjectDialog />
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
                <p className="font-semibold text-slate-900">{p.name}</p>
                <p className="text-sm text-slate-500">
                  {p.schedulingMode}
                  {p.deadline
                    ? ` · due ${p.deadline.toISOString().split("T")[0]}`
                    : ""}
                </p>
                <Badge variant="secondary" className="mt-2">
                  {p.status}
                </Badge>
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
