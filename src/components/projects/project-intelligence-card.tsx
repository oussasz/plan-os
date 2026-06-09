"use client";

import { AlertTriangle } from "lucide-react";

import { TrendIcon } from "~/components/plan/cognitive-day-panel";
import { Badge } from "~/components/ui/badge";
import type { RouterOutputs } from "~/trpc/react";

type Card = RouterOutputs["project"]["intelligenceCards"][number];

const RISK_COLORS = {
  low: "text-emerald-700 bg-emerald-50",
  medium: "text-amber-800 bg-amber-50",
  high: "text-red-800 bg-red-50",
} as const;

export function ProjectIntelligenceCard({
  card,
  onClick,
}: {
  card: Card;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-violet-200"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{card.name}</p>
            {card.overloadRisk === "high" && (
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-label="High overload risk" />
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Priority {card.priorityScore} · {card.priorityBand} · {card.suggestedHoursToday}h/day
            suggested
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <TrendIcon trend={card.trend} />
          <span className="capitalize">{card.trend}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-slate-500">Today</p>
          <p className="font-mono font-medium text-slate-900">
            {card.plannedHoursToday}h plan / {card.actualHoursToday}h actual
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-slate-500">This week</p>
          <p className="font-mono font-medium text-slate-900">
            {card.plannedHoursWeek}h plan / {card.actualHoursWeek}h actual
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="default">Score {card.priorityScore}</Badge>
        <Badge variant="secondary" className={RISK_COLORS[card.overloadRisk]}>
          Overload {card.overloadRisk}
        </Badge>
        <Badge variant="secondary" className={RISK_COLORS[card.burnoutRisk]}>
          Burnout {card.burnoutRisk}
        </Badge>
        <Badge variant="secondary">{card.suggestedHoursWeek}h/wk auto</Badge>
      </div>

      {card.suggestions.length > 0 && (
        <ul className="mt-3 space-y-1 border-t pt-2">
          {card.suggestions.map((s) => (
            <li key={s} className="text-xs text-violet-800">
              {s}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}
