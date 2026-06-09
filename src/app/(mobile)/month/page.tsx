"use client";

import { format, parseISO } from "date-fns";

import { api } from "~/trpc/react";

type Budget = {
  projectId: string;
  projectName: string;
  hoursBudget: number;
  milestoneNote: string;
};

type Milestone = {
  weekStart: string;
  projectId: string;
  note: string;
};

export default function MonthPage() {
  const { data, isLoading } = api.planning.getMonth.useQuery();

  const budgets = (data?.projectBudgets as Budget[] | undefined) ?? [];
  const milestones = (data?.weekMilestones as Milestone[] | undefined) ?? [];
  const monthLabel = data?.monthStart
    ? format(parseISO(data.monthStart.toISOString().split("T")[0]!), "MMMM yyyy")
    : format(new Date(), "MMMM yyyy");

  return (
    <main className="px-4 py-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-violet-600">Month</p>
        <h1 className="text-2xl font-bold text-slate-900">Strategy</h1>
        <p className="text-sm text-slate-500">{monthLabel}</p>
      </header>

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : budgets.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
          Add projects to see monthly budgets.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {budgets.map((b) => (
            <article
              key={b.projectId}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-900">{b.projectName}</h2>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-sm font-medium text-violet-800">
                  {b.hoursBudget}h
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{b.milestoneNote}</p>
              <ul className="mt-3 space-y-1 border-t pt-3 text-sm text-slate-500">
                {milestones
                  .filter((m) => m.projectId === b.projectId)
                  .map((m, i) => (
                    <li key={i}>Week of {m.weekStart}: {m.note}</li>
                  ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
