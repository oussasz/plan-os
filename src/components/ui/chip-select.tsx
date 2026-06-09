"use client";

import { cn } from "~/lib/utils";

export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition",
              value === opt.value
                ? "border-violet-600 bg-violet-50 text-violet-800"
                : "border-slate-200 bg-white text-slate-600"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
