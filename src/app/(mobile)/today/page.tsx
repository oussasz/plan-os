"use client";

import { useMemo } from "react";
import { RefreshCw } from "lucide-react";

import {
  CloseOutDialog,
  type CloseOutProject,
} from "~/components/plan/close-out-dialog";
import { CognitiveDayPanel } from "~/components/plan/cognitive-day-panel";
import { TodayAllocationSummary } from "~/components/plan/today-allocation-summary";
import { TimelineBlocks } from "~/components/plan/timeline-blocks";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function blockHours(start: string, end: string): number {
  return (parseTimeToMinutes(end) - parseTimeToMinutes(start)) / 60;
}

export default function TodayPage() {
  const utils = api.useUtils();
  const { data, isLoading } = api.planning.getToday.useQuery();
  const { data: projects } = api.project.list.useQuery();
  const regenerate = api.planning.regenerate.useMutation({
    onSuccess: () => void utils.planning.getToday.invalidate(),
  });

  const plan = data?.plan;
  const totalHours = plan ? Number(plan.totalCapacityHours) : 0;
  const remainingBlocks = (plan?.blocks ?? []).filter((b) => {
    if (data?.nowMinutes === undefined) return true;
    return parseTimeToMinutes(b.endTime) > data.nowMinutes;
  });
  const remainingHours = remainingBlocks
    .filter((b) => b.projectId && !["break", "lunch", "buffer"].includes(b.blockType))
    .reduce((sum, b) => sum + blockHours(b.startTime, b.endTime), 0);

  const closeOutProjects = useMemo((): CloseOutProject[] => {
    const map = new Map<string, CloseOutProject>();
    for (const b of plan?.blocks ?? []) {
      if (!b.projectId || ["break", "lunch", "buffer"].includes(b.blockType)) continue;
      const h = blockHours(b.startTime, b.endTime);
      const name = b.project?.name ?? b.reasonShort;
      const existing = map.get(b.projectId);
      if (existing) {
        existing.plannedHours = Math.round((existing.plannedHours + h) * 10) / 10;
      } else {
        map.set(b.projectId, { id: b.projectId, name, plannedHours: h, estimatedHoursRemaining: null });
      }
    }
    for (const p of projects ?? []) {
      if (p.status !== "active") continue;
      const entry = map.get(p.id);
      const est = p.estimatedHoursRemaining ? Number(p.estimatedHoursRemaining) : null;
      if (entry) {
        entry.estimatedHoursRemaining = est;
      }
    }
    return [...map.values()].sort((a, b) => b.plannedHours - a.plannedHours);
  }, [plan?.blocks, projects]);

  return (
    <main className="px-4 py-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-violet-600">Today</p>
          <h1 className="text-2xl font-bold text-slate-900">Cognitive Controller</h1>
          <p className="text-sm text-slate-500">
            {data?.nowTime ? `Now ${data.nowTime}` : "Today"}
            {data?.timezone ? ` (${data.timezone})` : ""}
            {" · "}
            {Math.round(remainingHours * 10) / 10}h left · {remainingBlocks.length} blocks
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => regenerate.mutate({ fromDate: data?.today })}
            disabled={regenerate.isPending || data?.isClosed}
            aria-label="Regenerate"
          >
            <RefreshCw className={`h-4 w-4 ${regenerate.isPending ? "animate-spin" : ""}`} />
          </Button>
          <CloseOutDialog
            date={data?.today ?? new Date().toISOString().split("T")[0]!}
            projects={closeOutProjects}
            disabled={data?.isClosed}
          />
        </div>
      </header>

      {data?.isClosed && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Day closed. Tomorrow&apos;s plan has been regenerated.
        </p>
      )}

      {isLoading ? (
        <p className="text-slate-500">Loading plan…</p>
      ) : (
        <>
          <CognitiveDayPanel cognitive={data?.cognitive} />
          <TodayAllocationSummary blocks={plan?.blocks ?? []} nowMinutes={data?.nowMinutes} />
          <TimelineBlocks blocks={plan?.blocks ?? []} nowMinutes={data?.nowMinutes} />
        </>
      )}
    </main>
  );
}
