"use client";

import { useState } from "react";

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

type ProjectRow = { id: string; name: string };

export function CloseOutDialog({
  date,
  projects,
  disabled,
}: {
  date: string;
  projects: ProjectRow[];
  disabled?: boolean;
}) {
  const utils = api.useUtils();
  const submit = api.execution.submitDaily.useMutation({
    onSuccess: async () => {
      await utils.planning.getToday.invalidate();
      await utils.planning.getWeek.invalidate();
      setOpen(false);
    },
  });

  const [open, setOpen] = useState(false);
  const [wasted, setWasted] = useState("0");
  const [hours, setHours] = useState<Record<string, string>>({});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={disabled}>
          Close Day
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>End of Day Close-out</DialogTitle>
        </DialogHeader>
        <form
          className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate({
              date,
              totalWastedHours: Number(wasted) || 0,
              actuals: projects.map((p) => ({
                projectId: p.id,
                actualHours: Number(hours[p.id] ?? 0) || 0,
              })),
            });
          }}
        >
          {projects.map((p) => (
            <div key={p.id} className="space-y-1">
              <Label>{p.name}</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                placeholder="Actual hours"
                value={hours[p.id] ?? ""}
                onChange={(e) => setHours((h) => ({ ...h, [p.id]: e.target.value }))}
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label>Wasted hours</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={wasted}
              onChange={(e) => setWasted(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submit.isPending}>
            {submit.isPending ? "Submitting…" : "Submit & Replan Tomorrow"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
