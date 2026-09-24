const mediumDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });
const mediumDateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const formatMediumDate = (value: Date | string) =>
  mediumDate.format(typeof value === "string" ? new Date(value) : value);

export const formatMediumDateTime = (value: Date | string) =>
  mediumDateTime.format(typeof value === "string" ? new Date(value) : value);
