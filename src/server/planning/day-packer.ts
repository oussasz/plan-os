import type {
  BlockType,
  CapacityConfig,
  FixedEventInput,
  PackedBlock,
  ProjectInput,
} from "./types";

function parseMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function durationMinutes(start: string, end: string): number {
  return parseMinutes(end) - parseMinutes(start);
}

export function packDay(input: {
  date: string;
  dayCapacityHours: number;
  remainingHours: Map<string, number>;
  projects: ProjectInput[];
  fixedEvents: FixedEventInput[];
  settings: CapacityConfig;
  sortOrderStart: number;
  projectReasons: Map<string, string>;
}): { blocks: PackedBlock[]; sortOrder: number } {
  const {
    date,
    dayCapacityHours,
    remainingHours,
    projects,
    fixedEvents,
    settings,
    sortOrderStart,
    projectReasons,
  } = input;

  const blocks: PackedBlock[] = [];
  let sortOrder = sortOrderStart;
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const dayFixed = fixedEvents
    .filter((e) => e.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  for (const ev of dayFixed) {
    const blockType: BlockType =
      ev.eventType === "meeting" ? "meeting" : ev.eventType === "obligation" ? "obligation" : "appointment";
    blocks.push({
      startTime: ev.startTime.slice(0, 5),
      endTime: ev.endTime.slice(0, 5),
      blockType,
      projectId: ev.projectId,
      fixedEventId: ev.id,
      isLocked: true,
      sortOrder: sortOrder++,
      reasonShort: ev.title,
    });
  }

  const workStart = parseMinutes(settings.workStartTime);
  const lunchStart = parseMinutes(settings.lunchStartTime);
  const lunchEnd = lunchStart + settings.lunchMinutes;
  const dayEnd = workStart + dayCapacityHours * 60;

  type Slot = { start: number; end: number };
  const slots: Slot[] = [{ start: workStart, end: dayEnd }];

  for (const b of blocks) {
    const bs = parseMinutes(b.startTime);
    const be = parseMinutes(b.endTime);
    const next: Slot[] = [];
    for (const slot of slots) {
      if (be <= slot.start || bs >= slot.end) {
        next.push(slot);
        continue;
      }
      if (bs > slot.start) next.push({ start: slot.start, end: bs });
      if (be < slot.end) next.push({ start: be, end: slot.end });
    }
    slots.length = 0;
    slots.push(...next.filter((s) => s.end - s.start >= 15));
  }

  if (lunchStart >= workStart && lunchEnd <= dayEnd) {
    const next: Slot[] = [];
    for (const slot of slots) {
      if (lunchEnd <= slot.start || lunchStart >= slot.end) {
        next.push(slot);
        continue;
      }
      if (lunchStart > slot.start) next.push({ start: slot.start, end: lunchStart });
      if (lunchEnd < slot.end) next.push({ start: lunchEnd, end: slot.end });
    }
    slots.length = 0;
    slots.push(...next.filter((s) => s.end - s.start >= 15));
    blocks.push({
      startTime: formatMinutes(lunchStart),
      endTime: formatMinutes(lunchEnd),
      blockType: "lunch",
      projectId: null,
      fixedEventId: null,
      isLocked: true,
      sortOrder: sortOrder++,
      reasonShort: "Lunch",
    });
  }

  const activeProjects = [...remainingHours.entries()]
    .filter(([, h]) => h > 0)
    .map(([id]) => projectMap.get(id))
    .filter(Boolean) as ProjectInput[];

  let lastProjectId: string | null = null;
  let consecutiveSame = 0;
  let contextSwitches = 0;
  const blockMins = settings.blockMinutes;
  const breakMins = settings.breakMinutes;
  const maxDailyPerProject = dayCapacityHours * (settings.maxProjectSharePct / 100);
  const placedToday = new Map<string, number>();

  const sortedSlots = [...slots].sort((a, b) => a.start - b.start);

  for (const slot of sortedSlots) {
    let cursor = slot.start;
    while (cursor + blockMins <= slot.end) {
      const candidates = activeProjects
        .filter((p) => (remainingHours.get(p.id) ?? 0) > 0)
        .filter((p) => (placedToday.get(p.id) ?? 0) < (p.maxDailyHours ?? maxDailyPerProject))
        .sort((a, b) => (remainingHours.get(b.id) ?? 0) - (remainingHours.get(a.id) ?? 0));

      if (candidates.length === 0) break;

      let pick = candidates[0]!;
      if (lastProjectId && consecutiveSame >= 2) {
        const alt = candidates.find((c) => c.id !== lastProjectId);
        if (alt) pick = alt;
      }
      if (lastProjectId && pick.id !== lastProjectId) contextSwitches++;
      if (contextSwitches >= settings.maxContextSwitches && lastProjectId) {
        const same = candidates.find((c) => c.id === lastProjectId);
        if (same) pick = same;
      }

      const remaining = remainingHours.get(pick.id) ?? 0;
      const blockHours = Math.min(blockMins / 60, remaining, maxDailyPerProject - (placedToday.get(pick.id) ?? 0));
      if (blockHours < 0.25) break;

      const blockEnd = cursor + blockHours * 60;
      const blockType: BlockType = pick.requiresDeepFocus ? "deep_work" : "execution";

      blocks.push({
        startTime: formatMinutes(cursor),
        endTime: formatMinutes(blockEnd),
        blockType,
        projectId: pick.id,
        fixedEventId: null,
        isLocked: false,
        sortOrder: sortOrder++,
        reasonShort: projectReasons.get(pick.id) ?? pick.name,
      });

      remainingHours.set(pick.id, Math.round((remaining - blockHours) * 10) / 10);
      placedToday.set(pick.id, (placedToday.get(pick.id) ?? 0) + blockHours);

      if (pick.id === lastProjectId) consecutiveSame++;
      else {
        consecutiveSame = 1;
        lastProjectId = pick.id;
      }

      cursor = blockEnd + breakMins;
      if (cursor + 15 <= slot.end) {
        blocks.push({
          startTime: formatMinutes(blockEnd),
          endTime: formatMinutes(cursor),
          blockType: "break",
          projectId: null,
          fixedEventId: null,
          isLocked: false,
          sortOrder: sortOrder++,
          reasonShort: "Break",
        });
      }
    }
  }

  const bufferMins = settings.bufferMinutes;
  if (bufferMins > 0 && dayEnd - bufferMins > workStart) {
    blocks.push({
      startTime: formatMinutes(dayEnd - bufferMins),
      endTime: formatMinutes(dayEnd),
      blockType: "buffer",
      projectId: null,
      fixedEventId: null,
      isLocked: false,
      sortOrder: sortOrder++,
      reasonShort: "Catch-up",
    });
  }

  blocks.sort((a, b) => a.sortOrder - b.sortOrder);
  return { blocks, sortOrder };
}
