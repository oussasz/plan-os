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

export function TimelineBlocks({ blocks }: { blocks: Block[] }) {
  if (blocks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
        No blocks scheduled. Add projects and regenerate.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block) => {
        const label = block.project?.name ?? block.reasonShort;
        const typeLabel = TYPE_LABELS[block.blockType] ?? block.blockType;
        return (
          <div
            key={block.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
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
            <div className="mt-2">
              <Badge variant={badgeVariant(block.blockType, block.isLocked)}>
                {block.isLocked ? "Locked" : typeLabel}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
