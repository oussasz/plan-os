import type { CapacityConfig } from "./types";
import { getDayOfWeek } from "./week-utils";

export function getDayCapacity(settings: CapacityConfig, date: string): number {
  const dow = getDayOfWeek(date);
  if (!settings.workDays.includes(dow)) return 0;
  return settings.weekdayHours[String(dow)] ?? settings.dailyCapacityHours;
}

export function getMaxDailyProjectHours(
  settings: CapacityConfig,
  projectMaxDaily: number | null
): number {
  const cap = settings.dailyCapacityHours * (settings.maxProjectSharePct / 100);
  return projectMaxDaily ?? cap;
}

export function getBlockDurationMinutes(settings: CapacityConfig): number {
  return settings.blockMinutes;
}

export function getBreakDurationMinutes(settings: CapacityConfig): number {
  return settings.breakMinutes;
}

export function estimateBlocksForHours(hours: number, blockMinutes: number): number {
  if (hours <= 0) return 0;
  return Math.ceil((hours * 60) / blockMinutes);
}
