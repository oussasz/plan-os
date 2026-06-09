"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  INITIAL_PROJECT_FORM,
  toDraftInput,
  type ProjectDraftForm,
} from "~/lib/project-form";
import { api } from "~/trpc/react";
import { ProjectIntelligencePreview } from "./project-intelligence-preview";
import { ProjectWizardStepBasic } from "./project-wizard-step-basic";
import { ProjectWizardStepIntelligence } from "./project-wizard-step-intelligence";

export function ProjectWizard() {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProjectDraftForm>(INITIAL_PROJECT_FORM);
  const [error, setError] = useState("");

  const draftInput = useMemo(() => toDraftInput(form), [form]);

  const { data: preview, isFetching } = api.project.previewIntelligence.useQuery(draftInput, {
    enabled: step >= 1 && form.name.trim().length > 0,
  });

  const create = api.project.create.useMutation({
    onSuccess: async () => {
      await utils.project.list.invalidate();
      await utils.planning.getToday.invalidate();
      await utils.planning.getWeek.invalidate();
      setOpen(false);
      setStep(0);
      setForm(INITIAL_PROJECT_FORM);
      setError("");
    },
    onError: (err) => setError(err.message),
  });

  useEffect(() => {
    if (!open) {
      setStep(0);
      setForm(INITIAL_PROJECT_FORM);
      setError("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add Project</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Project — Smart Input</DialogTitle>
        </DialogHeader>

        <div className="mb-4 flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-2 w-8 rounded-full ${step === i ? "bg-violet-600" : "bg-slate-200"}`}
            />
          ))}
        </div>

        {step === 0 && <ProjectWizardStepBasic form={form} setForm={setForm} showNotes />}
        {step === 1 && (
          <ProjectWizardStepIntelligence
            form={form}
            setForm={setForm}
            autoUrgency={preview?.autoUrgencyLevel}
          />
        )}
        {step === 2 && <ProjectIntelligencePreview preview={preview} />}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          {step > 0 && (
            <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < 2 && (
            <Button
              className="flex-1"
              disabled={step === 0 && !form.name.trim()}
              onClick={() => setStep(step + 1)}
            >
              Next
            </Button>
          )}
          {step === 2 && (
            <Button
              className="flex-1"
              disabled={create.isPending || isFetching || !preview}
              onClick={() => create.mutate(draftInput)}
            >
              {create.isPending ? "Creating…" : "Create Project"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
