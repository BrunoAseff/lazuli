const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
});

export const formatProjectDate = (date: string) => dateFormatter.format(new Date(date));
