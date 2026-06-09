"use client";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ChipSelect } from "~/components/ui/chip-select";
import type { ProjectDraftForm } from "~/lib/project-form";

export function ProjectWizardStepBasic({
  form,
  setForm,
}: {
  form: ProjectDraftForm;
  setForm: (f: ProjectDraftForm) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Project Name</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Client redesign"
          required
        />
      </div>

      <ChipSelect
        label="Type"
        value={form.projectType}
        onChange={(projectType) => setForm({ ...form, projectType })}
        options={[
          { value: "client", label: "Client Work" },
          { value: "personal", label: "Personal" },
          { value: "maintenance", label: "Maintenance" },
          { value: "learning", label: "Learning" },
          { value: "emergency", label: "Emergency" },
        ]}
      />

      <div className="space-y-2">
        <Label htmlFor="deadline">Deadline</Label>
        <Input
          id="deadline"
          type="date"
          value={form.deadline}
          onChange={(e) => setForm({ ...form, deadline: e.target.value })}
        />
      </div>

      <ChipSelect
        label="Estimated Effort"
        value={form.effortSize}
        onChange={(effortSize) => setForm({ ...form, effortSize })}
        options={[
          { value: "small", label: "Small (~8h)" },
          { value: "medium", label: "Medium (~24h)" },
          { value: "large", label: "Large (~60h)" },
        ]}
      />

      <div className="space-y-2">
        <Label htmlFor="hours">Or exact hours (optional)</Label>
        <Input
          id="hours"
          type="number"
          min={0}
          step={0.5}
          placeholder="Overrides effort size"
          value={form.hours}
          onChange={(e) => setForm({ ...form, hours: e.target.value })}
        />
      </div>
    </div>
  );
}
