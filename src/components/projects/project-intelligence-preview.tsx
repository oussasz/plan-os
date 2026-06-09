"use client";

import { AlertTriangle } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import type { RouterOutputs } from "~/trpc/react";

type Preview = RouterOutputs["project"]["previewIntelligence"];

const BAND_VARIANT: Record<string, "default" | "secondary" | "locked"> = {
  high: "locked",
  medium: "default",
  low: "secondary",
};

export function ProjectIntelligencePreview({ preview }: { preview: Preview | undefined }) {
  if (!preview) {
    return <p className="text-sm text-slate-500">Analyzing project…</p>;
  }

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
          <p className="text-xs text-slate-500">Score</p>
          <p className="text-2xl font-bold text-slate-900">{preview.compositeScore}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-slate-500">Suggested daily</p>
          <p className="font-semibold">{preview.suggestedDailyHours}h</p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-slate-500">Max cap</p>
          <p className="font-semibold">{preview.maxDailyCap}h/day</p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-slate-500">Sessions</p>
          <p className="font-semibold">{preview.suggestedSessions}</p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-slate-500">Time of day</p>
          <p className="font-semibold capitalize">{preview.preferredTimeOfDay}</p>
        </div>
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

      <div className="rounded-lg border p-3 text-sm">
        <p className="mb-2 font-medium text-slate-700">Score breakdown</p>
        <div className="grid grid-cols-2 gap-1 text-slate-600">
          <span>Importance: {preview.scoreBreakdown.importance}</span>
          <span>Urgency: {preview.scoreBreakdown.urgency}</span>
          <span>Deadline: {preview.scoreBreakdown.deadlinePressure}</span>
          <span>Focus: {preview.scoreBreakdown.focusDemand}</span>
          <span>Flex penalty: -{preview.scoreBreakdown.flexibilityPenalty}</span>
          <span>Risk adj: {preview.scoreBreakdown.riskAdjustment}</span>
        </div>
      </div>
    </div>
  );
}
