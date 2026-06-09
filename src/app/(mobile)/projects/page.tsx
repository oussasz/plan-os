"use client";

import { useState } from "react";

import {
  ProjectDetailDialog,
  ProjectListItem,
} from "~/components/projects/project-detail-dialog";
import { ProjectWizard } from "~/components/projects/project-wizard";
import { api, type RouterOutputs } from "~/trpc/react";

type ProjectRow = RouterOutputs["project"]["list"][number];

export default function ProjectsPage() {
  const { data: projects, isLoading } = api.project.list.useQuery();
  const [selected, setSelected] = useState<ProjectRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  function openProject(project: ProjectRow) {
    setSelected(project);
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

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (projects ?? []).length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
          No projects yet. Tap Add Project to start planning.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {(projects ?? []).map((p) => (
            <li key={p.id}>
              <ProjectListItem project={p} onOpen={() => openProject(p)} />
            </li>
          ))}
        </ul>
      )}

      <ProjectDetailDialog
        project={selected}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelected(null);
        }}
      />
    </main>
  );
}
