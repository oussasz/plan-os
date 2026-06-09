"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { ChipSelect } from "~/components/ui/chip-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import {
  INITIAL_PROJECT_FORM,
  projectToForm,
  toDraftInput,
  type ProjectDraftForm,
} from "~/lib/project-form";
import { api, type RouterOutputs } from "~/trpc/react";
import { ProjectIntelligencePreview } from "./project-intelligence-preview";
import { ProjectWizardStepBasic } from "./project-wizard-step-basic";
import { ProjectWizardStepIntelligence } from "./project-wizard-step-intelligence";

type ProjectRow = RouterOutputs["project"]["list"][number];

const TYPE_LABELS: Record<string, string> = {
  client: "Client Work",
  personal: "Personal",
  maintenance: "Maintenance",
  learning: "Learning",
  emergency: "Emergency",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function ProjectDetailDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const [tab, setTab] = useState<"overview" | "edit" | "linked">("overview");
  const [editStep, setEditStep] = useState(0);
  const [form, setForm] = useState<ProjectDraftForm>(INITIAL_PROJECT_FORM);

  const { data: detail } = api.project.get.useQuery(
    { id: project?.id ?? "" },
    { enabled: open && !!project?.id }
  );

  const draftInput = useMemo(() => toDraftInput(form), [form]);
  const { data: preview, isFetching } = api.project.previewIntelligence.useQuery(draftInput, {
    enabled: open && tab === "edit" && editStep >= 1 && form.name.trim().length > 0,
  });

  const update = api.project.update.useMutation({
    onSuccess: async () => {
      await utils.project.list.invalidate();
      await utils.project.get.invalidate();
      await utils.planning.getToday.invalidate();
      await utils.planning.getWeek.invalidate();
      setTab("overview");
      setEditStep(0);
    },
  });

  const deleteProject = api.project.delete.useMutation({
    onSuccess: async () => {
      await utils.project.list.invalidate();
      onOpenChange(false);
    },
  });

  const createEvent = api.fixedEvent.create.useMutation({
    onSuccess: () => void utils.project.get.invalidate(),
  });
  const deleteEvent = api.fixedEvent.delete.useMutation({
    onSuccess: () => void utils.project.get.invalidate(),
  });
  const createAdHoc = api.adHoc.create.useMutation({
    onSuccess: () => void utils.project.get.invalidate(),
  });
  const deleteAdHoc = api.adHoc.delete.useMutation({
    onSuccess: () => void utils.project.get.invalidate(),
  });

  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventStart, setEventStart] = useState("09:00");
  const [eventEnd, setEventEnd] = useState("10:00");
  const [adHocTitle, setAdHocTitle] = useState("");

  useEffect(() => {
    if (project && open) {
      setForm(projectToForm(project));
      setTab("overview");
      setEditStep(0);
    }
  }, [project, open]);

  if (!project) return null;

  const intel = detail?.intelligence;
  const p = detail?.project ?? project;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{p.name}</DialogTitle>
        </DialogHeader>

        <div className="mb-4 flex gap-2">
          {(["overview", "edit", "linked"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`min-h-10 flex-1 rounded-lg border px-2 text-sm font-medium capitalize ${
                tab === t
                  ? "border-violet-600 bg-violet-50 text-violet-800"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{p.status}</Badge>
              {intel && <Badge variant="default">{intel.priorityBand} priority</Badge>}
            </div>

            <div className="rounded-xl border bg-slate-50 p-4">
              <DetailRow label="Type" value={TYPE_LABELS[p.projectType] ?? p.projectType} />
              <DetailRow label="Effort" value={p.effortSize} />
              <DetailRow label="Importance" value={`${p.importanceLevel}/5`} />
              <DetailRow
                label="Urgency"
                value={`${p.urgencyLevel}${p.urgencyOverride ? " (manual)" : " (auto)"}`}
              />
              <DetailRow label="Focus demand" value={p.focusDemand} />
              <DetailRow label="Over-immersion risk" value={p.overImmersionRisk} />
              <DetailRow label="Flexibility" value={p.flexibility} />
              <DetailRow label="Scheduling" value={p.schedulingMode} />
              <DetailRow
                label="Est. hours"
                value={p.estimatedHoursRemaining ? `${Number(p.estimatedHoursRemaining)}h` : "—"}
              />
              <DetailRow
                label="Max daily"
                value={p.maxDailyHours ? `${Number(p.maxDailyHours)}h` : "—"}
              />
              <DetailRow
                label="Deadline"
                value={p.deadline ? p.deadline.toISOString().split("T")[0]! : "None"}
              />
            </div>

            {p.notes && (
              <div className="rounded-xl border p-3 text-sm">
                <p className="mb-1 font-medium text-slate-700">Notes</p>
                <p className="text-slate-600">{p.notes}</p>
              </div>
            )}

            {intel && <ProjectIntelligencePreview preview={intel} />}

            <ChipSelect
              label="Quick status"
              value={form.status}
              onChange={(status) => {
                setForm({ ...form, status });
                update.mutate({ id: project.id, status });
              }}
              options={[
                { value: "active", label: "Active" },
                { value: "paused", label: "Paused" },
                { value: "done", label: "Done" },
              ]}
            />

            <Button className="w-full" onClick={() => setTab("edit")}>
              Edit project
            </Button>
          </div>
        )}

        {tab === "edit" && (
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`h-2 w-8 rounded-full ${editStep === i ? "bg-violet-600" : "bg-slate-200"}`}
                />
              ))}
            </div>

            {editStep === 0 && <ProjectWizardStepBasic form={form} setForm={setForm} />}
            {editStep === 1 && (
              <ProjectWizardStepIntelligence
                form={form}
                setForm={setForm}
                autoUrgency={preview?.autoUrgencyLevel}
              />
            )}
            {editStep === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <textarea
                    id="notes"
                    className="flex min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
                <ChipSelect
                  label="Status"
                  value={form.status}
                  onChange={(status) => setForm({ ...form, status })}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "paused", label: "Paused" },
                    { value: "done", label: "Done" },
                  ]}
                />
                <ProjectIntelligencePreview preview={preview} />
              </>
            )}

            <div className="flex gap-2">
              {editStep > 0 && (
                <Button variant="outline" className="flex-1" onClick={() => setEditStep(editStep - 1)}>
                  Back
                </Button>
              )}
              {editStep < 2 && (
                <Button
                  className="flex-1"
                  disabled={!form.name.trim()}
                  onClick={() => setEditStep(editStep + 1)}
                >
                  Next
                </Button>
              )}
              {editStep === 2 && (
                <Button
                  className="flex-1"
                  disabled={update.isPending || isFetching || !preview}
                  onClick={() => update.mutate({ id: project.id, ...draftInput })}
                >
                  {update.isPending ? "Saving…" : "Save changes"}
                </Button>
              )}
            </div>
          </div>
        )}

        {tab === "linked" && (
          <div className="space-y-6">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Fixed events</h3>
              <ul className="mb-3 space-y-2">
                {(detail?.project.fixedEvents ?? []).map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>
                      {e.title} · {e.date.toISOString().split("T")[0]} {e.startTime.slice(0, 5)}–
                      {e.endTime.slice(0, 5)}
                    </span>
                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() => deleteEvent.mutate({ id: e.id })}
                    >
                      Remove
                    </button>
                  </li>
                ))}
                {(detail?.project.fixedEvents ?? []).length === 0 && (
                  <p className="text-sm text-slate-500">No linked events.</p>
                )}
              </ul>
              <div className="space-y-2 rounded-lg border p-3">
                <Input
                  placeholder="Event title"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                />
                <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                <div className="flex gap-2">
                  <Input type="time" value={eventStart} onChange={(e) => setEventStart(e.target.value)} />
                  <Input type="time" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} />
                </div>
                <Button
                  size="sm"
                  disabled={!eventTitle || !eventDate || createEvent.isPending}
                  onClick={() => {
                    createEvent.mutate({
                      title: eventTitle,
                      date: eventDate,
                      startTime: eventStart,
                      endTime: eventEnd,
                      projectId: project.id,
                    });
                    setEventTitle("");
                  }}
                >
                  Add event
                </Button>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Ad-hoc boosts</h3>
              <ul className="mb-3 space-y-2">
                {(detail?.project.adHocItems ?? []).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>{a.title}</span>
                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() => deleteAdHoc.mutate({ id: a.id })}
                    >
                      Remove
                    </button>
                  </li>
                ))}
                {(detail?.project.adHocItems ?? []).length === 0 && (
                  <p className="text-sm text-slate-500">No ad-hoc items.</p>
                )}
              </ul>
              <div className="flex gap-2">
                <Input
                  placeholder="Ad-hoc title"
                  value={adHocTitle}
                  onChange={(e) => setAdHocTitle(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={!adHocTitle || createAdHoc.isPending}
                  onClick={() => {
                    createAdHoc.mutate({ title: adHocTitle, projectId: project.id });
                    setAdHocTitle("");
                  }}
                >
                  Add
                </Button>
              </div>
            </section>
          </div>
        )}

        <Button
          variant="destructive"
          className="mt-4 w-full"
          onClick={() => {
            if (confirm(`Delete ${project.name}?`)) deleteProject.mutate({ id: project.id });
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete project
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectListItem({
  project,
  onOpen,
}: {
  project: ProjectRow;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-violet-200"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{project.name}</p>
        <p className="text-sm text-slate-500">
          {TYPE_LABELS[project.projectType] ?? project.projectType}
          {project.maxDailyHours ? ` · max ${Number(project.maxDailyHours)}h/day` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="secondary">{project.status}</Badge>
          <Badge variant="default">{project.focusDemand} focus</Badge>
        </div>
      </div>
      <ChevronRight className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
    </button>
  );
}
