"use client";

import { Badge } from "~/components/ui/badge";
import { formatTimeRange } from "~/lib/utils";

type Block = {
  id: string;
  startTime: string;
  endTime: string;
  blockType: string;
  isLocked: boolean;
  reasonShort: string;
  project?: { name: string } | null;
};

const TYPE_LABELS: Record<string, string> = {
  deep_work: "Deep Work",
  execution: "Execution",
  admin: "Admin",
  meeting: "Meeting",
  break: "Break",
  buffer: "Buffer",
  lunch: "Lunch",
  appointment: "Appointment",
  obligation: "Obligation",
};

function badgeVariant(blockType: string, isLocked: boolean) {
  if (isLocked) return "locked" as const;
  if (blockType === "break" || blockType === "lunch") return "break" as const;
  return "default" as const;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function TimelineBlocks({
  blocks,
  nowMinutes,
}: {
  blocks: Block[];
  nowMinutes?: number;
}) {
  if (blocks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
        No blocks scheduled from now. Add projects or fixed events, then refresh.
      </p>
    );
  }

  let nowMarkerPlaced = false;

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block) => {
        const label = block.project?.name ?? block.reasonShort;
        const typeLabel = TYPE_LABELS[block.blockType] ?? block.blockType;
        const endMin = parseTimeToMinutes(block.endTime);
        const startMin = parseTimeToMinutes(block.startTime);
        const isPast = nowMinutes !== undefined && endMin <= nowMinutes;
        const isCurrent =
          nowMinutes !== undefined && startMin <= nowMinutes && endMin > nowMinutes;
        const showNowMarker =
          nowMinutes !== undefined &&
          !nowMarkerPlaced &&
          startMin > nowMinutes;
        if (showNowMarker) nowMarkerPlaced = true;

        return (
          <div key={block.id}>
            {showNowMarker && (
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-600">
                <span className="h-px flex-1 bg-violet-200" />
                Now
                <span className="h-px flex-1 bg-violet-200" />
              </div>
            )}
          <div
            className={`rounded-xl border p-4 shadow-sm ${
              isPast
                ? "border-slate-100 bg-slate-50 opacity-60"
                : isCurrent
                  ? "border-violet-300 bg-violet-50/80 ring-1 ring-violet-200"
                  : "border-slate-200 bg-white"
            }`}
          >
            <p className="font-mono text-sm text-slate-500">
              {formatTimeRange(block.startTime, block.endTime)}
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {label} · {typeLabel}
            </p>
            {block.reasonShort && block.project && (
              <p className="mt-1 text-sm text-slate-500">{block.reasonShort}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={badgeVariant(block.blockType, block.isLocked)}>
                {block.isLocked ? "Locked" : typeLabel}
              </Badge>
              {isPast && <Badge variant="secondary">Past</Badge>}
              {isCurrent && <Badge variant="default">In progress</Badge>}
            </div>
          </div>
          </div>
        );
      })}
      {nowMinutes !== undefined && !nowMarkerPlaced && (
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-600">
          <span className="h-px flex-1 bg-violet-200" />
          Now — nothing left scheduled today
          <span className="h-px flex-1 bg-violet-200" />
        </div>
      )}
    </div>
  );
}
