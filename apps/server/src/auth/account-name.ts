export const normalizeAccountName = (name: string) => name.trim().replace(/\s+/g, " ");

export const isValidAccountName = (name: string) => name.length >= 2 && name.length <= 80;
