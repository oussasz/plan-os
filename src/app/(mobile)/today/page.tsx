"use client";

import { RefreshCw } from "lucide-react";

import { CloseOutDialog } from "~/components/plan/close-out-dialog";
import { TimelineBlocks } from "~/components/plan/timeline-blocks";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export default function TodayPage() {
  const utils = api.useUtils();
  const { data, isLoading } = api.planning.getToday.useQuery();
  const { data: projects } = api.project.list.useQuery();
  const regenerate = api.planning.regenerate.useMutation({
    onSuccess: () => void utils.planning.getToday.invalidate(),
  });

  const plan = data?.plan;
  const totalHours = plan ? Number(plan.totalCapacityHours) : 0;

  return (
    <main className="px-4 py-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-violet-600">Today</p>
          <h1 className="text-2xl font-bold text-slate-900">Focus Plan</h1>
          <p className="text-sm text-slate-500">
            {totalHours}h capacity · {plan?.blocks.length ?? 0} blocks
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => regenerate.mutate({})}
            disabled={regenerate.isPending || data?.isClosed}
            aria-label="Regenerate"
          >
            <RefreshCw className={`h-4 w-4 ${regenerate.isPending ? "animate-spin" : ""}`} />
          </Button>
          <CloseOutDialog
            date={data?.today ?? new Date().toISOString().split("T")[0]!}
            projects={(projects ?? []).filter((p) => p.status === "active").map((p) => ({
              id: p.id,
              name: p.name,
            }))}
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
        <TimelineBlocks blocks={plan?.blocks ?? []} />
      )}
    </main>
  );
}
