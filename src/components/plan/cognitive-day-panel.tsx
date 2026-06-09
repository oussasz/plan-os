"use client";

import { AlertTriangle, Brain, TrendingDown, TrendingUp, Minus } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import type { RouterOutputs } from "~/trpc/react";

type Cognitive = NonNullable<RouterOutputs["planning"]["getToday"]["cognitive"]>;

const LOAD_STYLES = {
  normal: { dot: "bg-emerald-500", bg: "bg-emerald-50 border-emerald-200 text-emerald-900" },
  heavy: { dot: "bg-amber-500", bg: "bg-amber-50 border-amber-200 text-amber-900" },
  overloaded: { dot: "bg-red-500", bg: "bg-red-50 border-red-200 text-red-900" },
} as const;

export function CognitiveDayPanel({ cognitive }: { cognitive: Cognitive | null | undefined }) {
  if (!cognitive) return null;

  const style = LOAD_STYLES[cognitive.focusLoad];

  return (
    <section className="mb-6 space-y-4">
      <div className={`rounded-xl border p-4 ${style.bg}`}>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
              <p className="font-semibold">Focus Load: {cognitive.focusLoadLabel}</p>
            </div>
            <p className="mt-1 text-sm opacity-90">{cognitive.focusLoadDetail}</p>
            <p className="mt-1 text-xs opacity-75">
              {cognitive.utilizationPct}% utilization · {cognitive.scheduledHoursRemaining}h scheduled
              in {cognitive.availableHoursRemaining}h left
            </p>
          </div>
        </div>
      </div>

      {cognitive.driftAlerts.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-900">
            <AlertTriangle className="h-4 w-4" />
            Anti-Drift Protection
          </p>
          <ul className="space-y-2">
            {cognitive.driftAlerts.map((a) => (
              <li key={a.projectId} className="text-sm text-red-800">
                <p className="font-medium">{a.message}</p>
                <p className="text-xs text-red-700">{a.action}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cognitive.suggestions.length > 0 && (
        <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
          <p className="mb-2 text-sm font-semibold text-violet-900">Smart Suggestions</p>
          <ul className="space-y-2">
            {cognitive.suggestions.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-sm text-slate-800">
                <Badge
                  variant={s.severity === "warning" ? "default" : "secondary"}
                  className={`mt-0.5 shrink-0 text-[10px] ${
                    s.severity === "critical" ? "bg-red-100 text-red-800" : ""
                  }`}
                >
                  {s.severity}
                </Badge>
                <span>{s.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cognitive.plannedVsActual.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-900">Planned vs Actual (Today)</p>
          <ul className="space-y-2">
            {cognitive.plannedVsActual.map((row) => (
              <li
                key={row.projectId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="font-medium text-slate-900">{row.projectName}</span>
                <span className="font-mono text-slate-600">
                  {row.plannedHours}h plan · {row.actualHours}h actual
                  {row.variancePct !== null && (
                    <span
                      className={
                        row.varianceHours > 0
                          ? "text-amber-700"
                          : row.varianceHours < 0
                            ? "text-slate-500"
                            : ""
                      }
                    >
                      {" "}
                      ({row.variancePct > 0 ? "+" : ""}
                      {row.variancePct}%)
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Close out the day to record actuals and feed the learning loop.
          </p>
        </div>
      )}

      {cognitive.reallocations.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-900">Dynamic Reallocation</p>
          <ul className="space-y-1">
            {cognitive.reallocations.slice(0, 4).map((r) => (
              <li key={r.projectId} className="text-xs text-slate-700">
                {r.projectName}: {r.beforeHours}h → {r.afterHours}h — {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-amber-600" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-slate-500" />;
  return <Minus className="h-3.5 w-3.5 text-slate-400" />;
}
