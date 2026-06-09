"use client";

import { useState } from "react";
import { ProjectDetailDialog } from "~/components/projects/project-detail-dialog";
import { ProjectIntelligenceCard } from "~/components/projects/project-intelligence-card";
import { ProjectWizard } from "~/components/projects/project-wizard";
import { api } from "~/trpc/react";

export default function ProjectsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: projects, isLoading, isError, error } = api.project.list.useQuery();
  const { data: cards, isLoading: cardsLoading } = api.project.intelligenceCards.useQuery();

  function openProject(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  return (
    <main className="px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-violet-600">Projects</p>
          <h1 className="text-2xl font-bold text-slate-900">Project Intelligence</h1>
        </div>
        <ProjectWizard />
      </header>

      {(isLoading || cardsLoading) && <p className="text-slate-500">Loading…</p>}

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

      {!isLoading && !cardsLoading && !isError && (projects ?? []).length > 0 && (
        <ul className="flex flex-col gap-3">
          {(cards ?? []).map((card) => (
            <li key={card.projectId}>
              <ProjectIntelligenceCard card={card} onClick={() => openProject(card.projectId)} />
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
