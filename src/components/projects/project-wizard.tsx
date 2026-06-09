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
import { api } from "~/trpc/react";
import { ProjectIntelligencePreview } from "./project-intelligence-preview";
import { ProjectWizardStepBasic } from "./project-wizard-step-basic";
import { ProjectWizardStepIntelligence } from "./project-wizard-step-intelligence";

export type ProjectDraftForm = {
  name: string;
  projectType: "client" | "personal" | "maintenance" | "learning" | "emergency";
  effortSize: "small" | "medium" | "large";
  importanceLevel: 1 | 2 | 3 | 4 | 5;
  urgencyLevel: "low" | "medium" | "high" | "critical";
  urgencyOverride: boolean;
  focusDemand: "low" | "medium" | "high";
  overImmersionRisk: "low" | "medium" | "high";
  flexibility: "fixed" | "flexible";
  deadline: string;
  hours: string;
};

const INITIAL: ProjectDraftForm = {
  name: "",
  projectType: "personal",
  effortSize: "medium",
  importanceLevel: 3,
  urgencyLevel: "medium",
  urgencyOverride: false,
  focusDemand: "medium",
  overImmersionRisk: "medium",
  flexibility: "flexible",
  deadline: "",
  hours: "",
};

function toDraftInput(form: ProjectDraftForm) {
  return {
    name: form.name,
    projectType: form.projectType,
    effortSize: form.effortSize,
    importanceLevel: form.importanceLevel,
    urgencyLevel: form.urgencyLevel,
    urgencyOverride: form.urgencyOverride,
    focusDemand: form.focusDemand,
    overImmersionRisk: form.overImmersionRisk,
    flexibility: form.flexibility,
    deadline: form.deadline || null,
    estimatedHoursRemaining: form.hours ? Number(form.hours) : null,
  };
}

export function ProjectWizard() {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProjectDraftForm>(INITIAL);

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
      setForm(INITIAL);
    },
  });

  useEffect(() => {
    if (!open) {
      setStep(0);
      setForm(INITIAL);
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

        {step === 0 && <ProjectWizardStepBasic form={form} setForm={setForm} />}
        {step === 1 && (
          <ProjectWizardStepIntelligence
            form={form}
            setForm={setForm}
            autoUrgency={preview?.autoUrgencyLevel}
          />
        )}
        {step === 2 && <ProjectIntelligencePreview preview={preview} />}

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
