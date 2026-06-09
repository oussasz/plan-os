"use client";

import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";

export type CloseOutProject = {
  id: string;
  name: string;
  plannedHours: number;
  estimatedHoursRemaining: number | null;
};

function suggestComplete(
  actual: number,
  planned: number,
  estimatedRemaining: number | null
): boolean {
  if (actual <= 0) return false;
  if (estimatedRemaining != null && estimatedRemaining > 0) {
    return estimatedRemaining - actual <= 0.25;
  }
  return planned > 0 && actual <= planned;
}

export function CloseOutDialog({
  date,
  projects,
  disabled,
}: {
  date: string;
  projects: CloseOutProject[];
  disabled?: boolean;
}) {
  const utils = api.useUtils();
  const [submitted, setSubmitted] = useState(false);

  const submit = api.execution.submitDaily.useMutation({
    onSuccess: async (data) => {
      await utils.planning.getToday.invalidate();
      await utils.planning.getWeek.invalidate();
      await utils.project.list.invalidate();
      await utils.project.intelligenceCards.invalidate();

      const archived = (data.completedProjects ?? []).map((c) => `${c.name}: ${c.reason}`);
      if (archived.length > 0) {
        setCompletedNotice(archived);
        setSubmitted(true);
      } else {
        setOpen(false);
        setSubmitted(false);
      }
    },
  });

  const [open, setOpen] = useState(false);
  const [wasted, setWasted] = useState("0");
  const [hours, setHours] = useState<Record<string, string>>({});
  const [markCompleted, setMarkCompleted] = useState<Record<string, boolean>>({});
  const [completedNotice, setCompletedNotice] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setHours({});
    setMarkCompleted({});
    setWasted("0");
    setCompletedNotice([]);
    setSubmitted(false);
  }, [open, date]);

  function updateHours(projectId: string, value: string, project: CloseOutProject) {
    setHours((h) => ({ ...h, [projectId]: value }));
    const actual = Number(value) || 0;
    if (suggestComplete(actual, project.plannedHours, project.estimatedHoursRemaining)) {
      setMarkCompleted((m) => ({ ...m, [projectId]: true }));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={disabled}>
          Close Day
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>End of Day Close-out</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500">
          Log actual hours. Mark a project <strong>complete</strong> to archive it and remove it
          from future schedules — including when you finish early.
        </p>

        {projects.length === 0 && (
          <p className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
            No project work was scheduled today.
          </p>
        )}

        {submitted ? (
          <div className="space-y-4">
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Day closed. Tomorrow&apos;s plan has been regenerated.
            </p>
            {completedNotice.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="font-medium">Archived as complete:</p>
                <ul className="mt-1 list-inside list-disc">
                  {completedNotice.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button type="button" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate({
              date,
              totalWastedHours: Number(wasted) || 0,
              actuals: projects.map((p) => ({
                projectId: p.id,
                actualHours: Number(hours[p.id] ?? 0) || 0,
                markCompleted: markCompleted[p.id] ?? false,
              })),
            });
          }}
        >
          {projects.map((p) => {
            const actual = Number(hours[p.id] ?? 0) || 0;
            const showEarlyHint =
              actual > 0 &&
              p.plannedHours > 0 &&
              actual < p.plannedHours &&
              !(markCompleted[p.id] ?? false);

            return (
              <div key={p.id} className="rounded-lg border bg-slate-50/80 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      Planned today {p.plannedHours}h
                      {p.estimatedHoursRemaining != null
                        ? ` · ${p.estimatedHoursRemaining}h budget left`
                        : ""}
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={markCompleted[p.id] ?? false}
                      onChange={(e) =>
                        setMarkCompleted((m) => ({ ...m, [p.id]: e.target.checked }))
                      }
                    />
                    Complete
                  </label>
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`hours-${p.id}`} className="text-xs">
                    Actual hours
                  </Label>
                  <Input
                    id={`hours-${p.id}`}
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="0"
                    value={hours[p.id] ?? ""}
                    onChange={(e) => updateHours(p.id, e.target.value, p)}
                  />
                </div>

                {showEarlyHint && (
                  <p className="mt-2 text-xs text-violet-700">
                    Finished under plan? Toggle <strong>Complete</strong> to archive and stop
                    scheduling.
                  </p>
                )}

                {(markCompleted[p.id] ?? false) && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    Will be archived as done — removed from tomorrow&apos;s plan.
                  </p>
                )}
              </div>
            );
          })}

          <div className="space-y-1">
            <Label htmlFor="wasted">Wasted hours</Label>
            <Input
              id="wasted"
              type="number"
              min={0}
              step={0.5}
              value={wasted}
              onChange={(e) => setWasted(e.target.value)}
            />
          </div>

          {submit.isError && (
            <p className="text-sm text-red-600">{submit.error.message}</p>
          )}

          <Button type="submit" disabled={submit.isPending || projects.length === 0}>
            {submit.isPending ? "Submitting…" : "Submit & Replan Tomorrow"}
          </Button>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
