"use client";

type Block = {
  startTime: string;
  endTime: string;
  blockType: string;
  projectId: string | null;
  reasonShort: string;
  project?: { name: string } | null;
};

const TYPE_LABELS: Record<string, string> = {
  deep_work: "Deep Work",
  execution: "Execution",
  admin: "Admin",
  buffer: "Buffer",
  break: "Break",
  lunch: "Lunch",
};

function blockHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return ((eh! * 60 + em!) - (sh! * 60 + sm!)) / 60;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function TodayAllocationSummary({
  blocks,
  nowMinutes,
}: {
  blocks: Block[];
  nowMinutes?: number;
}) {
  const workBlocks = blocks.filter((b) => {
    if (["break", "lunch", "buffer"].includes(b.blockType) || !b.projectId) return false;
    if (nowMinutes === undefined) return true;
    return parseTimeToMinutes(b.endTime) > nowMinutes;
  });

  const byProject = new Map<
    string,
    { name: string; hours: number; blockType: string; reason: string }
  >();

  for (const b of workBlocks) {
    if (!b.projectId) continue;
    const hours = blockHours(b.startTime, b.endTime);
    const existing = byProject.get(b.projectId);
    const name = b.project?.name ?? b.reasonShort;
    if (existing) {
      existing.hours += hours;
    } else {
      byProject.set(b.projectId, {
        name,
        hours,
        blockType: b.blockType,
        reason: b.reasonShort,
      });
    }
  }

  const bufferHours = blocks
    .filter((b) => {
      if (b.blockType !== "buffer") return false;
      if (nowMinutes === undefined) return true;
      return parseTimeToMinutes(b.endTime) > nowMinutes;
    })
    .reduce((s, b) => s + blockHours(b.startTime, b.endTime), 0);

  const rows = [...byProject.values()].sort((a, b) => b.hours - a.hours);

  if (rows.length === 0 && bufferHours === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-violet-700">
        Remaining Today
      </h2>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.name} className="flex items-start justify-between gap-2 text-sm">
            <div>
              <span className="font-medium text-slate-900">
                {row.name} → {Math.round(row.hours * 10) / 10}h
              </span>
              <span className="text-slate-500">
                {" "}
                ({TYPE_LABELS[row.blockType] ?? row.blockType})
              </span>
              <p className="text-xs text-slate-500">{row.reason}</p>
            </div>
          </li>
        ))}
        {bufferHours > 0 && (
          <li className="text-sm text-slate-600">
            Buffer → {Math.round(bufferHours * 10) / 10}h
          </li>
        )}
      </ul>
    </section>
  );
}
