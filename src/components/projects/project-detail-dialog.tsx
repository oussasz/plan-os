"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  INITIAL_PROJECT_FORM,
  projectToForm,
  toDraftInput,
  type ProjectDraftForm,
} from "~/lib/project-form";
import { api } from "~/trpc/react";
import { ProjectDetailView } from "./project-detail-view";
import { ProjectIntelligencePreview } from "./project-intelligence-preview";
import { ProjectRelatedItems } from "./project-related-items";
import { ProjectWizardStepBasic } from "./project-wizard-step-basic";
import { ProjectWizardStepIntelligence } from "./project-wizard-step-intelligence";

type Mode = "view" | "edit";

export function ProjectDetailDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const [mode, setMode] = useState<Mode>("view");
  const [editStep, setEditStep] = useState(0);
  const [form, setForm] = useState<ProjectDraftForm>(INITIAL_PROJECT_FORM);
  const [actionError, setActionError] = useState("");

  const {
    data: detail,
    isLoading,
    isError,
    error,
    refetch,
  } = api.project.getById.useQuery(
    { id: projectId! },
    { enabled: open && !!projectId, retry: false }
  );

  const draftInput = useMemo(() => toDraftInput(form), [form]);

  const { data: preview, isFetching: previewLoading } = api.project.previewIntelligence.useQuery(
    draftInput,
    { enabled: mode === "edit" && editStep >= 1 && form.name.trim().length > 0 }
  );

  const update = api.project.update.useMutation({
    onSuccess: async () => {
      await utils.project.list.invalidate();
      await utils.project.getById.invalidate({ id: projectId! });
      await utils.planning.getToday.invalidate();
      await utils.planning.getWeek.invalidate();
      setMode("view");
      setEditStep(0);
      setActionError("");
    },
    onError: (err) => setActionError(err.message),
  });

  const remove = api.project.delete.useMutation({
    onSuccess: async () => {
      await utils.project.list.invalidate();
      onOpenChange(false);
    },
    onError: (err) => setActionError(err.message),
  });

  useEffect(() => {
    if (detail?.project) {
      setForm(projectToForm(detail.project));
    }
  }, [detail?.project]);

  useEffect(() => {
    if (!open) {
      setMode("view");
      setEditStep(0);
      setActionError("");
    }
  }, [open]);

  function handleSave() {
    if (!projectId) return;
    update.mutate({
      id: projectId,
      status: form.status,
      ...toDraftInput(form),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{detail?.project.name ?? "Project"}</DialogTitle>
        </DialogHeader>

        {isLoading && <p className="text-sm text-slate-500">Loading project…</p>}

        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error.message}
          </div>
        )}

        {detail && mode === "view" && (
          <>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => setMode("edit")}>
                Edit project
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm(`Delete "${detail.project.name}"? This cannot be undone.`)) {
                    remove.mutate({ id: detail.project.id });
                  }
                }}
                disabled={remove.isPending}
              >
                Delete
              </Button>
            </div>
            {actionError && <p className="text-sm text-red-600">{actionError}</p>}
            <ProjectDetailView detail={detail} />
            <ProjectRelatedItems
              projectId={detail.project.id}
              detail={detail}
              onChanged={() => void refetch()}
            />
          </>
        )}

        {detail && mode === "edit" && (
          <>
            <div className="mb-4 flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`h-2 w-8 rounded-full ${editStep === i ? "bg-violet-600" : "bg-slate-200"}`}
                />
              ))}
            </div>

            {editStep === 0 && <ProjectWizardStepBasic form={form} setForm={setForm} showNotes showStatus />}
            {editStep === 1 && (
              <ProjectWizardStepIntelligence
                form={form}
                setForm={setForm}
                autoUrgency={preview?.autoUrgencyLevel}
              />
            )}
            {editStep === 2 && <ProjectIntelligencePreview preview={preview} />}

            {actionError && <p className="text-sm text-red-600">{actionError}</p>}

            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (editStep === 0) {
                    setForm(projectToForm(detail.project));
                    setMode("view");
                  } else {
                    setEditStep(editStep - 1);
                  }
                }}
              >
                {editStep === 0 ? "Cancel" : "Back"}
              </Button>
              {editStep < 2 ? (
                <Button
                  className="flex-1"
                  disabled={editStep === 0 && !form.name.trim()}
                  onClick={() => setEditStep(editStep + 1)}
                >
                  Next
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  disabled={update.isPending || previewLoading || !preview}
                  onClick={handleSave}
                >
                  {update.isPending ? "Saving…" : "Save changes"}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
