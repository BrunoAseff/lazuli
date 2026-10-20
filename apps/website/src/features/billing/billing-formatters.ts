export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export const formatBytes = (bytes: number) => {
  if (bytes >= 1024 ** 3)
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(bytes / 1024 ** 3)} GB`;
  return `${Math.ceil(bytes / 1024 ** 2).toLocaleString("pt-BR")} MB`;
};

export const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(value),
      )
    : null;
