export function getToday(): string {
  return new Date().toISOString().split("T")[0]!;
}

export function getLocalParts(
  timezone: string,
  date = new Date()
): { year: string; month: string; day: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const hourRaw = get("hour");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: Number(hourRaw === "24" ? "0" : hourRaw),
    minute: Number(get("minute")),
  };
}

export function getTodayInTimezone(timezone: string, date = new Date()): string {
  const { year, month, day } = getLocalParts(timezone, date);
  return `${year}-${month}-${day}`;
}

export function getNowMinutesInTimezone(timezone: string, date = new Date()): number {
  const { hour, minute } = getLocalParts(timezone, date);
  return hour * 60 + minute;
}

export function roundUpMinutes(minutes: number, step: number): number {
  return Math.ceil(minutes / step) * step;
}

export function formatMinutesAsTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0]!;
}

export function getWeekStart(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0]!;
}

export function getMonthStart(date = new Date()): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

export function getWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

export function getRemainingWeekDates(weekStart: string, fromDate: string): string[] {
  return getWeekDates(weekStart).filter((d) => d >= fromDate);
}

export function getWeeklyCapacity(
  workDays: number[],
  weekdayHours: Record<string, number>,
  dates: string[]
): number {
  const workDaySet = new Set(workDays);
  return dates.reduce((sum, date) => {
    const dow = getDayOfWeek(date);
    if (!workDaySet.has(dow)) return sum;
    return sum + (weekdayHours[String(dow)] ?? 0);
  }, 0);
}
