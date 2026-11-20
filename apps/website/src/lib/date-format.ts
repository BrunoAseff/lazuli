const mediumDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });
const mediumDateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const formatMediumDate = (value: Date | string) =>
  mediumDate.format(typeof value === "string" ? new Date(value) : value);

export const formatMediumDateTime = (value: Date | string) =>
  mediumDateTime.format(typeof value === "string" ? new Date(value) : value);

const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dayMonthTime = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});
const startOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

/** A moment ahead, as people say it: "hoje, 10:15", "amanhã, 08:00", "24 de nov., 14:23". */
export const formatUpcoming = (value: Date | string, now = new Date()) => {
  const date = typeof value === "string" ? new Date(value) : value;
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (days === 0) return `hoje, ${time.format(date)}`;
  if (days === 1) return `amanhã, ${time.format(date)}`;
  return dayMonthTime.format(date);
};

const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });

/** A moment past, as people say it: "hoje", "ontem", "17 de nov." (year only when it is not this one). */
export const formatRecent = (value: Date | string, now = new Date()) => {
  const date = typeof value === "string" ? new Date(value) : value;
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  return date.getFullYear() === now.getFullYear() ? dayMonth.format(date) : mediumDate.format(date);
};

/** "Atualizado hoje", "Atualizado em 17 de nov.": the preposition only where Portuguese needs it. */
export const formatUpdated = (value: Date | string, now = new Date()) => {
  const recent = formatRecent(value, now);
  return recent === "hoje" || recent === "ontem"
    ? `Atualizado ${recent}`
    : `Atualizado em ${recent}`;
};
