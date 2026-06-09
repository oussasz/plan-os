"use client";

import { Badge } from "~/components/ui/badge";
import { ChipSelect } from "~/components/ui/chip-select";
import type { ProjectDraftForm } from "~/lib/project-form";

export function ProjectWizardStepIntelligence({
  form,
  setForm,
  autoUrgency,
}: {
  form: ProjectDraftForm;
  setForm: (f: ProjectDraftForm) => void;
  autoUrgency?: string;
}) {
  return (
    <div className="space-y-5">
      <ChipSelect
        label="Importance (1–5) — Real Value"
        value={String(form.importanceLevel) as "1" | "2" | "3" | "4" | "5"}
        onChange={(v) => setForm({ ...form, importanceLevel: Number(v) as 1 | 2 | 3 | 4 | 5 })}
        options={[
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3" },
          { value: "4", label: "4" },
          { value: "5", label: "5" },
        ]}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Urgency Level</p>
          <button
            type="button"
            className="text-xs text-violet-600"
            onClick={() => setForm({ ...form, urgencyOverride: !form.urgencyOverride })}
          >
            {form.urgencyOverride ? "Using manual" : "Auto — tap to override"}
          </button>
        </div>
        {!form.urgencyOverride && autoUrgency && (
          <Badge variant="secondary">Auto: {autoUrgency}</Badge>
        )}
        {form.urgencyOverride && (
          <ChipSelect
            label=""
            value={form.urgencyLevel}
            onChange={(urgencyLevel) => setForm({ ...form, urgencyLevel })}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "critical", label: "Critical" },
            ]}
          />
        )}
      </div>

      <ChipSelect
        label="Focus Demand"
        value={form.focusDemand}
        onChange={(focusDemand) => setForm({ ...form, focusDemand })}
        options={[
          { value: "low", label: "Low (admin)" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High (deep work)" },
        ]}
      />

      <ChipSelect
        label="Risk of Over-Immersion"
        value={form.overImmersionRisk}
        onChange={(overImmersionRisk) => setForm({ ...form, overImmersionRisk })}
        options={[
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ]}
      />

      <ChipSelect
        label="Flexibility"
        value={form.flexibility}
        onChange={(flexibility) => setForm({ ...form, flexibility })}
        options={[
          { value: "fixed", label: "Fixed" },
          { value: "flexible", label: "Flexible" },
        ]}
      />
    </div>
  );
}
