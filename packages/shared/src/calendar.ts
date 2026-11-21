import { z } from "zod";

/*
 * Calendar days as the person lives them: "YYYY-MM-DD" keys in their time zone. One module for
 * the server (goal, stone, statistics) and the site, so a day always starts at the same moment.
 */

const DAY_MS = 24 * 60 * 60 * 1_000;

/** An IANA time zone sent by the browser ("America/Sao_Paulo"). */
export const timeZoneSchema = z.string().trim().min(1).max(100);

/** The canonical IANA name, "UTC" when none was sent, or null when it is not a real zone. */
export const normalizeTimeZone = (value?: string) => {
  if (!value) return "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
};

/** The browser's own time zone. */
export const clientTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** The calendar day an instant falls on in a time zone, as "YYYY-MM-DD". */
export const dateKeyIn = (value: Date, timeZone?: string) =>
  new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(value);

/** A day key moved by whole days (negative goes back), across months and leap years. */
export const shiftDateKey = (date: string, days: number) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!) + days * DAY_MS).toISOString().slice(0, 10);
};
