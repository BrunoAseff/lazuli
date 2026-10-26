export const formatCount = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
export const quantity = (value: number, singular: string, plural: string) =>
  `${formatCount(value)} ${value === 1 ? singular : plural}`;
export const formatRate = (success: number, total: number) =>
  total
    ? new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 }).format(
        success / total,
      )
    : "Sem dados";
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00Z`),
  );
export const formatFullDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
export const formatChartDate = (date: string, bucket: "day" | "week" | "month") =>
  bucket === "month"
    ? new Intl.DateTimeFormat("pt-BR", {
        month: "short",
        timeZone: "UTC",
      }).format(new Date(`${date}T12:00:00Z`))
    : new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" })
        .format(new Date(`${date}T12:00:00Z`))
        .replace(" de ", "\n");

// Reserve enough space for every category; no missing or displaced axis labels.
export const metricsPlotMinWidth = (categories: number) => Math.max(240, categories * 30 + 48);
export const shiftLocalDate = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export const todayLocal = () =>
  new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
export const presetRange = (days: number) => {
  const to = todayLocal();
  if (days === 365) {
    // The 12-month preset follows the calendar, including leap years.
    const date = new Date(`${to}T12:00:00Z`);
    const year = date.getUTCFullYear() - 1;
    const month = date.getUTCMonth();
    const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
    const previousYear = new Date(Date.UTC(year, month, day, 12)).toISOString().slice(0, 10);
    return { from: shiftLocalDate(previousYear, 1), to };
  }
  return { from: shiftLocalDate(to, 1 - days), to };
};
export const validRange = (from: string, to: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(from) &&
  /^\d{4}-\d{2}-\d{2}$/.test(to) &&
  !Number.isNaN(Date.parse(from)) &&
  !Number.isNaN(Date.parse(to)) &&
  new Date(`${from}T12:00:00Z`).toISOString().slice(0, 10) === from &&
  new Date(`${to}T12:00:00Z`).toISOString().slice(0, 10) === to &&
  from <= to &&
  to <= todayLocal() &&
  (Date.parse(to) - Date.parse(from)) / 86400000 < 366;
