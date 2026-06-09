"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import type { RouterOutputs } from "~/trpc/react";

type Preview = RouterOutputs["project"]["previewIntelligence"];

const BAND_VARIANT: Record<string, "default" | "secondary" | "locked"> = {
  high: "locked",
  medium: "default",
  low: "secondary",
};

function LayerCard({
  title,
  score,
  children,
}: {
  title: string;
  score: number;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-medium text-slate-700">{title}</p>
        <span className="text-xs font-semibold text-slate-500">{score}</span>
      </div>
      <div className="space-y-1 text-slate-600">{children}</div>
    </div>
  );
}

export function ProjectIntelligencePreview({ preview }: { preview: Preview | undefined }) {
  if (!preview) {
    return <p className="text-sm text-slate-500">Analyzing project…</p>;
  }

  const { layers } = preview;
  const paceLabel = layers.nature.needsDailyWork ? "Daily work" : "Batch / spread";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Project Priority</p>
          <Badge variant={BAND_VARIANT[preview.priorityBand] ?? "default"} className="mt-1 text-sm">
            {preview.priorityBand}
          </Badge>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Priority score</p>
          <p className="text-2xl font-bold text-slate-900">{preview.priorityScore}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border bg-violet-50 p-3">
          <p className="text-slate-500">Pace required</p>
          <p className="font-semibold">{layers.external.hoursPerDayRequired}h/day</p>
        </div>
        <div className="rounded-lg border bg-violet-50 p-3">
          <p className="text-slate-500">Execution target</p>
          <p className="font-semibold">{preview.executionDailyHours ?? preview.suggestedDailyHours}h/day</p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-slate-500">Max cap</p>
          <p className="font-semibold">{preview.maxDailyCap}h/day</p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-slate-500">Scheduling</p>
          <p className="font-semibold capitalize">
            {paceLabel} · {preview.schedulingMode}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <LayerCard title="External pressure" score={layers.external.score}>
          <p>Time pressure: {Math.round(layers.external.timePressure * 100)}%</p>
          <p>Importance: {layers.external.importanceNorm.toFixed(1)}/5</p>
          <p>
            Days left: {layers.external.daysLeft ?? "—"} · Urgency:{" "}
            {layers.external.effectiveUrgency}
          </p>
          {layers.external.fitsWithoutCramming && (
            <p className="text-emerald-700">Fits before deadline without cramming</p>
          )}
        </LayerCard>

        <LayerCard title="Work nature" score={layers.nature.score}>
          <p>Sustainable cap: {layers.nature.sustainableDailyCap}h/day</p>
          <p>Dampener: {Math.round(layers.nature.natureDampener * 100)}%</p>
          <p>
            {layers.nature.needsDailyWork
              ? "Needs daily attention"
              : "Can be batched — no daily pressure"}
          </p>
        </LayerCard>

        <LayerCard title="Behavioral risk" score={layers.behavioral.score}>
          <p>Multiplier: {Math.round(layers.behavioral.multiplier * 100)}%</p>
          <p>Behavioral cap: {layers.behavioral.behavioralCap}h/day</p>
          {(layers.behavioral.overfocusStreak > 0 || layers.behavioral.neglectDays > 0) && (
            <p>
              Streak {layers.behavioral.overfocusStreak} · Neglect {layers.behavioral.neglectDays}d
            </p>
          )}
        </LayerCard>
      </div>

      {preview.warnings.length > 0 && (
        <div className="space-y-2">
          {preview.warnings.map((w) => (
            <div
              key={w}
              className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {preview.reasons.length > 0 && (
        <div className="rounded-lg border p-3 text-sm text-slate-600">
          <p className="mb-1 font-medium text-slate-700">Reasons</p>
          <ul className="list-inside list-disc space-y-0.5">
            {preview.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
