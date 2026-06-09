"use client";

import { AlertTriangle } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { PROJECT_TYPE_LABELS } from "~/lib/project-form";
import type { RouterOutputs } from "~/trpc/react";
import { ProjectIntelligencePreview } from "./project-intelligence-preview";

type Detail = RouterOutputs["project"]["getById"];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function ProjectDetailView({ detail }: { detail: Detail }) {
  const { project, intelligence, weeklyAllocation } = detail;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Signals
        </h3>
        <div className="rounded-lg border bg-white px-3">
          <Field label="Type" value={PROJECT_TYPE_LABELS[project.projectType] ?? project.projectType} />
          <Field label="Status" value={project.status} />
          <Field label="Effort" value={project.effortSize} />
          <Field
            label="Est. hours"
            value={project.estimatedHoursRemaining ? `${Number(project.estimatedHoursRemaining)}h` : "—"}
          />
          <Field label="Importance" value={`${project.importanceLevel} / 5`} />
          <Field
            label="Urgency"
            value={
              project.urgencyOverride
                ? `${project.urgencyLevel} (manual)`
                : `${project.urgencyLevel} (auto)`
            }
          />
          <Field label="Focus demand" value={project.focusDemand} />
          <Field label="Over-immersion risk" value={project.overImmersionRisk} />
          <Field label="Flexibility" value={project.flexibility} />
          <Field
            label="Deadline"
            value={project.deadline ? project.deadline.toISOString().split("T")[0] : "—"}
          />
          {project.notes ? (
            <div className="py-2 text-sm">
              <p className="text-slate-500">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-900">{project.notes}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Engine output (read-only)
        </h3>
        <div className="rounded-lg border bg-slate-50 px-3">
          <Field label="Scheduling mode" value={project.schedulingMode} />
          <Field label="Max daily hours" value={project.maxDailyHours ? `${Number(project.maxDailyHours)}h` : "—"} />
          <Field label="Deep focus" value={project.requiresDeepFocus ? "Yes" : "No"} />
          <Field label="Importance weight" value={project.importanceWeight} />
          {weeklyAllocation ? (
            <Field label="This week planned" value={`${weeklyAllocation.plannedHours}h`} />
          ) : (
            <Field label="This week planned" value="Not scheduled yet" />
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Live analysis
        </h3>
        <ProjectIntelligencePreview preview={intelligence} />
      </section>

      {project.planningLearning && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Learning state
          </h3>
          <div className="rounded-lg border px-3">
            <Field label="Overfocus streak" value={project.planningLearning.overfocusStreak} />
            <Field label="Neglect days" value={project.planningLearning.neglectDays} />
            <Field
              label="Drift multiplier"
              value={Number(project.planningLearning.driftPenaltyMultiplier)}
            />
            <Field label="Avg actual share" value={`${Number(project.planningLearning.avgActualShare)}%`} />
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Fixed events ({project.fixedEvents.length})
        </h3>
        {project.fixedEvents.length === 0 ? (
          <p className="text-sm text-slate-500">No linked events.</p>
        ) : (
          <ul className="space-y-2">
            {project.fixedEvents.map((e) => (
              <li key={e.id} className="rounded-lg border bg-white p-3 text-sm">
                <p className="font-medium">{e.title}</p>
                <p className="text-slate-500">
                  {e.date.toISOString().split("T")[0]} · {e.startTime}–{e.endTime} · {e.eventType}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ad-hoc boosts ({project.adHocItems.length})
        </h3>
        {project.adHocItems.length === 0 ? (
          <p className="text-sm text-slate-500">No linked ad-hoc items.</p>
        ) : (
          <ul className="space-y-2">
            {project.adHocItems.map((a) => (
              <li key={a.id} className="rounded-lg border bg-white p-3 text-sm">
                <p className="font-medium">{a.title}</p>
                <p className="text-slate-500">
                  Boost {Number(a.urgencyBoost)}
                  {a.expiresAt ? ` · expires ${a.expiresAt.toISOString().split("T")[0]}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {project.overImmersionRisk === "high" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          High over-immersion risk — daily cap enforced by engine.
        </div>
      )}
    </div>
  );
}
