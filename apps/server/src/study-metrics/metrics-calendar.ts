import type { StudyMetricsPoint } from "@lazuli/shared";

export const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

export const localToday = (tz: string, now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export const validateMetricsRange = (from: string, to: string, tz: string) => {
  try {
    if (
      new Date(`${from}T12:00:00Z`).toISOString().slice(0, 10) !== from ||
      new Date(`${to}T12:00:00Z`).toISOString().slice(0, 10) !== to
    )
      return false;
    const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
    return Number.isFinite(days) && days >= 1 && days <= 366 && to <= localToday(tz);
  } catch {
    return false;
  }
};

export const groupMetricsDays = (points: StudyMetricsPoint[]) => {
  const bucket = points.length <= 14 ? "day" : points.length <= 60 ? "week" : "month";
  const groups: StudyMetricsPoint[] = [];
  let previousKey = "";
  for (const point of points) {
    const weekday = new Date(`${point.date}T12:00:00Z`).getUTCDay();
    const key =
      bucket === "month"
        ? point.date.slice(0, 7)
        : bucket === "week"
          ? shiftDate(point.date, -((weekday + 6) % 7))
          : point.date;
    if (key !== previousKey) {
      groups.push({ ...point });
      previousKey = key;
    } else {
      const group = groups[groups.length - 1]!;
      group.end = point.end;
      for (const field of [
        "evaluations",
        "eligible",
        "remembered",
        "again",
        "hard",
        "good",
        "easy",
        "quizAnswers",
        "quizCorrect",
      ] as const)
        group[field] += point[field];
    }
  }
  return { bucket, series: groups } as const;
};

/** Reuse the current buckets' local-day offsets, rather than compare unequal calendar months. */
export function alignPreviousDays(
  current: StudyMetricsPoint[],
  previous: StudyMetricsPoint[],
  days: number,
) {
  return current.map((bucket) => {
    const from = shiftDate(bucket.date, -days),
      to = shiftDate(bucket.end, -days);
    const points = previous.filter((p) => p.date >= from && p.date <= to);
    const result = { ...bucket, date: from, end: to };
    for (const field of [
      "evaluations",
      "eligible",
      "remembered",
      "again",
      "hard",
      "good",
      "easy",
      "quizAnswers",
      "quizCorrect",
    ] as const)
      result[field] = points.reduce((sum, p) => sum + p[field], 0);
    return result;
  });
}

const localParts = (date: Date, tz: string) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
const partsTimestamp = (p: Record<string, string>) =>
  Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );

/** Fold: first occurrence. Gap: first valid local instant after the missing wall time. */
export function localWallInstant(date: string, time: string, tz: string, milliseconds = 0) {
  const wall = Date.parse(`${date}T${time}Z`);
  const offsets = new Set<number>();
  for (let h = -48; h <= 48; h += 6) {
    const sample = wall + h * 3600000;
    offsets.add(partsTimestamp(localParts(new Date(sample), tz)) - sample);
  }
  for (let minute = 0; minute <= 1440; minute++) {
    // A DST gap advances to the beginning of the first valid minute, not the original seconds.
    const target = minute === 0 ? wall : Math.floor(wall / 60000) * 60000 + minute * 60000;
    const matches = [...offsets]
      .map((offset) => target - offset)
      .filter((instant) => partsTimestamp(localParts(new Date(instant), tz)) === target);
    if (matches.length) return new Date(Math.min(...matches) + (minute === 0 ? milliseconds : 0));
  }
  throw new Error("Unable to resolve local calendar time");
}

export function comparisonWindow(from: string, to: string, tz: string, now: Date) {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const previousFrom = shiftDate(from, -days),
    previousTo = shiftDate(from, -1);
  const parts = localParts(now, tz);
  return {
    days,
    previousFrom,
    previousTo,
    currentCutoff: to === localToday(tz, now) ? now.toISOString() : undefined,
    previousCutoff:
      to === localToday(tz, now)
        ? localWallInstant(
            previousTo,
            `${parts.hour}:${parts.minute}:${parts.second}`,
            tz,
            now.getUTCMilliseconds(),
          ).toISOString()
        : undefined,
  };
}
