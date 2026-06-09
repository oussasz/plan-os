import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeRange(start: string, end: string): string {
  return `[${start.slice(0, 5)} – ${end.slice(0, 5)}]`;
}
