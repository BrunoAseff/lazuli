export const foldSearchText = (value: string) =>
  value.normalize("NFD").replaceAll(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
