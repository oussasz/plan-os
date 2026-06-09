"use client";

import { format, parseISO } from "date-fns";
import { cn } from "~/lib/utils";

type DayPlan = {
  date: string;
  totalCapacityHours: number;
  blockCount: number;
};

export function WeekStrip({
  days,
  selectedDate,
  onSelect,
}: {
  days: DayPlan[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {days.map((day) => {
        const d = parseISO(day.date);
        const isSelected = day.date === selectedDate;
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelect(day.date)}
            className={cn(
              "flex min-w-[4.5rem] flex-col items-center rounded-xl border px-3 py-2 text-center transition",
              isSelected
                ? "border-violet-600 bg-violet-50 text-violet-900"
                : "border-slate-200 bg-white text-slate-700"
            )}
          >
            <span className="text-xs font-medium uppercase">{format(d, "EEE")}</span>
            <span className="text-lg font-bold">{format(d, "d")}</span>
            <span className="text-xs text-slate-500">{day.blockCount} blocks</span>
          </button>
        );
      })}
    </div>
  );
}
