"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";

import { TimelineBlocks } from "~/components/plan/timeline-blocks";
import { WeekStrip } from "~/components/plan/week-strip";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export default function WeekPage() {
  const utils = api.useUtils();
  const { data, isLoading } = api.planning.getWeek.useQuery();
  const regenerate = api.planning.regenerate.useMutation({
    onSuccess: () => void utils.planning.getWeek.invalidate(),
  });

  const weekStart = data?.weekStart ?? new Date().toISOString().split("T")[0]!;
  const dailyPlans = data?.weekly?.dailyPlans ?? [];

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const date = d.toISOString().split("T")[0]!;
      const plan = dailyPlans.find(
        (p) => p.date.toISOString().split("T")[0] === date
      );
      return {
        date,
        totalCapacityHours: plan ? Number(plan.totalCapacityHours) : 0,
        blockCount: plan?.blocks.length ?? 0,
      };
    });
  }, [weekStart, dailyPlans]);

  const [selectedDate, setSelectedDate] = useState(weekStart);
  const selectedPlan = dailyPlans.find(
    (p) => p.date.toISOString().split("T")[0] === selectedDate
  );

  return (
    <main className="px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-violet-600">Week</p>
          <h1 className="text-2xl font-bold text-slate-900">
            {format(parseISO(weekStart), "MMM d")} –{" "}
            {format(parseISO(days[6]!.date), "MMM d")}
          </h1>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => regenerate.mutate({})}
          disabled={regenerate.isPending}
        >
          <RefreshCw className={`h-4 w-4 ${regenerate.isPending ? "animate-spin" : ""}`} />
        </Button>
      </header>

      <WeekStrip days={days} selectedDate={selectedDate} onSelect={setSelectedDate} />

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Allocations
        </h2>
        <div className="mb-6 flex flex-col gap-2">
          {(data?.weekly?.allocations ?? []).map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border bg-white px-3 py-2"
            >
              <span className="font-medium">{a.project.name}</span>
              <span className="text-sm text-slate-600">{Number(a.plannedHours)}h</span>
            </div>
          ))}
        </div>

        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {format(parseISO(selectedDate), "EEEE")}
        </h2>
        {isLoading ? (
          <p className="text-slate-500">Loading…</p>
        ) : (
          <TimelineBlocks blocks={selectedPlan?.blocks ?? []} />
        )}
      </section>
    </main>
  );
}
